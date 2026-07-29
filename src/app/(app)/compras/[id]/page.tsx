import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero, fecha } from '@/lib/format'
import { METODOS_PAGO } from '@/lib/tipos'
import {
  Aviso, Boton, Campo, EstadoDoc, Input, Select, Tabla, Tarjeta, TextArea, TituloPagina, Vacio,
} from '@/components/ui'
import {
  agregarItemCompra, quitarItemCompra, aplicarDescuentoCompra,
  confirmarCompra, anularCompra, registrarPagoCompra,
} from '../actions'

export default async function DetalleCompra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const perfil = await requerirRol('admin', 'almacen', 'contador')
  const supabase = await createClient()

  const { data: compra } = await supabase
    .from('compras')
    .select('*, proveedores(nombre, telefono)')
    .eq('id', id)
    .single()

  if (!compra) notFound()

  const [{ data: items }, { data: pagos }, { data: variantes }] = await Promise.all([
    supabase
      .from('compra_items')
      .select('id, cantidad, costo_unitario, subtotal, variantes(sku, nombre, productos(nombre))')
      .eq('compra_id', id)
      .order('created_at'),
    supabase.from('pagos_compra').select('*').eq('compra_id', id).order('fecha'),
    supabase
      .from('v_stock_actual')
      .select('variante_id, sku, producto, variante, stock, costo_promedio')
      .eq('activo', true)
      .order('producto'),
  ])

  const pagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0)
  const saldo = Number(compra.total) - pagado
  const esBorrador = compra.estado === 'borrador'
  const puedeOperar = perfil.rol === 'admin' || perfil.rol === 'almacen'
  const proveedor = compra.proveedores as { nombre: string; telefono: string | null } | null
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <Link href="/compras" className="mb-3 inline-block text-sm text-gray-600 underline">
        ← Volver a compras
      </Link>

      <TituloPagina
        titulo={`Compra ${compra.numero_documento ?? ''}`}
        descripcion={`${fecha(compra.fecha)} · ${proveedor?.nombre ?? 'Sin proveedor'}`}
        accion={<EstadoDoc estado={compra.estado} />}
      />

      {esBorrador && (
        <div className="mb-4">
          <Aviso tipo="ok">
            Compra en <strong>borrador</strong>: todavía no ingresa stock. Carga los productos y
            confírmala para que entren al inventario.
          </Aviso>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {esBorrador && puedeOperar && (
            <Tarjeta titulo="Agregar producto">
              <form action={agregarItemCompra} className="grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="compra_id" value={compra.id} />
                <div className="sm:col-span-2">
                  <Campo etiqueta="Producto">
                    <Select name="variante_id" required defaultValue="">
                      <option value="" disabled>Elige un producto…</option>
                      {variantes?.map((v) => (
                        <option key={v.variante_id} value={v.variante_id}>
                          {v.producto} · {v.variante} (stock {numero(v.stock)})
                        </option>
                      ))}
                    </Select>
                  </Campo>
                </div>
                <Campo etiqueta="Cantidad">
                  <Input name="cantidad" type="number" step="0.01" min="0.01" defaultValue="1" required />
                </Campo>
                <Campo etiqueta="Costo unitario (S/)">
                  <Input name="costo_unitario" type="number" step="0.01" min="0" defaultValue="0" required />
                </Campo>
                <div className="sm:col-span-4">
                  <Boton type="submit">Agregar</Boton>
                </div>
              </form>
            </Tarjeta>
          )}

          <div className="mt-4">
            <Tarjeta titulo="Productos de esta compra">
              {items && items.length > 0 ? (
                <Tabla cabeceras={['Producto', 'Cant.', 'Costo', 'Subtotal', '']}>
                  {items.map((it) => {
                    const v = it.variantes as unknown as {
                      sku: string; nombre: string; productos: { nombre: string } | null
                    }
                    return (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          <span className="block font-medium text-gray-900">{v?.productos?.nombre}</span>
                          <span className="text-xs text-gray-500">{v?.nombre} · {v?.sku}</span>
                        </td>
                        <td className="px-3 py-2">{numero(it.cantidad)}</td>
                        <td className="px-3 py-2">{soles(it.costo_unitario)}</td>
                        <td className="px-3 py-2 font-medium">{soles(it.subtotal)}</td>
                        <td className="px-3 py-2 text-right">
                          {esBorrador && puedeOperar && (
                            <form action={quitarItemCompra}>
                              <input type="hidden" name="id" value={it.id} />
                              <input type="hidden" name="compra_id" value={compra.id} />
                              <button type="submit" className="text-sm text-red-600 underline">Quitar</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Tabla>
              ) : (
                <Vacio mensaje="Esta compra todavía no tiene productos." />
              )}
            </Tarjeta>
          </div>
        </div>

        <div className="space-y-4">
          <Tarjeta titulo="Resumen">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Subtotal</dt>
                <dd>{soles(compra.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Descuento</dt>
                <dd>− {soles(compra.descuento)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{soles(compra.total)}</dd>
              </div>
              {compra.estado === 'confirmada' && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Pagado</dt>
                    <dd className="text-green-700">{soles(pagado)}</dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>Saldo</dt>
                    <dd className={saldo > 0 ? 'text-red-600' : 'text-green-700'}>{soles(saldo)}</dd>
                  </div>
                </>
              )}
            </dl>

            {esBorrador && puedeOperar && (
              <>
                <form action={aplicarDescuentoCompra} className="mt-4 flex gap-2 border-t border-gray-200 pt-3">
                  <input type="hidden" name="compra_id" value={compra.id} />
                  <Input name="descuento" type="number" step="0.01" min="0" defaultValue={compra.descuento} />
                  <Boton type="submit" variante="secundario">Aplicar</Boton>
                </form>

                <form action={confirmarCompra} className="mt-3">
                  <input type="hidden" name="compra_id" value={compra.id} />
                  <Boton type="submit" className="w-full">Confirmar compra</Boton>
                  <p className="mt-2 text-xs text-gray-500">
                    Al confirmar entra el stock y se recalcula el costo promedio.
                  </p>
                </form>
              </>
            )}

            {compra.estado === 'confirmada' && puedeOperar && (
              <details className="mt-4 border-t border-gray-200 pt-3">
                <summary className="cursor-pointer text-sm text-red-600 underline">Anular compra</summary>
                <form action={anularCompra} className="mt-2 space-y-2">
                  <input type="hidden" name="compra_id" value={compra.id} />
                  <TextArea name="motivo" rows={2} placeholder="Motivo de la anulación" />
                  <Boton type="submit" variante="peligro" className="w-full">
                    Anular y sacar el stock
                  </Boton>
                </form>
              </details>
            )}
          </Tarjeta>

          {compra.estado === 'confirmada' && (
            <Tarjeta titulo="Pagos al proveedor">
              {pagos && pagos.length > 0 ? (
                <ul className="mb-3 space-y-2 text-sm">
                  {pagos.map((p) => (
                    <li key={p.id} className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-600">{fecha(p.fecha)} · {p.metodo}</span>
                      <span className="font-medium">{soles(p.monto)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-gray-500">Sin pagos registrados.</p>
              )}

              {saldo > 0 && puedeOperar && (
                <form action={registrarPagoCompra} className="space-y-2 border-t border-gray-200 pt-3">
                  <input type="hidden" name="compra_id" value={compra.id} />
                  <Campo etiqueta="Monto (S/)">
                    <Input name="monto" type="number" step="0.01" min="0.01" max={saldo} defaultValue={saldo.toFixed(2)} required />
                  </Campo>
                  <Campo etiqueta="Método">
                    <Select name="metodo" defaultValue="efectivo">
                      {METODOS_PAGO.map((m) => (
                        <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo etiqueta="Fecha">
                    <Input name="fecha" type="date" defaultValue={hoy} />
                  </Campo>
                  <Campo etiqueta="Referencia">
                    <Input name="referencia" placeholder="N° de operación" />
                  </Campo>
                  <Boton type="submit" className="w-full">Registrar pago</Boton>
                </form>
              )}
            </Tarjeta>
          )}

          {compra.notas && (
            <Tarjeta titulo="Notas">
              <p className="text-sm text-gray-600">{compra.notas}</p>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  )
}
