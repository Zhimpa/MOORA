// Componentes presentacionales de MOORA.
// Todos son seguros en servidor: lo interactivo vive en panel.tsx y boton-enviar.tsx.
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Contenedores                                                        */
/* ------------------------------------------------------------------ */

export function Tarjeta({
  titulo,
  children,
  accion,
  sinRelleno = false,
}: {
  titulo?: string
  children: ReactNode
  accion?: ReactNode
  sinRelleno?: boolean
}) {
  return (
    <section className="rounded-panel border border-borde bg-papel shadow-tarjeta">
      {(titulo || accion) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          {titulo && <h2 className="titulo-editorial text-lg text-tinta">{titulo}</h2>}
          {accion}
        </header>
      )}
      <div className={sinRelleno ? '' : 'px-5 pb-5 pt-0 first:pt-5'}>{children}</div>
    </section>
  )
}

export function TituloPagina({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="titulo-editorial text-2xl text-tinta sm:text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-tinta-suave">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Indicadores                                                         */
/* ------------------------------------------------------------------ */

export function Kpi({
  etiqueta,
  valor,
  detalle,
  tono = 'neutro',
}: {
  etiqueta: string
  valor: string
  detalle?: string
  tono?: 'neutro' | 'alerta' | 'error' | 'exito'
}) {
  const colorValor = {
    neutro: 'text-tinta',
    alerta: 'text-alerta',
    error: 'text-error',
    exito: 'text-exito',
  }[tono]

  return (
    <div className="rounded-tarjeta border border-borde bg-papel p-4 shadow-tarjeta sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">{etiqueta}</p>
      <p className={`cifra mt-2 text-2xl font-bold ${colorValor}`}>{valor}</p>
      {detalle && <p className="mt-1.5 text-xs font-semibold text-dorado">{detalle}</p>}
    </div>
  )
}

export function Etiqueta({
  texto,
  tono = 'gris',
}: {
  texto: string
  tono?: 'gris' | 'verde' | 'ambar' | 'rojo' | 'dorado' | 'vino'
}) {
  const tonos = {
    gris: 'bg-borde-suave text-tinta-media',
    verde: 'bg-exito-fondo text-exito',
    ambar: 'bg-alerta-fondo text-alerta',
    rojo: 'bg-error-fondo text-error',
    dorado: 'bg-dorado-fondo text-dorado',
    vino: 'bg-vino text-crema',
  }[tono]

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${tonos}`}>
      {texto}
    </span>
  )
}

export function EstadoDoc({ estado }: { estado: string }) {
  const tono = estado === 'confirmada' ? 'verde' : estado === 'anulada' ? 'rojo' : 'gris'
  const texto =
    estado === 'confirmada' ? 'Confirmada' : estado === 'anulada' ? 'Anulada' : 'Borrador'
  return <Etiqueta texto={texto} tono={tono} />
}

export function Aviso({
  tipo = 'error',
  children,
}: {
  tipo?: 'error' | 'ok' | 'alerta'
  children: ReactNode
}) {
  const estilo = {
    error: { caja: 'bg-error-fondo border-error', punto: 'bg-error' },
    ok: { caja: 'bg-exito-fondo border-exito', punto: 'bg-exito' },
    alerta: { caja: 'bg-alerta-fondo border-alerta', punto: 'bg-alerta' },
  }[tipo]

  return (
    <div className={`flex items-start gap-2.5 rounded-[10px] border-l-[3px] px-4 py-3 ${estilo.caja}`}>
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${estilo.punto}`} />
      <div className="text-sm leading-relaxed text-tinta">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

const BASE_BOTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-campo px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const VARIANTES = {
  primario: 'bg-vino text-crema hover:bg-vino-oscuro',
  secundario: 'border border-vino bg-papel text-vino hover:bg-rosa-fondo',
  // Dorado: solo para lo irreversible (confirmar una venta, saldar una deuda)
  dorado: 'bg-dorado text-white hover:brightness-95',
  fantasma: 'text-tinta-media hover:bg-borde-suave',
  peligro: 'bg-error text-white hover:brightness-95',
} as const

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ComponentProps<'button'> & { variante?: keyof typeof VARIANTES }) {
  return <button {...props} className={`${BASE_BOTON} ${VARIANTES[variante]} ${className}`} />
}

export function BotonLink({
  href,
  children,
  variante = 'primario',
  className = '',
}: {
  href: string
  children: ReactNode
  variante?: keyof typeof VARIANTES
  className?: string
}) {
  return (
    <Link href={href} className={`${BASE_BOTON} ${VARIANTES[variante]} ${className}`}>
      {children}
    </Link>
  )
}

export function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-semibold text-vino underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Formularios                                                         */
/* ------------------------------------------------------------------ */

export function Campo({
  etiqueta,
  children,
  ayuda,
  error,
}: {
  etiqueta: string
  children: ReactNode
  ayuda?: string
  error?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-tinta-media">{etiqueta}</span>
      {children}
      {error && <span className="text-xs text-error">{error}</span>}
      {ayuda && !error && <span className="text-xs text-tinta-suave">{ayuda}</span>}
    </label>
  )
}

const CONTROL =
  'w-full min-h-11 rounded-campo border border-borde bg-papel px-3 py-2.5 text-sm text-tinta placeholder:text-tinta-tenue focus:border-vino focus:outline-none'

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input {...props} className={`${CONTROL} ${className}`} />
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select {...props} className={`${CONTROL} ${className}`} />
}

