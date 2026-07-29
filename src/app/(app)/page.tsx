import { requerirPerfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero } from '@/lib/format'
import { Kpi, Tarjeta, Vacio, Etiqueta, Enlace, EstadoDoc, TarjetaFila } from '@/components/ui'
import { GraficoVentas } from '@/components/grafico-ventas'
import type { KpisDashboard } from '@/lib/tipos'

// Todo se calcula en hora de Lima: el servidor de Vercel corre en UTC.
const ZONA = 'America/Lima'

function saludo() {
  const hora = Number(
    new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, hour: 'numeric', hour12: false }).format(
      new Date()
    )
  )
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaLarga() {
  const texto = new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default async function Dashboard() {
  const perfil = await requerirPerfil()
  const supabase = await createClient()

  const [{ data: kpisRaw }, { data: serie }, { data: stockBajo }, { data: ventasRecientes }] =
    await Promise.all([
      supabase.rpc('kpis_dashboard', { p_dias: 30 }),
      supabase.rpc('serie_ventas', { p_dias: 7 }),
      supabase
        .from('v_stock_actual')
        .select('sku, producto, variante, stock, stock_minimo')
        .eq('activo', true)
        .eq('stock_bajo', true)
        .order('stock')
        .limit(5),
      supabase
        .from('ventas')
        .select('id, numero, fecha, total, estado, clientes(nombre)')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const k = (kpisRaw ?? {}) as Partial<KpisDashboard>
  const esFinanzas = perfil.rol === 'admin' || perfil.rol === 'contador'
  const verInventario = perfil.rol !== 'vendedor'
  const verVentas = perfil.rol !== 'almacen'
  const nombre = perfil.nombre_completo?.split(' ')[0] ?? ''

  return (
    <>
      <header className="mb-6">
        <h1 className="titulo-editorial text-3xl text-tinta sm:text-[32px]">
          {saludo()}, {nombre}
        </h1>
        <p className="mt-1 text-sm text-tinta-suave">{fechaLarga()}</p>
      </header>

      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {verVentas && <Kpi etiqueta="Vendido hoy" valor={soles(k.ventas_hoy)} />}
        {verVentas && (
          <Kpi
            etiqueta="Me deben"
            valor={soles(k.por_cobrar)}
            tono={Number(k.por_cobrar ?? 0) > 0 ? 'alerta' : 'neutro'}
          />
        )}
        {verInventario && <Kpi etiqueta="Debo a proveedores" valor={soles(k.por_pagar)} />}
        {verInventario && (
          <Kpi
            etiqueta="Stock bajo"
            valor={`${numero(k.stock_bajo, 0)} productos`}
            tono={Number(k.stock_bajo ?? 0) > 0 ? 'error' : 'neutro'}
            detalle={Number(k.stock_bajo ?? 0) > 0 ? 'Reponer pronto' : undefined}
          />
        )}
        {esFinanzas && (
          <>
            <Kpi
              etiqueta="Ventas del mes"
              valor={soles(k.ventas_periodo)}
              detalle={`${numero(k.num_ventas, 0)} ventas`}
            />
            <Kpi etiqueta="Utilidad bruta" valor={soles(k.utilidad_periodo)} tono="exito" />
            <Kpi etiqueta="Gastos del mes" valor={soles(k.gastos_periodo)} />
            <Kpi etiqueta="Valor inventario" valor={soles(k.valor_inventario)} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {verVentas && (
          <Tarjeta titulo="Ventas — últimos 7 días">
            <GraficoVentas datos={(serie as { fecha: string; total: number }[]) ?? []} />
          </Tarjeta>
        )}

        {verInventario && (
          <Tarjeta
            titulo="Reponer stock"
            accion={
              stockBajo && stockBajo.length > 0 ? (
                <Etiqueta texto={`${stockBajo.length}`} tono="rojo" />
              ) : undefined
            }
          >
            {stockBajo && stockBajo.length > 0 ? (
              <>
                <ul className="flex flex-col gap-2.5">
                  {stockBajo.map((v) => (
                    <li
                      key={v.sku}
                      className="flex items-center justify-between gap-3 border-b border-borde-suave pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-tinta">{v.producto}</p>
                        <p className="truncate text-xs text-tinta-suave">{v.variante}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="cifra text-sm font-bold text-error">{numero(v.stock)}</p>
                        <p className="text-[11px] text-tinta-suave">mín. {numero(v.stock_minimo)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Enlace href="/inventario">Ver inventario →</Enlace>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-tinta-suave">
                Ningún producto está por debajo del mínimo.
              </p>
            )}
          </Tarjeta>
        )}
      </div>

      {verVentas && (
        <div className="mt-4">
          <Tarjeta
            titulo="Ventas recientes"
            accion={<Enlace href="/ventas">Ver todas →</Enlace>}
          >
            {ventasRecientes && ventasRecientes.length > 0 ? (
              <>
                <div className="hidden md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-borde text-left">
                        {['Cliente', 'N°', 'Estado', 'Total'].map((c, i) => (
                          <th
                            key={c}
                            className={`px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-suave ${
                              i === 3 ? 'text-right' : ''
                            }`}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ventasRecientes.map((v) => (
                        <tr key={v.id} className="border-b border-borde-suave last:border-0">
                          <td className="px-2 py-3 font-semibold">
                            {(v.clientes as unknown as { nombre: string } | null)?.nombre ??
                              'Mostrador'}
                          </td>
                          <td className="px-2 py-3 text-tinta-suave">{v.numero}</td>
                          <td className="px-2 py-3">
                            <EstadoDoc estado={v.estado} />
                          </td>
                          <td className="cifra px-2 py-3 text-right font-bold">{soles(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2.5 md:hidden">
                  {ventasRecientes.map((v) => (
                    <TarjetaFila
                      key={v.id}
                      href={`/ventas/${v.id}`}
                      titulo={
                        (v.clientes as unknown as { nombre: string } | null)?.nombre ?? 'Mostrador'
                      }
                      subtitulo={v.numero}
                      derecha={<EstadoDoc estado={v.estado} />}
                      filas={[{ etiqueta: 'Total', valor: soles(v.total) }]}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Vacio
                mensaje="Aún no hay ventas registradas"
                descripcion="Registra tu primera venta del día para verla aquí."
              />
            )}
          </Tarjeta>
        </div>
      )}
    </>
  )
}
