'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

// Aprobar una solicitud: invita a la persona por correo (Supabase Auth crea
// la cuenta y le pide poner su propia contraseña) y le asigna el rol elegido.
export async function aprobarSolicitud(formData: FormData) {
  const admin = await requerirRol('admin')

  const id = String(formData.get('id') ?? '')
  const rol = String(formData.get('rol') ?? '')
  if (!id || !rol) return

  const supabase = await createClient()
  const { data: solicitud, error: errBusqueda } = await supabase
    .from('solicitudes_acceso')
    .select('*')
    .eq('id', id)
    .eq('estado', 'pendiente')
    .single()

  if (errBusqueda || !solicitud) {
    throw new Error('La solicitud ya no está pendiente o no existe.')
  }

  const admClient = createAdminClient()
  const { data: invitado, error: errInvitar } = await admClient.auth.admin.inviteUserByEmail(
    solicitud.email,
    { data: { nombre_completo: solicitud.nombre_completo } }
  )

  if (errInvitar || !invitado.user) {
    throw new Error(`No se pudo invitar a ${solicitud.email}: ${errInvitar?.message ?? 'error desconocido'}`)
  }

  // El trigger de alta crea el perfil como 'vendedor'; lo dejamos en el rol elegido.
  const { error: errRol } = await supabase
    .from('perfiles')
    .update({ rol })
    .eq('id', invitado.user.id)
  if (errRol) throw new Error(`Se invitó a la persona pero no se pudo asignar el rol: ${errRol.message}`)

  const { error: errSolicitud } = await supabase
    .from('solicitudes_acceso')
    .update({ estado: 'aprobada', revisado_por: admin.id, revisado_at: new Date().toISOString() })
    .eq('id', id)
  if (errSolicitud) throw new Error(`No se pudo marcar la solicitud como aprobada: ${errSolicitud.message}`)

  revalidatePath('/usuarios')
}

export async function rechazarSolicitud(formData: FormData) {
  const admin = await requerirRol('admin')

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('solicitudes_acceso')
    .update({ estado: 'rechazada', revisado_por: admin.id, revisado_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`No se pudo rechazar la solicitud: ${error.message}`)

  revalidatePath('/usuarios')
}
