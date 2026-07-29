import { requerirPerfil } from '@/lib/auth'
import { cerrarSesion } from '@/app/login/actions'
import { BarraLateral, BarraInferior } from '@/components/navegacion'
import { ROLES } from '@/lib/tipos'

function BotonSalir({ className = '' }: { className?: string }) {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className={`min-h-11 w-full rounded-campo px-3 text-sm font-semibold transition-colors ${className}`}
      >
        Cerrar sesión
      </button>
    </form>
  )
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil()
  const rolLegible = ROLES.find((r) => r.valor === perfil.rol)?.etiqueta ?? perfil.rol
  const nombre = perfil.nombre_completo?.split(' ')[0] ?? 'Usuario'

  return (
    <div className="flex min-h-screen">
      <BarraLateral rol={perfil.rol} nombre={nombre} rolLegible={rolLegible}>
        <BotonSalir className="text-panel-item hover:bg-panel-icono" />
      </BarraLateral>

      <div className="min-w-0 flex-1">
        {/* Cabecera solo para celular: la barra lateral la reemplaza en escritorio */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-borde bg-crema/95 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="titulo-editorial text-xl leading-none text-tinta">MOORA</p>
            <p className="mt-1 text-xs text-tinta-suave">
              {nombre} · {rolLegible}
            </p>
          </div>
          <BotonSalir className="w-auto border border-borde bg-papel text-tinta-media" />
        </header>

        <main className="px-4 pb-24 pt-5 md:px-9 md:pb-10 md:pt-8">{children}</main>
      </div>

      <BarraInferior rol={perfil.rol} />
    </div>
  )
}
