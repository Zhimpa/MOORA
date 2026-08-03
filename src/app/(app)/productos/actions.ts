'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const EXTENSIONES_IMAGEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024 // 5 MB

// Sube la foto del producto al bucket público 'productos' y devuelve su URL.
// undefined = no se tocó (no se eligió archivo), nunca hace falta borrar el campo.
async function subirImagenProducto(
  supabase: SupabaseClient,
  productoId: string,
  archivo: FormDataEntryValue | null
): Promise<string | undefined> {
  if (!(archivo instanceof File) || archivo.size === 0) return undefined

  const extension = EXTENSIONES_IMAGEN[archivo.type]
  if (!extension) throw new Error('La imagen debe ser JPG, PNG, WEBP o GIF.')
  if (archivo.size > TAMANO_MAXIMO_IMAGEN) throw new Error('La imagen no puede pesar más de 5 MB.')

  const ruta = `${productoId}/${randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('productos')
    .upload(ruta, archivo, { contentType: archivo.type })
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`)

  return supabase.storage.from('productos').getPublicUrl(ruta).data.publicUrl
}

// SKU legible a partir del nombre + un sufijo del id, para que quede único sin pedírselo al usuario.
function generarSkuAuto(nombre: string, productoId: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16)
  const sufijo = productoId.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `${base || 'PROD'}-${sufijo}`
}

// Categorías y marcas se escriben como texto libre: si no existen, se crean.
// Es una pantalla menos que mantener.
async function idPorNombre(
  supabase: SupabaseClient,
  tabla: 'categorias' | 'marcas',
  nombre: string
): Promise<string | null> {
  const limpio = nombre.trim()
  if (!limpio) return null

  const { data: existente } = await supabase
    .from(tabla)
    .select('id')
    .ilike('nombre', limpio)
    .maybeSingle()
  if (existente) return existente.id

  const { data: creado, error } = await supabase
    .from(tabla)
    .insert({ nombre: limpio })
    .select('id')
    .single()
  if (error) throw new Error(`No se pudo crear ${tabla}: ${error.message}`)
  return creado.id
}

export async function crearProducto(formData: FormData) {
  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) return

  const supabase = await createClient()
  const categoria_id = await idPorNombre(supabase, 'categorias', String(formData.get('categoria') ?? ''))
  const marca_id = await idPorNombre(supabase, 'marcas', String(formData.get('marca') ?? ''))

  const { data: producto, error } = await supabase
    .from('productos')
    .insert({
      nombre,
      codigo: String(formData.get('codigo') ?? '').trim() || null,
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      tipo: String(formData.get('tipo') ?? 'otro'),
      categoria_id,
      marca_id,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo guardar el producto: ${error.message}`)

  // La imagen se sube después de crear el producto: la ruta en el bucket usa su id.
  const imagen_url = await subirImagenProducto(supabase, producto.id, formData.get('imagen'))
  if (imagen_url) {
    const { error: errorImagen } = await supabase
      .from('productos')
      .update({ imagen_url })
      .eq('id', producto.id)
    if (errorImagen) throw new Error(`Producto creado, pero la imagen falló: ${errorImagen.message}`)
  }

  // Un producto sin variantes no puede recibir stock ni precio: se crea una presentación
  // "Única" con SKU autogenerado, editable después desde el detalle del producto.
  const { error: errorVariante } = await supabase.from('variantes').insert({
    producto_id: producto.id,
    sku: generarSkuAuto(nombre, producto.id),
    nombre: 'Única',
  })
  if (errorVariante) throw new Error(`Producto creado, pero la presentación falló: ${errorVariante.message}`)

  revalidatePath('/productos')
}

export async function actualizarProducto(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!id || !nombre) return

  const supabase = await createClient()
  const categoria_id = await idPorNombre(supabase, 'categorias', String(formData.get('categoria') ?? ''))
  const marca_id = await idPorNombre(supabase, 'marcas', String(formData.get('marca') ?? ''))
  const imagen_url = await subirImagenProducto(supabase, id, formData.get('imagen'))

  const { error } = await supabase
    .from('productos')
    .update({
      nombre,
      codigo: String(formData.get('codigo') ?? '').trim() || null,
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      tipo: String(formData.get('tipo') ?? 'otro'),
      categoria_id,
      marca_id,
      ...(imagen_url ? { imagen_url } : {}),
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo actualizar: ${error.message}`)

  revalidatePath('/productos')
  revalidatePath(`/productos/${id}`)
}

export async function alternarProducto(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const activo = String(formData.get('activo') ?? '') === 'true'
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('productos').update({ activo: !activo }).eq('id', id)
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)

  revalidatePath('/productos')
}

// ----------------------- Variantes -----------------------

export async function crearVariante(formData: FormData) {
  const producto_id = String(formData.get('producto_id') ?? '')
  const sku = String(formData.get('sku') ?? '').trim()
  if (!producto_id || !sku) return

  const supabase = await createClient()
  const { error } = await supabase.from('variantes').insert({
    producto_id,
    sku,
    nombre: String(formData.get('nombre') ?? '').trim() || 'Única',
    codigo_barras: String(formData.get('codigo_barras') ?? '').trim() || null,
    precio_venta_menor: Number(formData.get('precio_menor') ?? 0),
    precio_venta_mayor: Number(formData.get('precio_mayor') ?? 0),
    stock_minimo: Number(formData.get('stock_minimo') ?? 0),
  })
  if (error) throw new Error(`No se pudo crear la variante: ${error.message}`)

  revalidatePath(`/productos/${producto_id}`)
}

// Ojo: el stock no está aquí a propósito. Solo cambia con movimientos de inventario.
export async function actualizarVariante(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const producto_id = String(formData.get('producto_id') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('variantes')
    .update({
      sku: String(formData.get('sku') ?? '').trim(),
      nombre: String(formData.get('nombre') ?? '').trim() || 'Única',
      codigo_barras: String(formData.get('codigo_barras') ?? '').trim() || null,
      precio_venta_menor: Number(formData.get('precio_menor') ?? 0),
      precio_venta_mayor: Number(formData.get('precio_mayor') ?? 0),
      stock_minimo: Number(formData.get('stock_minimo') ?? 0),
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo actualizar la variante: ${error.message}`)

  revalidatePath(`/productos/${producto_id}`)
  revalidatePath('/inventario')
}

export async function alternarVariante(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const producto_id = String(formData.get('producto_id') ?? '')
  const activo = String(formData.get('activo') ?? '') === 'true'
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('variantes').update({ activo: !activo }).eq('id', id)
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)

  revalidatePath(`/productos/${producto_id}`)
}
