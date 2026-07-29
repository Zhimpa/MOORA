import Link from 'next/link'

export default function SinAcceso() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-crema px-4">
      <div className="w-full max-w-sm rounded-panel border border-borde bg-papel p-7 text-center shadow-elevada">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-alerta-fondo text-lg font-bold text-alerta">
          !
        </div>
        <h1 className="titulo-editorial mb-2 text-xl text-tinta">
          No tienes acceso a esta sección
        </h1>
        <p className="mb-5 text-sm text-tinta-suave">
          Tu rol no incluye este módulo. Si crees que es un error, pídele al administrador que
          revise tu rol.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-campo bg-vino px-5 text-sm font-semibold text-crema hover:bg-vino-oscuro"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
