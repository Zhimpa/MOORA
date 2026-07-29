import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { configSupabase, faltaConfigSupabase } from './config'

// Rutas que se pueden ver sin haber iniciado sesión
const RUTAS_PUBLICAS = ['/login', '/auth', '/configuracion-requerida']

// Refresca el token de Supabase en cada request y protege las rutas privadas.
// Se llama desde proxy.ts (en Next 16 el antiguo middleware.ts se llama así).
export async function actualizarSesion(request: NextRequest) {
  const ruta = request.nextUrl.pathname

  // Sin variables de entorno no se puede crear el cliente. Antes esto lanzaba
  // en cada request y devolvía "Internal Server Error" en toda la app; ahora
  // manda a una pantalla que explica qué falta configurar.
  if (faltaConfigSupabase()) {
    if (ruta === '/configuracion-requerida') return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = '/configuracion-requerida'
    url.search = ''
    return NextResponse.rewrite(url)
  }

  let response = NextResponse.next({ request })
  const { url: urlSupabase, anonKey } = configSupabase()

  const supabase = createServerClient(urlSupabase, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser() valida el token contra Supabase; getSession() solo lee la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const esPublica = RUTAS_PUBLICAS.some((r) => ruta.startsWith(r))

  if (!user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirigir', ruta)
    return NextResponse.redirect(url)
  }

  if (user && ruta === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
