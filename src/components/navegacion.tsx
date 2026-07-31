'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Rol } from '@/lib/tipos'

type Enlace = { href: string; texto: string; inicial: string; roles: Rol[] }

// La UI solo esconde lo que no corresponde; el permiso real lo aplica el RLS.
const ENLACES: Enlace[] = [
  { href: '/', texto: 'Inicio', inicial: 'I', roles: ['admin', 'vendedor', 'almacen', 'contador'] },
  { href: '/ventas', texto: 'Ventas', inicial: 'V', roles: ['admin', 'vendedor', 'contador'] },
  { href: '/vendedores', texto: 'Vendedores', inicial: 'A', roles: ['admin', 'vendedor', 'contador'] },
  { href: '/comisiones', texto: 'Comisiones', inicial: 'C', roles: ['admin', 'contador'] },
  { href: '/productos', texto: 'Productos', inicial: 'P', roles: ['admin', 'vendedor', 'almacen', 'contador'] },
  { href: '/inventario', texto: 'Inventario', inicial: 'S', roles: ['admin', 'almacen', 'contador'] },
  { href: '/compras', texto: 'Compras', inicial: 'M', roles: ['admin', 'almacen', 'contador'] },
  { href: '/proveedores', texto: 'Proveedores', inicial: 'R', roles: ['admin', 'almacen', 'contador'] },
  { href: '/gastos', texto: 'Gastos', inicial: 'G', roles: ['admin', 'contador'] },
  { href: '/reportes', texto: 'Reportes', inicial: 'F', roles: ['admin', 'contador'] },
  { href: '/usuarios', texto: 'Usuarios', inicial: 'U', roles: ['admin'] },
]

function estaActivo(ruta: string, href: string) {
  return href === '/' ? ruta === '/' : ruta.startsWith(href)
}

/* ------------------------------------------------------------------ */
/* Escritorio: barra lateral oscura fija                               */
/* ------------------------------------------------------------------ */

export function BarraLateral({
  rol,
  nombre,
  rolLegible,
  children,
}: {
  rol: Rol
  nombre: string
  rolLegible: string
  children: React.ReactNode
}) {
  const ruta = usePathname()
  const visibles = ENLACES.filter((e) => e.roles.includes(rol))

  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col gap-0.5 bg-panel-oscuro px-3.5 py-5 md:flex">
      <div className="titulo-editorial mb-5 px-2 text-xl text-crema">MOORA</div>

      <nav className="flex flex-col gap-0.5">
        {visibles.map((e) => {
          const activo = estaActivo(ruta, e.href)
          return (
            <Link
              key={e.href}
              href={e.href}
              aria-current={activo ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
                activo
                  ? 'bg-vino font-bold text-crema'
                  : 'font-medium text-panel-item hover:bg-panel-icono'
              }`}
            >
              <span
                className={`flex size-[22px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-crema ${
                  activo ? 'bg-dorado' : 'bg-panel-icono'
                }`}
              >
                {e.inicial}
              </span>
              {e.texto}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />
      <div className="px-2 py-2 text-xs text-tinta-tenue">
        {nombre} — {rolLegible}
      </div>
      {children}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Móvil: barra inferior fija con los 4 accesos principales + "Más"    */
/* ------------------------------------------------------------------ */

export function BarraInferior({ rol }: { rol: Rol }) {
  const ruta = usePathname()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const visibles = ENLACES.filter((e) => e.roles.includes(rol))

  const principales = visibles.slice(0, 4)
  const resto = visibles.slice(4)

  return (
    <>
      {menuAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-tinta/35 md:hidden"
          onClick={() => setMenuAbierto(false)}
        >
          <div
            className="w-full rounded-t-panel bg-papel p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="titulo-editorial mb-4 text-xl">Todo el menú</div>
            <div className="grid grid-cols-2 gap-2">
              {resto.map((e) => (
                <Link
                  key={e.href}
                  href={e.href}
                  onClick={() => setMenuAbierto(false)}
                  className="flex min-h-11 items-center gap-2.5 rounded-xl border border-borde px-3 text-sm font-semibold text-tinta"
                >
                  <span className="flex size-7 items-center justify-center rounded-lg bg-borde-suave text-[11px] font-bold text-tinta-suave">
                    {e.inicial}
                  </span>
                  {e.texto}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-borde bg-papel px-1 pb-2.5 pt-1.5 md:hidden">
        {principales.map((e) => {
          const activo = estaActivo(ruta, e.href)
          return (
            <Link
              key={e.href}
              href={e.href}
              aria-current={activo ? 'page' : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 ${
                activo ? 'text-vino' : 'text-tinta-suave'
              }`}
            >
              <span
                className={`flex size-[26px] items-center justify-center rounded-lg text-xs font-bold ${
                  activo ? 'bg-vino text-crema' : 'bg-borde-suave text-tinta-suave'
                }`}
              >
                {e.inicial}
              </span>
              <span className="text-[11px] font-semibold">{e.texto}</span>
            </Link>
          )
        })}

        {resto.length > 0 && (
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-tinta-suave"
          >
            <span className="flex size-[26px] items-center justify-center rounded-lg bg-borde-suave text-xs font-bold text-tinta-suave">
              +
            </span>
            <span className="text-[11px] font-semibold">Más</span>
          </button>
        )}
      </nav>
    </>
  )
}
