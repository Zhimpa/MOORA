import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero, fechaHora } from '@/lib/format'
import { Boton, Campo, Etiqueta, Input, Kpi, Select, Tabla, Tarjeta, TituloPagina, Vacio } from '@/components/ui'
import { ajustarStock, movimientoManual } from './actions'

export const metadata = { title: 'Inventario — MOORA' }

const NOMBRE_MOVIMIENTO: Record<string, string> = {
  entrada: 'Entrada manual',
  salida: 'Salida manual',
  ajuste: 'Ajuste',
  compra: 'Compra',
  venta: 'Venta',
  devolucion_cliente: 'Devolución de cliente',
  devolucion_proveedor: 'Devolución a proveedor',
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const perfil = await requerirRol('admin', 'almacen', 'contador')
  const { q } = await searchParams
  const supabase = await createClient()

  let consulta = supabase
    .from('v_stock_actual')
    .select('*')
    .eq('activo', true)
    .order('producto')
  if (q) consulta = consulta.ilike('producto', `%${q}%`)

  const [{ data: stock }, { data: movimientos }] = await Promise.all([
    consulta,
    supabase
      .from('movimientos_inventario')
      .select('id, tipo, cantidad, motivo, created_at, variantes(sku, nombre, productos(nombre))')
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const valorTotal = (stock ?? []).reduce((s, v) => s + Number(v.valor_inventario), 0)
  const unidades = (stock ?? []).reduce((s, v) => s + Number(v.stock), 0)
  const bajos = (stock ?? []).filter((v) => v.stock_bajo).length
  const puedeMover = perfil.rol === 'admin' || perfil.rol === 'almacen'

  return (
    <>
      <TituloPagina titulo="Inventario" descripcion="El stock sale de los movimientos, nunca se edita a mano" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Valor del inventario" valor={soles(valorTotal)} detalle="A costo promedio" />
        <Kpi etiqueta="Unidades en stock" valor={numero(unidades)} />
        <Kpi etiqueta="Presentaciones" valor={numero(stock?.length ?? 0, 0)} />
        <Kpi etiqueta="Por reponer" valor={numero(bajos, 0)} detalle="En o bajo el mínimo" />
      </div>

      {puedeMover && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Ajustar stock (conteo físico)">
            <form action={ajustarStock} className="grid gap-3">
              <Campo etiqueta="Producto">
                <Select name="variante_id" required defaultValue="">
                  <option value="" disabled>Elige un producto…</option>
                  {stock?.map((v) => (
                    <option key={v.variante_id} value={v.variante_id}>
                      {v.producto} · {v.variante} (sistema: {numero(v.stock)})
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etiqueta="Stock real contado" ayuda="Se registra la diferencia como ajuste.">
                <Input name="stock_real" type="number" step="0.01" min="0" required />
              </Campo>
              <Campo etiqueta="Motivo">
                <Input name="motivo" placeholder="Conteo físico de fin de mes" />
              </Campo>
              <Boton type="submit">Registrar ajuste</Boton>
            </form>
          </Tarjeta>

          <Tarjeta titulo="Entrada o salida manual">
            <form action={movimientoManual} className="grid gap-3">
              <Campo etiqueta="Producto">
                <Select name="variante_id" required defaultValue="">
                  <option value="" disabled>Elige un producto…</option>
                  {stock?.map((v) => (
                    <option key={v.variante_id} value={v.variante_id}>
                      {v.producto} · {v.variante} (stock {numero(v.stock)})
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etiqueta="Tipo">
                <Select name="tipo" defaultValue="entrada">
                  <option value="entrada">Entrada (suma stock)</option>
                  <option value="salida">Salida (resta stock: merma, uso interno)</option>
                </Select>
              </Campo>
              <Campo etiqueta="Cantidad">
                <Input name="cantidad" type="number" step="0.01" min="0.01" required />
              </Campo>
              <Campo etiqueta="Motivo">
                <Input name="motivo" placeholder="Producto dañado, muestra, etc." />
              </Campo>
              <Boton type="submit">Registrar movimiento</Boton>
            </form>
          </Tarjeta>
        </div>
      )}

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Buscar producto…" />
        <Boton type="submit" variante="secundario">Buscar</Boton>
      </form>

      <Tarjeta titulo="Stock actual">
        {stock && stock.length > 0 ? (
          <Tabla cabeceras={['Producto', 'Stock', 'Mínimo', 'Costo prom.', 'Valor', '']}>
            {stock.map((v) => (
              <tr key={v.variante_id}>
                <td className="px-3 py-2">
                  <span className="block font-medium text-gray-900">{v.producto}</span>
                  <span className="text-xs text-gray-500">{v.variante} · {v.sku}</span>
                </td>
                <td className="px-3 py-2 font-medium">{numero(v.stock)}</td>
                <td className="px-3 py-2 text-gray-500">{numero(v.stock_minimo)}</td>
                <td className="px-3 py-2 text-gray-600">{soles(v.costo_promedio)}</td>
                <td className="px-3 py-2">{soles(v.valor_inventario)}</td>
                <td className="px-3 py-2">
                  {v.stock_bajo && <Etiqueta texto="Reponer" tono="rojo" />}
                </td>
              </tr>
            ))}
          </Tabla>
        ) : (
          <Vacio mensaje="No hay productos en inventario todavía." />
        )}
      </Tarjeta>

      <div className="mt-4">
        <Tarjeta titulo="Últimos movimientos">
          {movimientos && movimientos.length > 0 ? (
            <Tabla cabeceras={['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo']}>
              {movimientos.map((m) => {
                const v = m.variantes as unknown as {
                  sku: string; nombre: string; productos: { nombre: string } | null
                }
                const entra = Number(m.cantidad) > 0
                return (
                  <tr key={m.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fechaHora(m.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className="block">{v?.productos?.nombre}</span>
                      <span className="text-xs text-gray-500">{v?.nombre}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{NOMBRE_MOVIMIENTO[m.tipo] ?? m.tipo}</td>
                    <td className={`px-3 py-2 font-medium ${entra ? 'text-green-700' : 'text-red-600'}`}>
                      {entra ? '+' : ''}{numero(m.cantidad)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{m.motivo ?? '—'}</td>
                  </tr>
                )
              })}
            </Tabla>
          ) : (
            <Vacio mensaje="Todavía no hay movimientos de inventario." />
          )}
        </Tarjeta>
      </div>
    </>
  )
}
