'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

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

  // Un producto sin variantes no se puede vender: creamos la primera de una vez.
  const sku = String(formData.get('sku') ?? '').trim()
  if (sku) {
    const { error: errorVariante } = await supabase.from('variantes').insert({
      producto_id: producto.id,
      sku,
      nombre: String(formData.get('variante') ?? '').trim() || 'Única',
      precio_venta_menor: Number(formData.get('precio_menor') ?? 0),
      precio_venta_mayor: Number(formData.get('precio_mayor') ?? 0),
      stock_minimo: Number(formData.get('stock_minimo') ?? 0),
    })
    if (errorVariante) throw new Error(`Producto creado, pero la variante falló: ${errorVariante.message}`)
  }

  revalidatePath('/productos')
}

export async function actualizarProducto(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!id || !nombre) return

  const supabase = await createClient()
  const categoria_id = await idPorNombre(supabase, 'categorias', String(formData.get('categoria') ?? ''))
  const marca_id = await idPorNombre(supabase, 'marcas', String(formData.get('marca') ?? ''))

  const { error } = await supabase
    .from('productos')
    .update({
      nombre,
      codigo: String(formData.get('codigo') ?? '').trim() || null,
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      tipo: String(formData.get('tipo') ?? 'otro'),
      categoria_id,
      marca_id,
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
