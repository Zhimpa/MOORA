import FormularioLogin from './formulario'

export const metadata = { title: 'Ingresar — MOORA' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string; error?: string }>
}) {
  const params = await searchParams
  return <FormularioLogin redirigir={params.redirigir ?? '/'} errorInicial={params.error} />
}
