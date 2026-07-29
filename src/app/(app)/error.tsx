'use client'

import Link from 'next/link'
import { useEffect } from 'react'

// Los errores útiles vienen de las Server Actions y de Postgres:
// "Stock insuficiente: PX-100 (disponible 2, pedido 5)". Hay que mostrarlos, no esconderlos.
export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-panel border border-borde bg-papel p-7 shadow-tarjeta">
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-error-fondo text-lg font-bold text-error">
          !
        </div>

        <h1 className="titulo-editorial mb-2 text-xl text-tinta">No se pudo completar la acción</h1>

        <div className="mb-5 rounded-lg border-l-[3px] border-error bg-error-fondo px-4 py-3 text-sm text-tinta">
          {error.message || 'Ocurrió un error inesperado.'}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-campo bg-vino px-5 text-sm font-semibold text-crema hover:bg-vino-oscuro"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-campo border border-vino bg-papel px-5 text-sm font-semibold text-vino hover:bg-rosa-fondo"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
