import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero, fecha, mesLargo } from '@/lib/format'
import { Etiqueta, Kpi, Tabla, Tarjeta, TituloPagina, Vacio } from '@/components/ui'

export const metadata = { title: 'Reportes — MOORA' }

export default async function ReportesPage() {
  await requerirRol('admin', 'contador')
  const supabase = await createClient()

  const [{ data: resultados }, { data: porCobrar }, { data: porPagar }, { data: masVendidos }] =
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

  // Ranking de productos por unidades vendidas
  const ranking = new Map<string, { nombre: string; unidades: number; monto: number }>()
  for (const it of masVendidos ?? []) {
    const v = it.variantes as unknown as {
      sku: string; nombre: string; productos: { nombre: string } | null
    }
    if (!v) continue
    const clave = v.sku
    const previo = ranking.get(clave) ?? {
      nombre: `${v.productos?.nombre ?? ''} · ${v.nombre}`,
      unidades: 0,
      monto: 0,
    }
    previo.unidades += Number(it.cantidad)
    previo.monto += Number(it.subtotal)
    ranking.set(clave, previo)
  }
  const topProductos = [...ranking.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 10)

  const mesActual = resultados?.[0]

  return (
    <>
      <TituloPagina
        titulo="Reportes"
        descripcion="Control interno de gestión. No reemplaza la contabilidad formal ni sirve ante SUNAT."
      />

      {mesActual && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi etiqueta="Ingresos del mes" valor={soles(mesActual.ingresos)} detalle={mesLargo(mesActual.mes)} />
          <Kpi etiqueta="Utilidad bruta" valor={soles(mesActual.utilidad_bruta)} detalle="Ventas − costo de lo vendido" />
          <Kpi etiqueta="Gastos" valor={soles(mesActual.gastos)} />
          <Kpi etiqueta="Utilidad neta" valor={soles(mesActual.utilidad_neta)} detalle="Después de gastos" />
        </div>
      )}

      <Tarjeta titulo="Estado de resultados por mes">
        {resultados && resultados.length > 0 ? (
          <Tabla cabeceras={['Mes', 'Ingresos', 'Costo de ventas', 'Utilidad bruta', 'Gastos', 'Utilidad neta']}>
            {resultados.map((r) => (
              <tr key={r.mes}>
                <td className="px-3 py-2 font-medium capitalize text-gray-900">{mesLargo(r.mes)}</td>
                <td className="px-3 py-2">{soles(r.ingresos)}</td>
                <td className="px-3 py-2 text-gray-600">{soles(r.costo_ventas)}</td>
                <td className="px-3 py-2">{soles(r.utilidad_bruta)}</td>
                <td className="px-3 py-2 text-gray-600">{soles(r.gastos)}</td>
                <td className={`px-3 py-2 font-medium ${Number(r.utilidad_neta) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {soles(r.utilidad_neta)}
                </td>
              </tr>
            ))}
          </Tabla>
        ) : (
          <Vacio mensaje="Todavía no hay datos suficientes. Registra ventas y gastos." />
        )}
      </Tarjeta>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo={`Cuentas por cobrar — ${soles(totalCobrar)}`}>
          {porCobrar && porCobrar.length > 0 ? (
            <Tabla cabeceras={['Cliente', 'Venta', 'Saldo', 'Días']}>
              {porCobrar.map((c) => (
                <tr key={c.venta_id}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-gray-900">{c.cliente}</span>
                    {c.telefono && <span className="text-xs text-gray-500">{c.telefono}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/ventas/${c.venta_id}`} className="text-sm underline">{c.numero}</Link>
                    <span className="block text-xs text-gray-500">{fecha(c.fecha)}</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-red-600">{soles(c.saldo)}</td>
                  <td className="px-3 py-2">
                    <Etiqueta
                      texto={`${c.dias_transcurridos} d`}
                      tono={c.dias_transcurridos > 30 ? 'rojo' : c.dias_transcurridos > 15 ? 'ambar' : 'gris'}
                    />
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <Vacio mensaje="Nadie te debe. Todo cobrado." />
          )}
        </Tarjeta>

        <Tarjeta titulo={`Cuentas por pagar — ${soles(totalPagar)}`}>
          {porPagar && porPagar.length > 0 ? (
            <Tabla cabeceras={['Proveedor', 'Compra', 'Saldo', 'Días']}>
              {porPagar.map((c) => (
                <tr key={c.compra_id}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-gray-900">{c.proveedor}</span>
                    {c.telefono && <span className="text-xs text-gray-500">{c.telefono}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/compras/${c.compra_id}`} className="text-sm underline">
                      {c.numero_documento ?? 'Sin N°'}
                    </Link>
                    <span className="block text-xs text-gray-500">{fecha(c.fecha)}</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-red-600">{soles(c.saldo)}</td>
                  <td className="px-3 py-2">
                    <Etiqueta
                      texto={`${c.dias_transcurridos} d`}
                      tono={c.dias_transcurridos > 30 ? 'rojo' : c.dias_transcurridos > 15 ? 'ambar' : 'gris'}
                    />
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <Vacio mensaje="No le debes nada a nadie." />
          )}
        </Tarjeta>
      </div>

      <div className="mt-4">
        <Tarjeta titulo="Productos más vendidos">
          {topProductos.length > 0 ? (
            <Tabla cabeceras={['Producto', 'Unidades', 'Vendido']}>
              {topProductos.map((p) => (
                <tr key={p.nombre}>
                  <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-3 py-2">{numero(p.unidades)}</td>
                  <td className="px-3 py-2">{soles(p.monto)}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <Vacio mensaje="Todavía no hay ventas registradas." />
          )}
        </Tarjeta>
      </div>
    </>
  )
}
