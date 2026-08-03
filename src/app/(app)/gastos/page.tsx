import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { METODOS_PAGO } from '@/lib/tipos'
import { Campo, Input, Kpi, Select, Tarjeta, TituloPagina, Vacio } from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { registrarGasto, eliminarGasto, crearCategoriaGasto } from './actions'

export const metadata = { title: 'Gastos — MOORA' }

export default async function GastosPage() {
  const perfil = await requerirRol('admin', 'contador')
  const supabase = await createClient()

  const [{ data: gastos }, { data: categorias }] = await Promise.all([
    supabase
      .from('gastos')
      .select('*, categorias_gasto(nombre)')
      .order('fecha', { ascending: false })
      .limit(100),
    supabase.from('categorias_gasto').select('*').eq('activo', true).order('nombre'),
  ])

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const delMes = (gastos ?? []).filter((g) => g.fecha >= inicioMes)
  const totalMes = delMes.reduce((s, g) => s + Number(g.monto), 0)
  const total = (gastos ?? []).reduce((s, g) => s + Number(g.monto), 0)
  const esAdmin = perfil.rol === 'admin'

  return (
    <>
      <TituloPagina
        titulo="Gastos"
        descripcion="Todo lo que sale y no es entrada de mercadería"
        accion={
          esAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Panel etiqueta="+ Nuevo gasto" titulo="Registrar gasto">
                <form action={registrarGasto} className="flex flex-col gap-4">
                  <Campo etiqueta="Descripción *">
                    <Input name="descripcion" required placeholder="Alquiler del local — julio" />
                  </Campo>
                  <Campo etiqueta="Monto (S/) *">
                    <Input name="monto" type="number" step="0.01" min="0.01" required />
                  </Campo>
                  <Campo etiqueta="Categoría">
                    <Select name="categoria_gasto_id" defaultValue="">
                      <option value="">— Sin categoría —</option>
                      {categorias?.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo etiqueta="Fecha">
                    <Input name="fecha" type="date" defaultValue={hoy.toISOString().slice(0, 10)} />
                  </Campo>
                  <Campo etiqueta="Método de pago">
                    <Select name="metodo" defaultValue="efectivo">
                      {METODOS_PAGO.map((m) => (
                        <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                      ))}
                    </Select>
                  </Campo>
                  <BotonEnviar className="w-full">Guardar gasto</BotonEnviar>
                </form>
              </Panel>

              <Panel etiqueta="Categorías" titulo="Nueva categoría" variante="secundario">
                <form action={crearCategoriaGasto} className="flex flex-col gap-4">
                  <Campo etiqueta="Nombre">
                    <Input name="nombre" required placeholder="Mantenimiento" />
                  </Campo>
                  <BotonEnviar className="w-full">Agregar categoría</BotonEnviar>
                </form>

                {categorias && categorias.length > 0 && (
                  <div className="mt-5 border-t border-borde pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-suave">
                      Categorías existentes
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {categorias.map((c) => (
                        <span
                          key={c.id}
                          className="rounded-full bg-borde-suave px-3 py-1 text-xs font-semibold text-tinta-media"
                        >
                          {c.nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Kpi
          etiqueta="Gastos de este mes"
          valor={soles(totalMes)}
          detalle={`${delMes.length} registros`}
        />
        <Kpi etiqueta="Total mostrado" valor={soles(total)} detalle="Últimos 100 registros" />
      </div>

      {gastos && gastos.length > 0 ? (
        <Tarjeta titulo="Historial de gastos" sinRelleno>
          <div className="hidden px-5 pb-5 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['Fecha', 'Descripción', 'Categoría', 'Método', 'Monto', ''].map((c) => (
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
                {gastos.map((g) => (
                  <tr key={g.id} className="border-b border-borde-suave last:border-0">
                    <td className="whitespace-nowrap px-2 py-3 text-tinta-suave">{fecha(g.fecha)}</td>
                    <td className="px-2 py-3 font-semibold text-tinta">{g.descripcion}</td>
                    <td className="px-2 py-3 text-tinta-suave">
                      {(g.categorias_gasto as unknown as { nombre: string } | null)?.nombre ?? '—'}
                    </td>
                    <td className="px-2 py-3 capitalize text-tinta-suave">{g.metodo}</td>
                    <td className="cifra px-2 py-3 font-bold">{soles(g.monto)}</td>
                    <td className="px-2 py-3 text-right">
                      {esAdmin && (
                        <form action={eliminarGasto}>
                          <input type="hidden" name="id" value={g.id} />
                          <button
                            type="submit"
                            className="text-sm font-semibold text-error underline-offset-4 hover:underline"
                          >
                            Eliminar
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 p-4 md:hidden">
            {gastos.map((g) => (
              <div key={g.id} className="rounded-xl border border-borde p-4">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-tinta">{g.descripcion}</p>
                    <p className="truncate text-xs text-tinta-suave">
                      {fecha(g.fecha)} ·{' '}
                      {(g.categorias_gasto as unknown as { nombre: string } | null)?.nombre ??
                        'Sin categoría'}
                    </p>
                  </div>
                  <span className="cifra shrink-0 font-bold text-tinta">{soles(g.monto)}</span>
                </div>
                {esAdmin && (
                  <form action={eliminarGasto} className="mt-2">
                    <input type="hidden" name="id" value={g.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-error underline-offset-4 hover:underline"
                    >
                      Eliminar
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </Tarjeta>
      ) : (
        <Vacio
          mensaje="Aún no hay gastos registrados"
          descripcion="Registra alquiler, servicios o sueldos para que la utilidad neta sea real."
        />
      )}
    </>
  )
}
