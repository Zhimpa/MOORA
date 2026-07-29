'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-campo px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait'

const VARIANTES = {
  primario: 'bg-vino text-crema hover:bg-vino-oscuro',
  secundario: 'border border-vino bg-papel text-vino hover:bg-rosa-fondo',
  dorado: 'bg-dorado text-white hover:brightness-95',
  peligro: 'bg-error text-white hover:brightness-95',
} as const

// Botón de envío que se pone en "Guardando…" mientras corre la Server Action.
// Tiene que vivir dentro del <form> para que useFormStatus lo detecte.
export function BotonEnviar({
  children,
  variante = 'primario',
  className = '',
  pendienteTexto = 'Guardando…',
}: {
  children: ReactNode
  variante?: keyof typeof VARIANTES
  className?: string
  pendienteTexto?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${BASE} ${pending ? 'bg-vino-claro text-white' : VARIANTES[variante]} ${className}`}
    >
      {pending && (
        <span className="girando inline-block size-3.5 rounded-full border-2 border-white/50 border-t-white" />
      )}
      {pending ? pendienteTexto : children}
    </button>
  )
}
