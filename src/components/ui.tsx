// Componentes de interfaz mínimos y reutilizables.
// Estilo deliberadamente simple: primero que funcione, el diseño viene después.
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

export function Tarjeta({
  titulo,
  children,
  accion,
}: {
  titulo?: string
  children: ReactNode
  accion?: ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      {(titulo || accion) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          {titulo && <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>}
          {accion}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Kpi({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string
  valor: string
  detalle?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-gray-500">{detalle}</p>}
    </div>
  )
}

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ComponentProps<'button'> & { variante?: 'primario' | 'secundario' | 'peligro' }) {
  const estilos = {
    primario: 'bg-gray-900 text-white hover:bg-gray-700',
    secundario: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    peligro: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variante]

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${estilos} ${className}`}
    />
  )
}

export function BotonLink({
  href,
  children,
  variante = 'primario',
}: {
  href: string
  children: ReactNode
  variante?: 'primario' | 'secundario'
}) {
  const estilos =
    variante === 'primario'
      ? 'bg-gray-900 text-white hover:bg-gray-700'
      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${estilos}`}
    >
      {children}
    </Link>
  )
}

export function Campo({
  etiqueta,
  children,
  ayuda,
}: {
  etiqueta: string
  children: ReactNode
  ayuda?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-gray-500">{ayuda}</span>}
    </label>
  )
}

const claseControl =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none'

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input {...props} className={`${claseControl} ${className}`} />
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select {...props} className={`${claseControl} ${className}`} />
}

export function TextArea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={`${claseControl} ${className}`} />
}

export function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            {cabeceras.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="py-8 text-center text-sm text-gray-500">{mensaje}</p>
}

export function Etiqueta({
  texto,
  tono = 'gris',
}: {
  texto: string
  tono?: 'gris' | 'verde' | 'ambar' | 'rojo'
}) {
  const tonos = {
    gris: 'bg-gray-100 text-gray-700',
    verde: 'bg-green-100 text-green-800',
    ambar: 'bg-amber-100 text-amber-800',
    rojo: 'bg-red-100 text-red-800',
  }[tono]
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tonos}`}>{texto}</span>
  )
}

export function EstadoDoc({ estado }: { estado: string }) {
  const tono = estado === 'confirmada' ? 'verde' : estado === 'anulada' ? 'rojo' : 'ambar'
  const texto = estado === 'confirmada' ? 'Confirmada' : estado === 'anulada' ? 'Anulada' : 'Borrador'
  return <Etiqueta texto={texto} tono={tono} />
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok'; children: ReactNode }) {
  const estilo =
    tipo === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-green-200 bg-green-50 text-green-700'
  return <div className={`rounded-md border px-3 py-2 text-sm ${estilo}`}>{children}</div>
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{titulo}</h1>
        {descripcion && <p className="text-sm text-gray-500">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}
