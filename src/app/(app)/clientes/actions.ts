'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function datosCliente(formData: FormData) {
  const numeroDoc = String(formData.get('numero_documento') ?? '').trim()
  const tipoDoc = String(formData.get('tipo_documento') ?? '').trim()
  return {
    nombre: String(formData.get('nombre') ?? '').trim(),
    tipo: String(formData.get('tipo') ?? 'minorista'),
    tipo_documento: tipoDoc || null,
    numero_documento: numeroDoc || null,
    telefono: String(formData.get('telefono') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    direccion: String(formData.get('direccion') ?? '').trim() || null,
    limite_credito: Number(formData.get('limite_credito') ?? 0),
    notas: String(formData.get('notas') ?? '').trim() || null,
  }
}

export async function crearCliente(formData: FormData) {
  const datos = datosCliente(formData)
  if (!datos.nombre) return

  const supabase = await createClient()
  const { error } = await supabase.from('clientes').insert(datos)
  if (error) throw new Error(`No se pudo guardar el cliente: ${error.message}`)

  revalidatePath('/clientes')
}

export async function actualizarCliente(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const datos = datosCliente(formData)
  if (!id || !datos.nombre) return

  const supabase = await createClient()
  const { error } = await supabase.from('clientes').update(datos).eq('id', id)
  if (error) throw new Error(`No se pudo actualizar el cliente: ${error.message}`)

  revalidatePath('/clientes')
}

// No se borra: se desactiva. Así no se pierde el historial de ventas.
export async function alternarCliente(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const activo = String(formData.get('activo') ?? '') === 'true'
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('clientes').update({ activo: !activo }).eq('id', id)
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)

  revalidatePath('/clientes')
}
