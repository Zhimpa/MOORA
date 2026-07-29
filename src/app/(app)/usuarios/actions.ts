'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'

// Cambiar roles es la operación más sensible del sistema.
// Se valida el rol del que la pide aquí Y en el RLS de la tabla perfiles.
export async function cambiarRol(formData: FormData) {
  const admin = await requerirRol('admin')

  const id = String(formData.get('id') ?? '')
  const rol = String(formData.get('rol') ?? '')
  if (!id || !rol) return

  if (id === admin.id) {
    throw new Error('No puedes cambiar tu propio rol. Pídeselo a otro administrador.')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('perfiles').update({ rol }).eq('id', id)
  if (error) throw new Error(`No se pudo cambiar el rol: ${error.message}`)

  revalidatePath('/usuarios')
}

export async function alternarUsuario(formData: FormData) {
  const admin = await requerirRol('admin')

  const id = String(formData.get('id') ?? '')
  const activo = String(formData.get('activo') ?? '') === 'true'
  if (!id) return

  if (id === admin.id) {
    throw new Error('No puedes desactivar tu propia cuenta.')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('perfiles').update({ activo: !activo }).eq('id', id)
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)

  revalidatePath('/usuarios')
}
