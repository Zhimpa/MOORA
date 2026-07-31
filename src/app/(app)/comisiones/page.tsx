import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { PLATAFORMAS_VENTA } from '@/lib/tipos'
import {
  Campo, Etiqueta, EstadoDoc, Input, Kpi, Tarjeta, TextArea, TituloPagina, Vacio,
} from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { crearAsesor, actualizarAsesor, alternarAsesor } from './actions'

export const metadata = { title: 'Comisiones — MOORA' }

function etiquetaPlataforma(valor: string) {
  return PLATAFORMAS_VENTA.find((p) => p.valor === valor)?.etiqueta ?? valor
}

export default async function ComisionesPage() {
  const perfil = await requerirRol('admin', 'vendedor', 'contador')
  const supabase = await createClient()

  const puedeGestionar = perfil.rol === 'admin' || perfil.rol === 'vendedor'
  // Los montos de comisión son información financiera: solo dueño y contador los ven completos.
  const veFinanzas = perfil.rol === 'admin' || perfil.rol === 'contador'

  const [{ data: asesores }, resumen, detalle] = await Promise.all([
    supabase.from('asesores_venta').select('*').order('activo', { ascending: false }).order('nombre'),
    veFinanzas
      ? supabase.from('v_comisiones_por_asesor').select('*').order('total_comision', { ascending: false })
      : Promise.resolve({ data: null }),
    veFinanzas
      ? supabase.from('v_comisiones').select('*').order('fecha', { ascending: false }).limit(100)
      : Promise.resolve({ data: null }),
  ])

  const resumenPorAsesor = resumen.data ?? []
  const comisiones = detalle.data ?? []
  const totalComision = resumenPorAsesor.reduce((s, r) => s + Number(r.total_comision), 0)
  const totalVentasConComision = resumenPorAsesor.reduce((s, r) => s + Number(r.num_ventas), 0)

  return (
    <>
      <TituloPagina
        titulo="Comisiones"
        descripcion="Asesores de venta y lo que se les debe por cada venta referida"
        accion={
          puedeGestionar ? (
            <Panel etiqueta="+ Nuevo asesor" titulo="Nuevo asesor de ventas">
              <form action={crearAsesor} className="flex flex-col gap-4">
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" required placeholder="Nombre completo" />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <Input name="telefono" type="tel" />
                </Campo>
                <Campo etiqueta="Notas">
                  <TextArea name="notas" rows={2} />
                </Campo>
                <BotonEnviar className="w-full">Guardar asesor</BotonEnviar>
              </form>
            </Panel>
          ) : undefined
        }
      />

      {veFinanzas && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi etiqueta="Comisiones acumuladas" valor={soles(totalComision)} detalle="Ventas confirmadas y borrador" />
          <Kpi etiqueta="Ventas con comisión" valor={String(totalVentasConComision)} />
          <Kpi etiqueta="Asesores activos" valor={String((asesores ?? []).filter((a) => a.activo).length)} />
          <Kpi etiqueta="Asesores registrados" valor={String((asesores ?? []).length)} />
        </div>
      )}

      <div className="mb-4">
        <Tarjeta titulo="Asesores de venta" sinRelleno>
          {asesores && asesores.length > 0 ? (
            <>
              <div className="hidden px-5 py-4 md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left">
                      {[
                        'Nombre', 'Teléfono',
                        ...(veFinanzas ? ['Ventas', 'Comisión acumulada'] : []),
                        'Estado', '',
                      ].map((c) => (
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
                    {asesores.map((a) => {
                      const r = resumenPorAsesor.find((x) => x.asesor_id === a.id)
                      return (
                        <tr
                          key={a.id}
                          className={`border-b border-borde-suave last:border-0 ${a.activo ? '' : 'opacity-50'}`}
                        >
                          <td className="px-2 py-3 font-semibold text-tinta">{a.nombre}</td>
                          <td className="px-2 py-3 text-tinta-suave">{a.telefono ?? '—'}</td>
                          {veFinanzas && (
                            <>
                              <td className="cifra px-2 py-3">{r?.num_ventas ?? 0}</td>
                              <td className="cifra px-2 py-3 font-bold">{soles(r?.total_comision ?? 0)}</td>
                            </>
                          )}
                          <td className="px-2 py-3">
                            <Etiqueta texto={a.activo ? 'Activo' : 'Inactivo'} tono={a.activo ? 'verde' : 'gris'} />
                          </td>
                          <td className="px-2 py-3 text-right">
                            {puedeGestionar && <PanelEditarAsesor asesor={a} />}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2.5 p-4 md:hidden">
                {asesores.map((a) => {
                  const r = resumenPorAsesor.find((x) => x.asesor_id === a.id)
                  return (
                    <div
                      key={a.id}
                      className={`rounded-xl border border-borde p-4 ${a.activo ? '' : 'opacity-50'}`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-tinta">{a.nombre}</p>
                          <p className="truncate text-xs text-tinta-suave">{a.telefono ?? 'Sin teléfono'}</p>
                        </div>
                        <Etiqueta texto={a.activo ? 'Activo' : 'Inactivo'} tono={a.activo ? 'verde' : 'gris'} />
                      </div>
                      {veFinanzas && (
                        <div className="flex justify-between py-0.5 text-sm">
                          <span className="text-tinta-suave">Comisión acumulada</span>
                          <span className="cifra font-bold text-tinta">{soles(r?.total_comision ?? 0)}</span>
                        </div>
                      )}
                      {puedeGestionar && (
                        <div className="mt-3">
                          <PanelEditarAsesor asesor={a} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="px-5 pb-5">
              <Vacio
                mensaje="Aún no hay asesores registrados"
                descripcion="Regístralos aquí para poder asignarles comisión al crear una venta."
              />
            </div>
          )}
        </Tarjeta>
      </div>

      {veFinanzas && (
        <Tarjeta titulo={`Detalle de comisiones — ${soles(totalComision)}`} sinRelleno>
          {comisiones.length > 0 ? (
            <>
              <div className="hidden px-5 py-4 md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left">
                      {['N°', 'Fecha', 'Comprador', 'Canal', 'Asesor', 'Comisión', 'Estado', ''].map((c) => (
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
                      <span className="text-tinta-suave">Asesor</span>
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
                descripcion="Cuando asignes un asesor a una venta, aparecerá aquí."
              />
            </div>
          )}
        </Tarjeta>
      )}
    </>
  )
}

/* Panel de edición reutilizado por la tabla y por las tarjetas de móvil */
function PanelEditarAsesor({
  asesor,
}: {
  asesor: {
    id: string
    nombre: string
    telefono: string | null
    notas: string | null
    activo: boolean
  }
}) {
  return (
    <Panel etiqueta="Editar" titulo={asesor.nombre} descripcion="Datos del asesor" variante="secundario">
      <form action={actualizarAsesor} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={asesor.id} />
        <Campo etiqueta="Nombre *">
          <Input name="nombre" defaultValue={asesor.nombre} required />
        </Campo>
        <Campo etiqueta="Teléfono">
          <Input name="telefono" type="tel" defaultValue={asesor.telefono ?? ''} />
        </Campo>
        <Campo etiqueta="Notas">
          <TextArea name="notas" rows={2} defaultValue={asesor.notas ?? ''} />
        </Campo>
        <BotonEnviar className="w-full">Guardar cambios</BotonEnviar>
      </form>

      <form action={alternarAsesor} className="mt-3 border-t border-borde pt-4">
        <input type="hidden" name="id" value={asesor.id} />
        <input type="hidden" name="activo" value={String(asesor.activo)} />
        <BotonEnviar variante="peligro" className="w-full" pendienteTexto="Aplicando…">
          {asesor.activo ? 'Desactivar asesor' : 'Reactivar asesor'}
        </BotonEnviar>
        <p className="mt-2 text-xs text-tinta-suave">
          No se borra: se desactiva para no perder el historial de comisiones.
        </p>
      </form>
    </Panel>
  )
}