export function TextArea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={`${CONTROL} ${className}`} />
}

/* ------------------------------------------------------------------ */
/* Tablas — en móvil cada fila se muestra como tarjeta                 */
/* ------------------------------------------------------------------ */

export function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-borde text-left">
            {cabeceras.map((c) => (
              <th
                key={c}
                className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-suave"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Fila({ children }: { children: ReactNode }) {
  return <tr className="border-b border-borde-suave last:border-0">{children}</tr>
}

/** Envuelve una tabla para que solo aparezca en pantallas medianas hacia arriba. */
export function SoloEscritorio({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>
}

/** Lista de tarjetas que reemplaza a la tabla en el celular. */
export function SoloMovil({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 md:hidden">{children}</div>
}

export function TarjetaFila({
  titulo,
  subtitulo,
  derecha,
  filas,
  href,
}: {
  titulo: ReactNode
  subtitulo?: ReactNode
  derecha?: ReactNode
  filas?: { etiqueta: string; valor: ReactNode }[]
  href?: string
}) {
  const contenido = (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-tinta">{titulo}</div>
          {subtitulo && <div className="truncate text-xs text-tinta-suave">{subtitulo}</div>}
        </div>
        {derecha}
      </div>
      {filas?.map((f) => (
        <div key={f.etiqueta} className="flex justify-between gap-3 py-0.5 text-sm">
          <span className="text-tinta-suave">{f.etiqueta}</span>
          <span className="cifra font-semibold text-tinta">{f.valor}</span>
        </div>
      ))}
    </>
  )

  const clases = 'block rounded-xl border border-borde bg-papel p-4 text-left'
  return href ? (
    <Link href={href} className={clases}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}

/* ------------------------------------------------------------------ */
/* Estados vacíos y de carga                                           */
/* ------------------------------------------------------------------ */

export function Vacio({
  mensaje,
  descripcion,
  accion,
}: {
  mensaje: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <div className="rounded-panel border border-dashed border-borde px-6 py-10 text-center">
      <div className="mx-auto mb-4 size-11 rounded-full bg-rosa-fondo" />
      <p className="font-semibold text-tinta">{mensaje}</p>
      {descripcion && <p className="mx-auto mt-1.5 max-w-sm text-sm text-tinta-suave">{descripcion}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  )
}

export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`esqueleto ${className}`} />
}
