import Link from 'next/link'

export default function SinAcceso() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-gray-900">No tienes acceso a esta sección</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tu rol no incluye este módulo. Si crees que es un error, pídele al administrador que
          revise tu rol.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
