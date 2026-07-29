'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function almacenPorDefecto(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('almacenes').select('id').eq('activo', true).limit(1).single()
  if (!data) throw new Error('No hay ningún almacén configurado.')
  return data.id as string
}

export async function crearCompra(formData: FormData) {
  const proveedor_id = String(formData.get('proveedor_id') ?? '')
  if (!proveedor_id) throw new Error('Elige un proveedor.')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const almacen_id = await almacenPorDefecto(supabase)

  const { data, error } = await supabase
    .from('compras')
    .insert({
      proveedor_id,
      almacen_id,
      numero_documento: String(formData.get('numero_documento') ?? '').trim() || null,
      fecha: String(formData.get('fecha') ?? '') || new Date().toISOString().slice(0, 10),
      notas: String(formData.get('notas') ?? '').trim() || null,
      usuario_id: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo crear la compra: ${error.message}`)

  redirect(`/compras/${data.id}`)
}

export async function agregarItemCompra(formData: FormData) {
  const compra_id = String(formData.get('compra_id') ?? '')
  const variante_id = String(formData.get('variante_id') ?? '')
  const cantidad = Number(formData.get('cantidad') ?? 0)
  const costo_unitario = Number(formData.get('costo_unitario') ?? 0)

  if (!compra_id || !variante_id || cantidad <= 0) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('compra_items')
    .insert({ compra_id, variante_id, cantidad, costo_unitario })
  if (error) throw new Error(`No se pudo agregar el producto: ${error.message}`)

  await supabase.rpc('recalcular_total_compra', { p_compra_id: compra_id })
  revalidatePath(`/compras/${compra_id}`)
}

export async function quitarItemCompra(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const compra_id = String(formData.get('compra_id') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('compra_items').delete().eq('id', id)
  if (error) throw new Error(`No se pudo quitar el producto: ${error.message}`)

  await supabase.rpc('recalcular_total_compra', { p_compra_id: compra_id })
  revalidatePath(`/compras/${compra_id}`)
}

export async function aplicarDescuentoCompra(formData: FormData) {
  const compra_id = String(formData.get('compra_id') ?? '')
  const descuento = Number(formData.get('descuento') ?? 0)
  if (!compra_id) return

  const supabase = await createClient()
  const { error } = await supabase.from('compras').update({ descuento }).eq('id', compra_id)
  if (error) throw new Error(`No se pudo aplicar el descuento: ${error.message}`)

  await supabase.rpc('recalcular_total_compra', { p_compra_id: compra_id })
  revalidatePath(`/compras/${compra_id}`)
}

// Confirmar ingresa el stock y recalcula el costo promedio de cada variante.
export async function confirmarCompra(formData: FormData) {
  const compra_id = String(formData.get('compra_id') ?? '')
  if (!compra_id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('confirmar_compra', { p_compra_id: compra_id })
  if (error) throw new Error(error.message)

  revalidatePath(`/compras/${compra_id}`)
  revalidatePath('/compras')
  revalidatePath('/inventario')
  revalidatePath('/')
}

export async function anularCompra(formData: FormData) {
  const compra_id = String(formData.get('compra_id') ?? '')
  const motivo = String(formData.get('motivo') ?? '').trim() || null
  if (!compra_id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('anular_compra', { p_compra_id: compra_id, p_motivo: motivo })
  if (error) throw new Error(error.message)

  revalidatePath(`/compras/${compra_id}`)
  revalidatePath('/compras')
  revalidatePath('/inventario')
}

export async function registrarPagoCompra(formData: FormData) {
  const compra_id = String(formData.get('compra_id') ?? '')
  const monto = Number(formData.get('monto') ?? 0)
  if (!compra_id || monto <= 0) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('pagos_compra').insert({
    compra_id,
    monto,
    metodo: String(formData.get('metodo') ?? 'efectivo'),
    fecha: String(formData.get('fecha') ?? '') || new Date().toISOString().slice(0, 10),
    referencia: String(formData.get('referencia') ?? '').trim() || null,
    usuario_id: user?.id ?? null,
  })
  if (error) throw new Error(`No se pudo registrar el pago: ${error.message}`)

  revalidatePath(`/compras/${compra_id}`)
  revalidatePath('/compras')
}
