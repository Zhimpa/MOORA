import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { PLATAFORMAS_VENTA } from '@/lib/tipos'
import { Enlace, EstadoDoc, Etiqueta, Kpi, Tarjeta, TituloPagina, Vacio } from '@/components/ui'

export const metadata = { title: 'Comisiones — MOORA' }

function etiquetaPlataforma(valor: string) {
  return PLATAFORMAS_VENTA.find((p) => p.valor === valor)?.etiqueta ?? valor
}

export default async function ComisionesPage() {
  // Los montos de comisión son información financiera: solo dueño y contador los ven.
  await requerirRol('admin', 'contador')
  const supabase = await createClient()

  const [{ data: resumenPorAsesor }, { data: comisiones }] = await Promise.all([
    supabase.from('v_comisiones_por_asesor').select('*').order('total_comision', { ascending: false }),
    supabase.from('v_comisiones').select('*').order('fecha', { ascending: false }).limit(100),
  ])

  const totalComision = (resumenPorAsesor ?? []).reduce((s, r) => s + Number(r.total_comision), 0)
  const totalVentasConComision = (resumenPorAsesor ?? []).reduce((s, r) => s + Number(r.num_ventas), 0)
  const asesoresConComision = (resumenPorAsesor ?? []).filter((r) => Number(r.total_comision) > 0)

  return (
    <>
      <TituloPagina
        titulo="Comisiones"
        descripcion="Lo que se le debe a cada vendedor por sus ventas referidas"
        accion={<Enlace href="/vendedores">Gestionar vendedores →</Enlace>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi etiqueta="Comisiones acumuladas" valor={soles(totalComision)} detalle="Ventas confirmadas y borrador" />
        <Kpi etiqueta="Ventas con comisión" valor={String(totalVentasConComision)} />
        <Kpi etiqueta="Vendedores con comisión" valor={String(asesoresConComision.length)} />
      </div>

      <div className="mb-4">
        <Tarjeta titulo="Comisión acumulada por vendedor" sinRelleno>
          {resumenPorAsesor && resumenPorAsesor.length > 0 ? (
            <>
              <div className="hidden px-5 py-4 md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left">
                      {['Vendedor', 'Ventas', 'Comisión acumulada', 'Última venta', 'Estado'].map((c) => (
                        <th
                          key={c}
                          className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-suave"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPorAsesor.map((r) => (
                      <tr
                        key={r.asesor_id}
                        className={`border-b border-borde-suave last:border-0 ${r.activo ? '' : 'opacity-50'}`}
                      >
                        <td className="px-2 py-3 font-semibold text-tinta">{r.asesor}</td>
                        <td className="cifra px-2 py-3">{r.num_ventas}</td>
                        <td className="cifra px-2 py-3 font-bold">{soles(r.total_comision)}</td>
                        <td className="px-2 py-3 text-tinta-suave">{r.ultima_venta ? fecha(r.ultima_venta) : '—'}</td>
                        <td className="px-2 py-3">
                          <Etiqueta texto={r.activo ? 'Activo' : 'Inactivo'} tono={r.activo ? 'verde' : 'gris'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2.5 p-4 md:hidden">
                {resumenPorAsesor.map((r) => (
                  <div
                    key={r.asesor_id}
                    className={`rounded-xl border border-borde p-4 ${r.activo ? '' : 'opacity-50'}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="truncate font-semibold text-tinta">{r.asesor}</p>
                      <Etiqueta texto={r.activo ? 'Activo' : 'Inactivo'} tono={r.activo ? 'verde' : 'gris'} />
                    </div>
                    <div className="flex justify-between py-0.5 text-sm">
                      <span className="text-tinta-suave">Ventas</span>
                      <span className="cifra font-semibold text-tinta">{r.num_ventas}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-sm">
                      <span className="text-tinta-suave">Comisión acumulada</span>
                      <span className="cifra font-bold text-tinta">{soles(r.total_comision)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="px-5 pb-5">
              <Vacio
                mensaje="Aún no hay vendedores registrados"
                descripcion="Regístralos en la sección Vendedores para poder asignarles comisión al crear una venta."
              />
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo={`Detalle de comisiones — ${soles(totalComision)}`} sinRelleno>
        {comisiones && comisiones.length > 0 ? (
          <>
            <div className="hidden px-5 py-4 md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borde text-left">
                    {['N°', 'Fecha', 'Comprador', 'Canal', 'Vendedor', 'Comisión', 'Estado', ''].map((c) => (
                      <th
                        key={c}
                        className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-suave"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comisiones.map((c) => (
                    <tr key={c.venta_id} className="border-b border-borde-suave last:border-0">
                      <td className="px-2 py-3 font-semibold text-tinta">{c.numero}</td>
                      <td className="px-2 py-3 text-tinta-suave">{fecha(c.fecha)}</td>
                      <td className="px-2 py-3">{c.comprador}</td>
                      <td className="px-2 py-3 text-tinta-suave">{etiquetaPlataforma(c.plataforma)}</td>
                      <td className="px-2 py-3">{c.asesor}</td>
                      <td className="cifra px-2 py-3 font-bold">{soles(c.comision_monto)}</td>
                      <td className="px-2 py-3"><EstadoDoc estado={c.estado} /></td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          href={`/ventas/${c.venta_id}`}
                          className="text-sm font-semibold text-vino underline-offset-4 hover:underline"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2.5 p-4 md:hidden">
              {comisiones.map((c) => (
                <Link
                  key={c.venta_id}
                  href={`/ventas/${c.venta_id}`}
                  className="block rounded-xl border border-borde p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-tinta">{c.comprador}</p>
                      <p className="truncate text-xs text-tinta-suave">
                        {c.numero} · {fecha(c.fecha)} · {etiquetaPlataforma(c.plataforma)}
                      </p>
                    </div>
                    <EstadoDoc estado={c.estado} />
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-tinta-suave">Vendedor</span>
                    <span className="font-semibold text-tinta">{c.asesor}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-tinta-suave">Comisión</span>
                    <span className="cifra font-bold text-tinta">{soles(c.comision_monto)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="px-5 pb-5">
            <Vacio
              mensaje="Todavía no hay comisiones registradas"
              descripcion="Cuando asignes un vendedor a una venta con comisión, aparecerá aquí."
            />
          </div>
        )}
      </Tarjeta>
    </>
  )
}
