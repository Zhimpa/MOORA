import { createBrowserClient } from '@supabase/ssr'
import { configSupabase } from './config'

// Cliente para usar en componentes del lado del cliente (browser)
export function createClient() {
  const { url, anonKey } = configSupabase()
  return createBrowserClient(url, anonKey)
}
