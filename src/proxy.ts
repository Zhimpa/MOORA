import type { NextRequest } from 'next/server'
import { actualizarSesion } from '@/lib/supabase/session'

// En Next.js 16 el archivo middleware.ts pasó a llamarse proxy.ts.
export async function proxy(request: NextRequest) {
  return await actualizarSesion(request)
}

export const config = {
  // Excluye estáticos e imágenes: si no, el redirect a /login bloquearía el CSS.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
