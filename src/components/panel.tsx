'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Panel lateral: reemplaza a los <details> para formularios           */
/* ------------------------------------------------------------------ */

export function Panel({
  etiqueta,
  titulo,
  descripcion,
  children,
  variante = 'primario',
}: {
  etiqueta: string
  titulo: string
  descripcion?: string
  children: ReactNode
  variante?: 'primario' | 'secundario'
}) {
  const [abierto, setAbierto] = useState(false)

  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('keydown', alPulsar)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto])

  const estiloBoton =
    variante === 'primario'
      ? 'bg-vino text-crema hover:bg-vino-oscuro'
      : 'border border-vino bg-papel text-vino hover:bg-rosa-fondo'

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-campo px-5 py-2.5 text-sm font-semibold transition-colors ${estiloBoton}`}
      >
        {etiqueta}
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-tinta/35"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className="flex h-full w-[min(440px,92vw)] flex-col bg-crema shadow-panel"
            onClick={(e) => e.stopPropagation()}
            // Al enviarse el formulario de dentro, el panel se cierra solo
            onSubmit={() => setAbierto(false)}
          >
            <header className="flex items-start justify-between gap-3 border-b border-borde px-5 py-4">
              <div>
                <h2 className="titulo-editorial text-xl text-tinta">{titulo}</h2>
                {descripcion && <p className="mt-0.5 text-xs text-tinta-suave">{descripcion}</p>}
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="-mr-1 flex size-9 items-center justify-center rounded-full text-xl text-tinta-suave hover:bg-borde-suave"
              >
                ×
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Confirmación de acciones irreversibles                              */
/* ------------------------------------------------------------------ */

export function ConfirmarAccion({
  etiqueta,
  titulo,
  mensaje,
  etiquetaConfirmar = 'Sí, confirmar',
  variante = 'dorado',
  children,
  className = '',
}: {
  etiqueta: string
  titulo: string
  mensaje: ReactNode
  etiquetaConfirmar?: string
  variante?: 'dorado' | 'peligro'
  /** El <form> con la Server Action. Se envía cuando el usuario acepta. */
  children: ReactNode
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [abierto])

  const enviar = () => {
    // El formulario va oculto: el botón visible es el del modal
    contenedor.current?.querySelector('form')?.requestSubmit()
    setAbierto(false)
  }

  const estiloDisparador =
    variante === 'dorado'
      ? 'bg-dorado text-white hover:brightness-95'
      : 'border border-error bg-papel text-error hover:bg-error-fondo'

  return (
    <>
      <div ref={contenedor} className="hidden">
        {children}
      </div>

      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`inline-flex min-h-11 items-center justify-center rounded-campo px-5 py-2.5 text-sm font-semibold transition-colors ${estiloDisparador} ${className}`}
      >
        {etiqueta}
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/45 p-5"
          onClick={() => setAbierto(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={titulo}
            className="w-[min(420px,100%)] rounded-panel bg-papel p-6 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mb-3.5 flex size-10 items-center justify-center rounded-full text-lg font-bold ${
                variante === 'dorado' ? 'bg-dorado-fondo text-dorado' : 'bg-error-fondo text-error'
              }`}
            >
              !
            </div>
            <h2 className="titulo-editorial mb-2 text-xl text-tinta">{titulo}</h2>
            <div className="mb-5 text-sm leading-relaxed text-tinta-media">{mensaje}</div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="min-h-11 flex-1 rounded-campo border border-vino bg-papel px-4 text-sm font-semibold text-vino hover:bg-rosa-fondo"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviar}
                className={`min-h-11 flex-1 rounded-campo px-4 text-sm font-semibold text-white ${
                  variante === 'dorado' ? 'bg-dorado' : 'bg-error'
                } hover:brightness-95`}
              >
                {etiquetaConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
