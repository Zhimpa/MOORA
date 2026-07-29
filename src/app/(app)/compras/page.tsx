import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { Boton, Campo, EstadoDoc, Input, Select, Tabla, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { crearCompra } from './actions'

export const metadata = { title: 'Compras — MOORA' }

export default async function ComprasPage() {
  const perfil = await requerirRol('admin', 'almacen', 'contador')
  const supabase = await createClient()

  const [{ data: compras }, { data: proveedores }, { data: saldos }] = await Promise.all([
    supabase
      .from('compras')
      .select('id, numero_documento, fecha, total, estado, proveedores(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('v_cuentas_por_pagar').select('compra_id, saldo'),
  ])

  const saldoPorCompra = new Map((saldos ?? []).map((s) => [s.compra_id, Number(s.saldo)]))
  const puedeComprar = perfil.rol === 'admin' || perfil.rol === 'almacen'
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <TituloPagina titulo="Compras" descripcion="Mercadería que entra desde proveedores" />

      {puedeComprar && (
        <details className="mb-4">
          <summary className="cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            + Nueva compra
          </summary>
          <div className="mt-3">
            <Tarjeta>
              {proveedores && proveedores.length > 0 ? (
                <form action={crearCompra} className="grid gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Proveedor *">
                    <Select name="proveedor_id" required defaultValue="">
                      <option value="" disabled>Elige un proveedor…</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo etiqueta="N° de documento" ayuda="Factura o boleta del proveedor.">
                    <Input name="numero_documento" />
                  </Campo>
                  <Campo etiqueta="Fecha">
                    <Input name="fecha" type="date" defaultValue={hoy} />
                  </Campo>
                  <Campo etiqueta="Notas">
                    <TextArea name="notas" rows={1} />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Boton type="submit">Crear compra y agregar productos</Boton>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-gray-600">
                  Primero registra un proveedor en{' '}
                  <Link href="/proveedores" className="underline">Proveedores</Link>.
                </p>
              )}
            </Tarjeta>
          </div>
        </details>
      )}

      <Tarjeta>
        {compras && compras.length > 0 ? (
          <Tabla cabeceras={['Documento', 'Fecha', 'Proveedor', 'Total', 'Saldo', 'Estado', '']}>
            {compras.map((c) => {
              const saldo = saldoPorCompra.get(c.id) ?? 0
              const proveedor = (c.proveedores as unknown as { nombre: string } | null)?.nombre ?? '—'
              return (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{c.numero_documento ?? 'Sin N°'}</td>
                  <td className="px-3 py-2 text-gray-600">{fecha(c.fecha)}</td>
                  <td className="px-3 py-2">{proveedor}</td>
                  <td className="px-3 py-2 font-medium">{soles(c.total)}</td>
                  <td className="px-3 py-2">
                    {saldo > 0 ? (
                      <span className="font-medium text-red-600">{soles(saldo)}</span>
                    ) : c.estado === 'confirmada' ? (
                      <span className="text-green-700">Pagada</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><EstadoDoc estado={c.estado} /></td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/compras/${c.id}`} className="text-sm text-gray-600 underline">Abrir</Link>
                  </td>
                </tr>
              )
            })}
          </Tabla>
        ) : (
          <Vacio mensaje="Todavía no hay compras registradas." />
        )}
      </Tarjeta>
    </>
  )
}
