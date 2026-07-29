// Lectura y validación de las variables de entorno de Supabase.
//
// Sin estas variables la app no puede hacer nada, y el error crudo que lanza
// @supabase/ssr ("Your project's URL and Key are required") se convierte en un
// "Internal Server Error" pelado que no dice qué arreglar. Aquí se detecta antes.
//
// Ojo: las NEXT_PUBLIC_* se incrustan en tiempo de BUILD. Si se agregan en
// Vercel después de un despliegue, hay que volver a desplegar para que existan.

export type ConfigSupabase = {
  url: string
  anonKey: string
}

/** true si falta alguna variable pública. Sirve para avisar sin lanzar. */
export function faltaConfigSupabase(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

/** Variables públicas validadas. Lanza un error explicando qué falta. */
export function configSupabase(): ConfigSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const faltantes = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean)

  if (faltantes.length > 0) {
    throw new Error(
      `Falta configurar ${faltantes.join(' y ')}. ` +
        'En local van en .env.local; en Vercel, en Project Settings → Environment Variables. ' +
        'Después de agregarlas en Vercel hay que volver a desplegar.'
    )
  }

  return { url: url!, anonKey: anonKey! }
}

/** Clave de servicio: solo servidor. Nunca debe llegar al navegador. */
export function claveServicio(): string {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) {
    throw new Error(
      'Falta configurar SUPABASE_SERVICE_ROLE_KEY. Es secreta y solo vive en el servidor.'
    )
  }
  return clave
}
