'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function crearAsesor(formData: FormData) {
  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) return

  const supabase = await createClient()
  const { error } = await supabase.from('asesores_venta').insert({
    nombre,
    telefono: String(formData.get('telefono') ?? '').trim() || null,
    notas: String(formData.get('notas') ?? '').trim() || null,
  })
  if (error) throw new Error(`No se pudo guardar el asesor: ${error.message}`)

  revalidatePath('/comisiones')
  revalidatePath('/ventas')
}

export async function actualizarAsesor(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!id || !nombre) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('asesores_venta')
    .update({
      nombre,
      telefono: String(formData.get('telefono') ?? '').trim() || null,
      notas: String(formData.get('notas') ?? '').trim() || null,
    })
    .eq('id', id)
  if (error) throw new Error(`No se pudo actualizar el asesor: ${error.message}`)

  revalidatePath('/comisiones')
  revalidatePath('/ventas')
}

// No se borra: se desactiva. Así no se pierde el historial de comisiones ya generadas.
export async function alternarAsesor(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const activo = String(formData.get('activo') ?? '') === 'true'
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('asesores_venta').update({ activo: !activo }).eq('id', id)
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)

  revalidatePath('/comisiones')
  revalidatePath('/ventas')
}
