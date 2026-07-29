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

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
