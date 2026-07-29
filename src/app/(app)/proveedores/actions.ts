'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function datosProveedor(formData: FormData) {
  return {
    nombre: String(formData.get('nombre') ?? '').trim(),
    ruc: String(formData.get('ruc') ?? '').trim() || null,
    contacto: String(formData.get('contacto') ?? '').trim() || null,
    telefono: String(formData.get('telefono') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    direccion: String(formData.get('direccion') ?? '').trim() || null,
    notas: String(formData.get('notas') ?? '').trim() || null,
  }
}

export async function crearProveedor(formData: FormData) {
  const datos = datosProveedor(formData)
  if (!datos.nombre) return

  const supabase = await createClient()
  const { error } = await supabase.from('proveedores').insert(datos)
  if (error) throw new Error(`No se pudo guardar el proveedor: ${error.message}`)

  revalidatePath('/proveedores')
}

export async function actualizarProveedor(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const datos = datosProveedor(formData)
  if (!id || !datos.nombre) return

  const supabase = await createClient()
  const { error } = await supabase.from('proveedores').update(datos).eq('id', id)
  if (error) throw new Error(`No se pudo actualizar el proveedor: ${error.message}`)

  revalidatePath('/proveedores')
}

export async function alternarProveedor(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const activo = String(formData.get('activo') ?? '') === 'true'
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('proveedores').update({ activo: !activo }).eq('id', id)
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)

  revalidatePath('/proveedores')
}
