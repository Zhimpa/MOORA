'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Rol } from '@/lib/tipos'

type Enlace = { href: string; texto: string; roles: Rol[] }

// La UI solo esconde lo que no corresponde; el permiso real lo aplica el RLS.
const ENLACES: Enlace[] = [
  { href: '/', texto: 'Inicio', roles: ['admin', 'vendedor', 'almacen', 'contador'] },
  { href: '/ventas', texto: 'Ventas', roles: ['admin', 'vendedor', 'contador'] },
  { href: '/clientes', texto: 'Clientes', roles: ['admin', 'vendedor', 'contador'] },
  { href: '/productos', texto: 'Productos', roles: ['admin', 'vendedor', 'almacen', 'contador'] },
  { href: '/inventario', texto: 'Inventario', roles: ['admin', 'almacen', 'contador'] },
  { href: '/compras', texto: 'Compras', roles: ['admin', 'almacen', 'contador'] },
  { href: '/proveedores', texto: 'Proveedores', roles: ['admin', 'almacen', 'contador'] },
  { href: '/gastos', texto: 'Gastos', roles: ['admin', 'contador'] },
  { href: '/reportes', texto: 'Reportes', roles: ['admin', 'contador'] },
  { href: '/usuarios', texto: 'Usuarios', roles: ['admin'] },
]

export function Navegacion({ rol }: { rol: Rol }) {
  const ruta = usePathname()
  const visibles = ENLACES.filter((e) => e.roles.includes(rol))

  const activo = (href: string) =>
    href === '/' ? ruta === '/' : ruta.startsWith(href)

  return (
    <nav className="overflow-x-auto border-b border-gray-200 bg-white">
      <ul className="flex min-w-max gap-1 px-2 py-2 sm:px-4">
        {visibles.map((e) => (
          <li key={e.href}>
            <Link
              href={e.href}
              className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                activo(e.href)
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {e.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
