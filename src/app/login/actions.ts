'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type EstadoAuth = { error?: string; mensaje?: string }

export async function iniciarSesion(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirigir = String(formData.get('redirigir') ?? '/')

  if (!email || !password) {
    return { error: 'Ingresa tu correo y contraseña.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // No damos pistas sobre si el correo existe o no
    return { error: 'Correo o contraseña incorrectos.' }
  }

  revalidatePath('/', 'layout')
  redirect(redirigir.startsWith('/') ? redirigir : '/')
}

// Alta libre SOLO para arrancar el sistema (cuando todavía no existe ningún
// admin). Una vez que hay al menos un perfil, esta acción se niega aunque
// alguien la invoque directo, sin pasar por la UI.
export async function registrarse(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()

  if (!email || !password) return { error: 'Ingresa tu correo y contraseña.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }

  const supabase = await createClient()
  const { count } = await supabase.from('perfiles').select('id', { count: 'exact', head: true })
  if (count && count > 0) {
    return { error: 'El registro abierto está deshabilitado. Solicita acceso al administrador.' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre_completo: nombre || email } },
  })

  if (error) return { error: error.message }

  return {
    mensaje:
      'Cuenta creada. Si Supabase tiene activada la confirmación por correo, revisa tu bandeja antes de entrar.',
  }
}

// Cualquier visitante puede dejar una solicitud (sin contraseña). El admin
// la revisa desde /usuarios y, si la aprueba, Supabase le manda una
// invitación por correo para que ponga su propia contraseña.
export async function solicitarAcceso(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const telefono = String(formData.get('telefono') ?? '').trim()
  const mensaje = String(formData.get('mensaje') ?? '').trim()

  if (!nombre || !email) return { error: 'Ingresa tu nombre y correo.' }

  const supabase = await createClient()
  const { error } = await supabase.from('solicitudes_acceso').insert({
    nombre_completo: nombre,
    email,
    telefono: telefono || null,
    mensaje: mensaje || null,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya tienes una solicitud pendiente. El administrador la revisará pronto.' }
    }
    return { error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  return {
    mensaje: 'Solicitud enviada. El administrador la revisará y te contactará para darte acceso.',
  }
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
