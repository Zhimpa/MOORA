import { createClient } from '@supabase/supabase-js'
import { configSupabase, claveServicio } from './config'

// Cliente con service_role: bypasea RLS. Solo usar en rutas del servidor.
export function createAdminClient() {
  const { url } = configSupabase()

  return createClient(url, claveServicio(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
