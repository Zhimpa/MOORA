'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function almacenPorDefecto(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('almacenes').select('id').eq('activo', true).limit(1).single()
  if (!data) throw new Error('No hay ningún almacén configurado.')
  return data.id as string
}

// Crea la venta en borrador y lleva a la pantalla de detalle para cargarle productos.
export async function crearVenta(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const clienteId = String(formData.get('cliente_id') ?? '')
  const almacen_id = await almacenPorDefecto(supabase)

  const { data, error } = await supabase
    .from('ventas')
    .insert({
      cliente_id: clienteId || null,
      almacen_id,
      tipo: String(formData.get('tipo') ?? 'minorista'),
      fecha: String(formData.get('fecha') ?? '') || new Date().toISOString().slice(0, 10),
      notas: String(formData.get('notas') ?? '').trim() || null,
      usuario_id: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo crear la venta: ${error.message}`)

  redirect(`/ventas/${data.id}`)
}

export async function agregarItemVenta(formData: FormData) {
  const venta_id = String(formData.get('venta_id') ?? '')
  const variante_id = String(formData.get('variante_id') ?? '')
  const cantidad = Number(formData.get('cantidad') ?? 0)
  let precio = Number(formData.get('precio_unitario') ?? 0)

  if (!venta_id || !variante_id || cantidad <= 0) return

  const supabase = await createClient()

  // Si no escribieron precio, se toma el de lista según el tipo de venta
  if (!precio || precio <= 0) {
    const { data: venta } = await supabase.from('ventas').select('tipo').eq('id', venta_id).single()
    const { data: variante } = await supabase
      .from('variantes')
      .select('precio_venta_menor, precio_venta_mayor')
      .eq('id', variante_id)
      .single()
    precio =
      venta?.tipo === 'mayorista'
        ? Number(variante?.precio_venta_mayor ?? 0)
        : Number(variante?.precio_venta_menor ?? 0)
  }

  const { error } = await supabase
    .from('venta_items')
    .insert({ venta_id, variante_id, cantidad, precio_unitario: precio })
  if (error) throw new Error(`No se pudo agregar el producto: ${error.message}`)

  await supabase.rpc('recalcular_total_venta', { p_venta_id: venta_id })
  revalidatePath(`/ventas/${venta_id}`)
}

export async function quitarItemVenta(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const venta_id = String(formData.get('venta_id') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('venta_items').delete().eq('id', id)
  if (error) throw new Error(`No se pudo quitar el producto: ${error.message}`)

  await supabase.rpc('recalcular_total_venta', { p_venta_id: venta_id })
  revalidatePath(`/ventas/${venta_id}`)
}

export async function aplicarDescuentoVenta(formData: FormData) {
  const venta_id = String(formData.get('venta_id') ?? '')
  const descuento = Number(formData.get('descuento') ?? 0)
  if (!venta_id) return

  const supabase = await createClient()
  const { error } = await supabase.from('ventas').update({ descuento }).eq('id', venta_id)
  if (error) throw new Error(`No se pudo aplicar el descuento: ${error.message}`)

  await supabase.rpc('recalcular_total_venta', { p_venta_id: venta_id })
  revalidatePath(`/ventas/${venta_id}`)
}

// Confirmar descarga inventario. A partir de aquí la venta ya no se edita.
export async function confirmarVenta(formData: FormData) {
  const venta_id = String(formData.get('venta_id') ?? '')
  if (!venta_id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('confirmar_venta', { p_venta_id: venta_id })
  if (error) throw new Error(error.message)

  revalidatePath(`/ventas/${venta_id}`)
  revalidatePath('/ventas')
  revalidatePath('/inventario')
  revalidatePath('/')
}

export async function anularVenta(formData: FormData) {
  const venta_id = String(formData.get('venta_id') ?? '')
  const motivo = String(formData.get('motivo') ?? '').trim() || null
  if (!venta_id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('anular_venta', { p_venta_id: venta_id, p_motivo: motivo })
  if (error) throw new Error(error.message)

  revalidatePath(`/ventas/${venta_id}`)
  revalidatePath('/ventas')
  revalidatePath('/inventario')
}

export async function registrarPagoVenta(formData: FormData) {
  const venta_id = String(formData.get('venta_id') ?? '')
  const monto = Number(formData.get('monto') ?? 0)
  if (!venta_id || monto <= 0) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('pagos_venta').insert({
    venta_id,
    monto,
    metodo: String(formData.get('metodo') ?? 'efectivo'),
    fecha: String(formData.get('fecha') ?? '') || new Date().toISOString().slice(0, 10),
    referencia: String(formData.get('referencia') ?? '').trim() || null,
    usuario_id: user?.id ?? null,
  })
  if (error) throw new Error(`No se pudo registrar el pago: ${error.message}`)

  revalidatePath(`/ventas/${venta_id}`)
  revalidatePath('/ventas')
  revalidatePath('/reportes')
}
