import { requerirPerfil } from '@/lib/auth'
import { cerrarSesion } from '@/app/login/actions'
import { Navegacion } from '@/components/navegacion'
import { ROLES } from '@/lib/tipos'

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil()
  const rolLegible = ROLES.find((r) => r.valor === perfil.rol)?.etiqueta ?? perfil.rol

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-base font-bold tracking-tight">MOORA</p>
            <p className="text-xs text-gray-500">
              {perfil.nombre_completo ?? 'Usuario'} · {rolLegible}
            </p>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Salir
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-6xl">
          <Navegacion rol={perfil.rol} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
