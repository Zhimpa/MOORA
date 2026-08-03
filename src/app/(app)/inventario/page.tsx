import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero, fechaHora } from '@/lib/format'
import {
  Boton, Campo, Etiqueta, Input, Kpi, Select, Tarjeta, TituloPagina, Vacio,
} from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { ajustarStock, movimientoManual } from './actions'

export const metadata = { title: 'Inventario — MOORA' }

const NOMBRE_MOVIMIENTO: Record<string, string> = {
  entrada: 'Entrada manual',
  salida: 'Salida manual',
  ajuste: 'Ajuste',
  compra: 'Entrada por compra',
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

  let consulta = supabase.from('v_stock_actual').select('*').eq('activo', true).order('producto')
  if (q) consulta = consulta.ilike('producto', `%${q}%`)

  const [{ data: stock }, { data: movimientos }] = await Promise.all([
    consulta,
    supabase
      .from('movimientos_inventario')
      .select('id, tipo, cantidad, motivo, created_at, variantes(sku, nombre, productos(nombre))')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const valorTotal = (stock ?? []).reduce((s, v) => s + Number(v.valor_inventario), 0)
  const unidades = (stock ?? []).reduce((s, v) => s + Number(v.stock), 0)
  const bajos = (stock ?? []).filter((v) => v.stock_bajo).length
  const puedeMover = perfil.rol === 'admin' || perfil.rol === 'almacen'

  const selectorProductos = (
    <Select name="variante_id" required defaultValue="">
      <option value="" disabled>Elige un producto…</option>
      {stock?.map((v) => (
        <option key={v.variante_id} value={v.variante_id}>
          {v.producto} · {v.variante} (stock {numero(v.stock)})
        </option>
      ))}
    </Select>
  )

  return (
    <>
      <TituloPagina
        titulo="Inventario"
        descripcion="El stock sale de los movimientos, nunca se edita a mano"
        accion={
          puedeMover ? (
            <div className="flex flex-wrap gap-2">
              <Panel
                etiqueta="Ajustar stock"
                titulo="Ajustar stock"
                descripcion="Corrige el sistema contra un conteo físico."
                variante="secundario"
              >
                <form action={ajustarStock} className="flex flex-col gap-4">
                  <Campo etiqueta="Producto">{selectorProductos}</Campo>
                  <Campo
                    etiqueta="Stock real contado"
                    ayuda="Se registra la diferencia como un movimiento de ajuste."
                  >
                    <Input name="stock_real" type="number" step="0.01" min="0" required />
                  </Campo>
                  <Campo etiqueta="Motivo">
                    <Input name="motivo" placeholder="Conteo físico de fin de mes" />
                  </Campo>
                  <BotonEnviar className="w-full">Registrar ajuste</BotonEnviar>
                </form>
              </Panel>

              <Panel etiqueta="+ Movimiento" titulo="Entrada o salida manual">
                <form action={movimientoManual} className="flex flex-col gap-4">
                  <Campo etiqueta="Producto">{selectorProductos}</Campo>
                  <Campo etiqueta="Tipo">
                    <Select name="tipo" defaultValue="entrada">
                      <option value="entrada">Entrada — suma stock</option>
                      <option value="salida">Salida — resta stock (merma, muestra, uso interno)</option>
                    </Select>
                  </Campo>
                  <Campo etiqueta="Cantidad">
                    <Input name="cantidad" type="number" step="0.01" min="0.01" required />
                  </Campo>
                  <Campo etiqueta="Motivo">
                    <Input name="motivo" placeholder="Producto dañado, muestra, etc." />
                  </Campo>
                  <BotonEnviar className="w-full">Registrar movimiento</BotonEnviar>
                </form>
              </Panel>
            </div>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Valor del inventario" valor={soles(valorTotal)} detalle="A costo promedio" />
        <Kpi etiqueta="Unidades en stock" valor={numero(unidades)} />
        <Kpi etiqueta="Presentaciones" valor={numero(stock?.length ?? 0, 0)} />
        <Kpi
          etiqueta="Por reponer"
          valor={numero(bajos, 0)}
          tono={bajos > 0 ? 'error' : 'neutro'}
          detalle={bajos > 0 ? 'En o bajo el mínimo' : undefined}
        />
      </div>

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Buscar producto…" />
        <Boton type="submit" variante="secundario">Buscar</Boton>
      </form>

      {stock && stock.length > 0 ? (
        <Tarjeta titulo="Stock actual" sinRelleno>
          <div className="hidden px-5 pb-5 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['Producto', 'Stock', 'Mínimo', 'Costo prom.', 'Valor', ''].map((c) => (
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
                {stock.map((v) => (
                  <tr key={v.variante_id} className="border-b border-borde-suave last:border-0">
                    <td className="px-2 py-3">
                      <span className="block font-semibold text-tinta">{v.producto}</span>
                      <span className="text-xs text-tinta-suave">{v.variante} · {v.sku}</span>
                    </td>
                    <td className="cifra px-2 py-3 font-semibold">
                      <span className={v.stock_bajo ? 'text-error' : ''}>{numero(v.stock)}</span>
                    </td>
                    <td className="cifra px-2 py-3 text-tinta-suave">{numero(v.stock_minimo)}</td>
                    <td className="cifra px-2 py-3 text-tinta-suave">{soles(v.costo_promedio)}</td>
                    <td className="cifra px-2 py-3 font-semibold">{soles(v.valor_inventario)}</td>
                    <td className="px-2 py-3">
                      {v.stock_bajo && <Etiqueta texto="Reponer" tono="rojo" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 p-4 md:hidden">
            {stock.map((v) => (
              <div key={v.variante_id} className="rounded-xl border border-borde p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-tinta">{v.producto}</p>
                    <p className="truncate text-xs text-tinta-suave">{v.variante} · {v.sku}</p>
                  </div>
                  {v.stock_bajo && <Etiqueta texto="Reponer" tono="rojo" />}
                </div>
                <div className="flex justify-between py-0.5 text-sm">
                  <span className="text-tinta-suave">Stock (mín. {numero(v.stock_minimo)})</span>
                  <span className={`cifra font-bold ${v.stock_bajo ? 'text-error' : 'text-tinta'}`}>
                    {numero(v.stock)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 text-sm">
                  <span className="text-tinta-suave">Valor</span>
                  <span className="cifra font-semibold">{soles(v.valor_inventario)}</span>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      ) : (
        <Vacio
          mensaje="No hay productos en inventario"
          descripcion="Crea productos y confirma una compra para que entre stock."
        />
      )}

      <div className="mt-4">
        <Tarjeta titulo="Últimos movimientos" sinRelleno>
          {movimientos && movimientos.length > 0 ? (
            <ul className="flex flex-col divide-y divide-borde-suave px-5 pb-5">
              {movimientos.map((m) => {
                const v = m.variantes as unknown as {
                  sku: string; nombre: string; productos: { nombre: string } | null
                }
                const entra = Number(m.cantidad) > 0
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-tinta">
                        {v?.productos?.nombre}
                      </p>
                      <p className="truncate text-xs text-tinta-suave">
                        {NOMBRE_MOVIMIENTO[m.tipo] ?? m.tipo} · {fechaHora(m.created_at)}
                        {m.motivo && ` · ${m.motivo}`}
                      </p>
                    </div>
                    <span
                      className={`cifra shrink-0 text-sm font-bold ${entra ? 'text-exito' : 'text-error'}`}
                    >
                      {entra ? '+' : ''}
                      {numero(m.cantidad)}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-5 pb-5">
              <Vacio mensaje="Todavía no hay movimientos de inventario" />
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
