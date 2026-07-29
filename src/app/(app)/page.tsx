import Link from 'next/link'
import { requerirPerfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero } from '@/lib/format'
import { Kpi, Tarjeta, Tabla, Vacio, TituloPagina } from '@/components/ui'
import { GraficoVentas } from '@/components/grafico-ventas'
import type { KpisDashboard } from '@/lib/tipos'

export default async function Dashboard() {
  const perfil = await requerirPerfil()
  const supabase = await createClient()

  // Un solo viaje para todos los KPIs; el RLS decide qué ve cada rol.
  const [{ data: kpisRaw }, { data: serie }, { data: stockBajo }] = await Promise.all([
    supabase.rpc('kpis_dashboard', { p_dias: 30 }),
    supabase.rpc('serie_ventas', { p_dias: 30 }),
    supabase
      .from('v_stock_actual')
      .select('sku, producto, variante, stock, stock_minimo')
      .eq('activo', true)
      .eq('stock_bajo', true)
      .order('stock')
      .limit(8),
  ])

  const k = (kpisRaw ?? {}) as Partial<KpisDashboard>
  const esFinanzas = perfil.rol === 'admin' || perfil.rol === 'contador'
  const verInventario = perfil.rol !== 'vendedor'

  return (
    <>
      <TituloPagina
        titulo={`Hola, ${perfil.nombre_completo?.split(' ')[0] ?? 'bienvenido'}`}
        descripcion="Resumen de los últimos 30 días"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Ventas del mes" valor={soles(k.ventas_periodo)} detalle={`${numero(k.num_ventas, 0)} ventas`} />
        <Kpi etiqueta="Ventas de hoy" valor={soles(k.ventas_hoy)} />
        {esFinanzas && (
          <>
            <Kpi etiqueta="Utilidad bruta" valor={soles(k.utilidad_periodo)} detalle="Ventas − costo" />
            <Kpi etiqueta="Gastos del mes" valor={soles(k.gastos_periodo)} />
          </>
        )}
        <Kpi etiqueta="Por cobrar" valor={soles(k.por_cobrar)} detalle="Clientes con deuda" />
        {verInventario && (
          <>
            <Kpi etiqueta="Por pagar" valor={soles(k.por_pagar)} detalle="Deuda a proveedores" />
            <Kpi etiqueta="Valor inventario" valor={soles(k.valor_inventario)} detalle="A costo promedio" />
            <Kpi etiqueta="Stock bajo" valor={numero(k.stock_bajo, 0)} detalle="Variantes en o bajo el mínimo" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Ventas por día (últimos 30 días)">
          <GraficoVentas datos={(serie as { fecha: string; total: number }[]) ?? []} />
        </Tarjeta>

        {verInventario && (
          <Tarjeta
            titulo="Productos por reponer"
            accion={
              <Link href="/inventario" className="text-sm text-gray-600 underline">
                Ver inventario
              </Link>
            }
          >
            {stockBajo && stockBajo.length > 0 ? (
              <Tabla cabeceras={['Producto', 'Stock', 'Mínimo']}>
                {stockBajo.map((v) => (
                  <tr key={v.sku}>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-gray-900">{v.producto}</span>
                      <span className="text-xs text-gray-500">{v.variante} · {v.sku}</span>
                    </td>
                    <td className="px-3 py-2 font-medium text-red-600">{numero(v.stock)}</td>
                    <td className="px-3 py-2 text-gray-500">{numero(v.stock_minimo)}</td>
                  </tr>
                ))}
              </Tabla>
            ) : (
              <Vacio mensaje="Ningún producto está por debajo del mínimo." />
            )}
          </Tarjeta>
        )}
      </div>
    </>
  )
}
