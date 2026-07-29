import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil, Rol } from '@/lib/tipos'

// Usuario + perfil (rol) de la sesión actual. null si no hay sesión.
export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, rol, activo, created_at')
    .eq('id', user.id)
    .single()

  return (data as Perfil) ?? null
}

// Para páginas privadas: corta el render y manda al login si no hay sesión.
export async function requerirPerfil(): Promise<Perfil> {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')
  if (!perfil.activo) redirect('/login?error=inactivo')
  return perfil
}

// Segunda barrera en la UI. La barrera real es el RLS en la base de datos.
export async function requerirRol(...roles: Rol[]): Promise<Perfil> {
  const perfil = await requerirPerfil()
  if (!roles.includes(perfil.rol)) redirect('/sin-acceso')
  return perfil
}

export function puede(rol: Rol, ...permitidos: Rol[]): boolean {
  return permitidos.includes(rol)
}
