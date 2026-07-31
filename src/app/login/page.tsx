import FormularioLogin from './formulario'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Ingresar — MOORA' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string; error?: string }>
}) {
  const params = await searchParams

  // Mientras no exista ningún perfil, se permite el alta libre para crear
  // al primer administrador. RLS le niega la lectura al anónimo, así que
  // esta comprobación necesita el cliente con service_role.
  const { count } = await createAdminClient()
    .from('perfiles')
    .select('id', { count: 'exact', head: true })
  const permitirRegistroInicial = !count || count === 0

  return (
    <FormularioLogin
      redirigir={params.redirigir ?? '/'}
      errorInicial={params.error}
      permitirRegistroInicial={permitirRegistroInicial}
    />
  )
}
