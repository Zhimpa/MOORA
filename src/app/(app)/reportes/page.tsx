import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero, fecha, mesLargo } from '@/lib/format'
import { Etiqueta, Kpi, Tarjeta, TituloPagina, Vacio } from '@/components/ui'

export const metadata = { title: 'Reportes — MOORA' }

function tonoDias(dias: number) {
  return dias > 30 ? 'rojo' : dias > 15 ? 'ambar' : 'gris'
}

export default async function ReportesPage() {
  await requerirRol('admin', 'contador')
  const supabase = await createClient()

  const [{ data: resultados }, { data: porCobrar }, { data: porPagar }, { data: itemsVendidos }] =
    await Promise.all([
      supabase.from('v_resultados_mensuales').select('*').limit(12),
      supabase.from('v_cuentas_por_cobrar').select('*').order('dias_transcurridos', { ascending: false }),
      supabase.from('v_cuentas_por_pagar').select('*').order('dias_transcurridos', { ascending: false }),
      supabase
        .from('venta_items')
        .select('cantidad, subtotal, variantes(sku, nombre, productos(nombre))')
        .limit(500),
    ])

  const totalCobrar = (porCobrar ?? []).reduce((s, c) => s + Number(c.saldo), 0)
  const totalPagar = (porPagar ?? []).reduce((s, c) => s + Number(c.saldo), 0)

  const ranking = new Map<string, { nombre: string; unidades: number; monto: number }>()
  for (const it of itemsVendidos ?? []) {
    const v = it.variantes as unknown as {
      sku: string; nombre: string; productos: { nombre: string } | null
    }
    if (!v) continue
    const previo = ranking.get(v.sku) ?? {
      nombre: `${v.productos?.nombre ?? ''} · ${v.nombre}`,
      unidades: 0,
      monto: 0,
    }
    previo.unidades += Number(it.cantidad)
    previo.monto += Number(it.subtotal)
    ranking.set(v.sku, previo)
  }
  const topProductos = [...ranking.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 10)

  const mesActual = resultados?.[0]

  return (
    <>
      <TituloPagina
        titulo="Reportes"
        descripcion="Control interno de gestión — no reemplaza la contabilidad formal ni sirve ante SUNAT"
      />

      {mesActual && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            etiqueta="Ingresos del mes"
            valor={soles(mesActual.ingresos)}
            detalle={mesLargo(mesActual.mes)}
          />
          <Kpi
            etiqueta="Utilidad bruta"
            valor={soles(mesActual.utilidad_bruta)}
            detalle="Ventas − costo"
          />
          <Kpi etiqueta="Gastos" valor={soles(mesActual.gastos)} />
          <Kpi
            etiqueta="Utilidad neta"
            valor={soles(mesActual.utilidad_neta)}
            tono={Number(mesActual.utilidad_neta) >= 0 ? 'exito' : 'error'}
            detalle="Después de gastos"
          />
        </div>
      )}

      <Tarjeta titulo="Estado de resultados por mes" sinRelleno>
        {resultados && resultados.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto px-5 pb-5 md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borde text-left">
                    {['Mes', 'Ingresos', 'Costo de ventas', 'Utilidad bruta', 'Gastos', 'Utilidad neta'].map(
                      (c) => (
                        <th
                          key={c}
                          className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-suave"
                        >
                          {c}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => (
                    <tr key={r.mes} className="border-b border-borde-suave last:border-0">
                      <td className="px-2 py-3 font-semibold capitalize text-tinta">{mesLargo(r.mes)}</td>
                      <td className="cifra px-2 py-3">{soles(r.ingresos)}</td>
                      <td className="cifra px-2 py-3 text-tinta-suave">{soles(r.costo_ventas)}</td>
                      <td className="cifra px-2 py-3">{soles(r.utilidad_bruta)}</td>
                      <td className="cifra px-2 py-3 text-tinta-suave">{soles(r.gastos)}</td>
                      <td
                        className={`cifra px-2 py-3 font-bold ${
                          Number(r.utilidad_neta) >= 0 ? 'text-exito' : 'text-error'
                        }`}
                      >
                        {soles(r.utilidad_neta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2.5 p-4 md:hidden">
              {resultados.map((r) => (
                <div key={r.mes} className="rounded-xl border border-borde p-4">
                  <p className="mb-2 font-semibold capitalize text-tinta">{mesLargo(r.mes)}</p>
                  {[
                    ['Ingresos', soles(r.ingresos), ''],
                    ['Costo de ventas', soles(r.costo_ventas), 'text-tinta-suave'],
                    ['Utilidad bruta', soles(r.utilidad_bruta), ''],
                    ['Gastos', soles(r.gastos), 'text-tinta-suave'],
                    [
                      'Utilidad neta',
                      soles(r.utilidad_neta),
                      Number(r.utilidad_neta) >= 0 ? 'text-exito font-bold' : 'text-error font-bold',
                    ],
                  ].map(([etiqueta, valor, clase]) => (
                    <div key={etiqueta} className="flex justify-between py-0.5 text-sm">
                      <span className="text-tinta-suave">{etiqueta}</span>
                      <span className={`cifra font-semibold ${clase}`}>{valor}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="px-5 pb-5">
            <Vacio
              mensaje="Todavía no hay datos suficientes"
              descripcion="Registra ventas y gastos para ver tu estado de resultados."
            />
          </div>
        )}
      </Tarjeta>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo={`Cuentas por cobrar — ${soles(totalCobrar)}`}>
          {porCobrar && porCobrar.length > 0 ? (
            <ul className="flex flex-col divide-y divide-borde-suave">
              {porCobrar.map((c) => (
                <li key={c.venta_id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-tinta">{c.cliente}</p>
                    <p className="truncate text-xs text-tinta-suave">
                      <Link href={`/ventas/${c.venta_id}`} className="underline-offset-2 hover:underline">
                        {c.numero}
                      </Link>{' '}
                      · {fecha(c.fecha)}
                      {c.telefono && ` · ${c.telefono}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Etiqueta texto={`${c.dias_transcurridos} d`} tono={tonoDias(c.dias_transcurridos)} />
                    <span className="cifra font-bold text-error">{soles(c.saldo)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-tinta-suave">Nadie te debe. Todo cobrado.</p>
          )}
        </Tarjeta>

        <Tarjeta titulo={`Cuentas por pagar — ${soles(totalPagar)}`}>
          {porPagar && porPagar.length > 0 ? (
            <ul className="flex flex-col divide-y divide-borde-suave">
              {porPagar.map((c) => (
                <li key={c.compra_id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-tinta">{c.proveedor}</p>
                    <p className="truncate text-xs text-tinta-suave">
                      <Link href={`/compras/${c.compra_id}`} className="underline-offset-2 hover:underline">
                        {c.numero_documento ?? 'Sin N°'}
                      </Link>{' '}
                      · {fecha(c.fecha)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Etiqueta texto={`${c.dias_transcurridos} d`} tono={tonoDias(c.dias_transcurridos)} />
                    <span className="cifra font-bold text-error">{soles(c.saldo)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-tinta-suave">No le debes nada a nadie.</p>
          )}
        </Tarjeta>
      </div>

      <div className="mt-4">
        <Tarjeta titulo="Productos más vendidos">
          {topProductos.length > 0 ? (
            <ul className="flex flex-col divide-y divide-borde-suave">
              {topProductos.map((p, i) => (
                <li key={p.nombre} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-borde-suave text-xs font-bold text-tinta-suave">
                      {i + 1}
                    </span>
                    <span className="truncate font-semibold text-tinta">{p.nombre}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="cifra text-sm font-bold text-tinta">{soles(p.monto)}</p>
                    <p className="cifra text-xs text-tinta-suave">{numero(p.unidades)} unid.</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-tinta-suave">
              Todavía no hay ventas registradas.
            </p>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
