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
  agregarItemVenta, quitarItemVenta, aplicarDescuentoVenta,
  confirmarVenta, anularVenta, registrarPagoVenta,
} from '../actions'

export default async function DetalleVenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const perfil = await requerirRol('admin', 'vendedor', 'contador')
  const supabase = await createClient()

  const { data: venta } = await supabase
    .from('ventas')
    .select('*, clientes(nombre, tipo, telefono)')
    .eq('id', id)
    .single()

  if (!venta) notFound()

  const [{ data: items }, { data: pagos }, { data: variantes }] = await Promise.all([
    supabase
      .from('venta_items')
      .select('id, cantidad, precio_unitario, subtotal, variantes(sku, nombre, stock, productos(nombre))')
      .eq('venta_id', id)
      .order('created_at'),
    supabase.from('pagos_venta').select('*').eq('venta_id', id).order('fecha'),
    supabase
      .from('v_stock_actual')
      .select('variante_id, sku, producto, variante, stock, precio_venta_menor, precio_venta_mayor')
      .eq('activo', true)
      .order('producto'),
  ])

  const pagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0)
  const saldo = Number(venta.total) - pagado
  const esBorrador = venta.estado === 'borrador'
  const puedeOperar = perfil.rol === 'admin' || perfil.rol === 'vendedor'
  const cliente = venta.clientes as { nombre: string; tipo: string; telefono: string | null } | null
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <Link href="/ventas" className="mb-3 inline-block text-sm text-gray-600 underline">
        ← Volver a ventas
      </Link>

      <TituloPagina
        titulo={`Venta ${venta.numero}`}
        descripcion={`${fecha(venta.fecha)} · ${cliente?.nombre ?? 'Mostrador'} · ${
          venta.tipo === 'mayorista' ? 'Precio por mayor' : 'Precio por menor'
        }`}
        accion={<EstadoDoc estado={venta.estado} />}
      />

      {esBorrador && (
        <div className="mb-4">
          <Aviso tipo="ok">
            Esta venta está en <strong>borrador</strong>: todavía no descuenta stock. Agrega los
            productos y luego confírmala.
          </Aviso>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {esBorrador && puedeOperar && (
            <Tarjeta titulo="Agregar producto">
              <form action={agregarItemVenta} className="grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="venta_id" value={venta.id} />
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
                <Campo etiqueta="Precio (S/)" ayuda="Vacío = precio de lista.">
                  <Input name="precio_unitario" type="number" step="0.01" min="0" placeholder="Automático" />
                </Campo>
                <div className="sm:col-span-4">
                  <Boton type="submit">Agregar</Boton>
                </div>
              </form>
            </Tarjeta>
          )}

          <div className="mt-4">
            <Tarjeta titulo="Productos de esta venta">
              {items && items.length > 0 ? (
                <Tabla cabeceras={['Producto', 'Cant.', 'Precio', 'Subtotal', '']}>
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
                        <td className="px-3 py-2">{soles(it.precio_unitario)}</td>
                        <td className="px-3 py-2 font-medium">{soles(it.subtotal)}</td>
                        <td className="px-3 py-2 text-right">
                          {esBorrador && puedeOperar && (
                            <form action={quitarItemVenta}>
                              <input type="hidden" name="id" value={it.id} />
                              <input type="hidden" name="venta_id" value={venta.id} />
                              <button type="submit" className="text-sm text-red-600 underline">
                                Quitar
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Tabla>
              ) : (
                <Vacio mensaje="Esta venta todavía no tiene productos." />
              )}
            </Tarjeta>
          </div>
        </div>

        <div className="space-y-4">
          <Tarjeta titulo="Resumen">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Subtotal</dt>
                <dd>{soles(venta.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Descuento</dt>
                <dd>− {soles(venta.descuento)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{soles(venta.total)}</dd>
              </div>
              {venta.estado === 'confirmada' && (
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
                <form action={aplicarDescuentoVenta} className="mt-4 flex gap-2 border-t border-gray-200 pt-3">
                  <input type="hidden" name="venta_id" value={venta.id} />
                  <Input name="descuento" type="number" step="0.01" min="0" defaultValue={venta.descuento} />
                  <Boton type="submit" variante="secundario">Aplicar</Boton>
                </form>

                <form action={confirmarVenta} className="mt-3">
                  <input type="hidden" name="venta_id" value={venta.id} />
                  <Boton type="submit" className="w-full">Confirmar venta</Boton>
                  <p className="mt-2 text-xs text-gray-500">
                    Al confirmar se descuenta el stock y la venta ya no se puede editar.
                  </p>
                </form>
              </>
            )}

            {venta.estado === 'confirmada' && puedeOperar && (
              <details className="mt-4 border-t border-gray-200 pt-3">
                <summary className="cursor-pointer text-sm text-red-600 underline">Anular venta</summary>
                <form action={anularVenta} className="mt-2 space-y-2">
                  <input type="hidden" name="venta_id" value={venta.id} />
                  <TextArea name="motivo" rows={2} placeholder="Motivo de la anulación" />
                  <Boton type="submit" variante="peligro" className="w-full">
                    Anular y devolver el stock
                  </Boton>
                </form>
              </details>
            )}
          </Tarjeta>

          {venta.estado === 'confirmada' && (
            <Tarjeta titulo="Pagos">
              {pagos && pagos.length > 0 ? (
                <ul className="mb-3 space-y-2 text-sm">
                  {pagos.map((p) => (
                    <li key={p.id} className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-600">
                        {fecha(p.fecha)} · {p.metodo}
                      </span>
                      <span className="font-medium">{soles(p.monto)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-gray-500">Sin pagos registrados.</p>
              )}

              {saldo > 0 && puedeOperar && (
                <form action={registrarPagoVenta} className="space-y-2 border-t border-gray-200 pt-3">
                  <input type="hidden" name="venta_id" value={venta.id} />
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

          {venta.notas && (
            <Tarjeta titulo="Notas">
              <p className="text-sm text-gray-600">{venta.notas}</p>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  )
}
