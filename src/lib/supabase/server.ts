import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { configSupabase } from './config'

// Cliente para usar en Server Components y Server Actions
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = configSupabase()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Llamado desde Server Component; el proxy se encarga de refrescar la sesión
        }
      },
    },
  })
}
