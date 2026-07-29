import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { Boton, Campo, EstadoDoc, Input, Select, Tabla, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { crearVenta } from './actions'

export const metadata = { title: 'Ventas — MOORA' }

export default async function VentasPage() {
  const perfil = await requerirRol('admin', 'vendedor', 'contador')
  const supabase = await createClient()

  const [{ data: ventas }, { data: clientes }, { data: saldos }] = await Promise.all([
    supabase
      .from('ventas')
      .select('id, numero, fecha, total, estado, tipo, clientes(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('clientes').select('id, nombre, tipo').eq('activo', true).order('nombre'),
    supabase.from('v_cuentas_por_cobrar').select('venta_id, saldo'),
  ])

  const saldoPorVenta = new Map((saldos ?? []).map((s) => [s.venta_id, Number(s.saldo)]))
  const puedeVender = perfil.rol === 'admin' || perfil.rol === 'vendedor'
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <TituloPagina titulo="Ventas" descripcion="Últimas 100 ventas registradas" />

      {puedeVender && (
        <details className="mb-4">
          <summary className="cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            + Nueva venta
          </summary>
          <div className="mt-3">
            <Tarjeta>
              <form action={crearVenta} className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Cliente" ayuda="Déjalo vacío si es venta de mostrador.">
                  <Select name="cliente_id" defaultValue="">
                    <option value="">— Mostrador —</option>
                    {clientes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.tipo})
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo etiqueta="Tipo de precio">
                  <Select name="tipo" defaultValue="minorista">
                    <option value="minorista">Por menor</option>
                    <option value="mayorista">Por mayor</option>
                  </Select>
                </Campo>
                <Campo etiqueta="Fecha">
                  <Input name="fecha" type="date" defaultValue={hoy} />
                </Campo>
                <Campo etiqueta="Notas">
                  <TextArea name="notas" rows={1} />
                </Campo>
                <div className="sm:col-span-2">
                  <Boton type="submit">Crear venta y agregar productos</Boton>
                </div>
              </form>
            </Tarjeta>
          </div>
        </details>
      )}

      <Tarjeta>
        {ventas && ventas.length > 0 ? (
          <Tabla cabeceras={['N°', 'Fecha', 'Cliente', 'Total', 'Saldo', 'Estado', '']}>
            {ventas.map((v) => {
              const saldo = saldoPorVenta.get(v.id) ?? 0
              const cliente = (v.clientes as unknown as { nombre: string } | null)?.nombre ?? 'Mostrador'
              return (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{v.numero}</td>
                  <td className="px-3 py-2 text-gray-600">{fecha(v.fecha)}</td>
                  <td className="px-3 py-2">{cliente}</td>
                  <td className="px-3 py-2 font-medium">{soles(v.total)}</td>
                  <td className="px-3 py-2">
                    {saldo > 0 ? (
                      <span className="font-medium text-red-600">{soles(saldo)}</span>
                    ) : v.estado === 'confirmada' ? (
                      <span className="text-green-700">Pagada</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><EstadoDoc estado={v.estado} /></td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/ventas/${v.id}`} className="text-sm text-gray-600 underline">
                      Abrir
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Tabla>
        ) : (
          <Vacio mensaje="Todavía no hay ventas registradas." />
        )}
      </Tarjeta>
    </>
  )
}
