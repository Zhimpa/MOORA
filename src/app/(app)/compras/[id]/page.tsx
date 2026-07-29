import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero, fecha } from '@/lib/format'
import { METODOS_PAGO } from '@/lib/tipos'
import { Aviso, Campo, EstadoDoc, Input, Select, Tarjeta, TituloPagina, Vacio } from '@/components/ui'
import { Panel, ConfirmarAccion } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
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
  const proveedor = compra.proveedores as unknown as { nombre: string; telefono: string | null } | null
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <Link
        href="/compras"
        className="mb-4 inline-block text-sm font-semibold text-vino underline-offset-4 hover:underline"
      >
        ← Volver a compras
      </Link>

      <TituloPagina
        titulo={`Compra ${compra.numero_documento ?? ''}`}
        descripcion={`${fecha(compra.fecha)} · ${proveedor?.nombre ?? 'Sin proveedor'}`}
        accion={<EstadoDoc estado={compra.estado} />}
      />

      {esBorrador && (
        <div className="mb-4">
          <Aviso tipo="alerta">
            Compra en <strong>borrador</strong>: todavía no ingresa stock. Carga los productos y
            confírmala para que entren al inventario.
          </Aviso>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tarjeta
            titulo="Productos de esta compra"
            accion={
              esBorrador && puedeOperar ? (
                <Panel etiqueta="+ Agregar" titulo="Agregar producto" descripcion="Costo de compra">
                  <form action={agregarItemCompra} className="flex flex-col gap-4">
                    <input type="hidden" name="compra_id" value={compra.id} />
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
                    <Campo etiqueta="Cantidad">
                      <Input name="cantidad" type="number" step="0.01" min="0.01" defaultValue="1" required />
                    </Campo>
                    <Campo
                      etiqueta="Costo unitario (S/)"
                      ayuda="Lo que te cobra el proveedor por unidad."
                    >
                      <Input name="costo_unitario" type="number" step="0.01" min="0" defaultValue="0" required />
                    </Campo>
                    <BotonEnviar className="w-full">Agregar a la compra</BotonEnviar>
                  </form>
                </Panel>
              ) : undefined
            }
          >
            {items && items.length > 0 ? (
              <ul className="flex flex-col divide-y divide-borde-suave">
                {items.map((it) => {
                  const v = it.variantes as unknown as {
                    sku: string; nombre: string; productos: { nombre: string } | null
                  }
                  return (
                    <li key={it.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                      <div className="min-w-0">
                        <p className="font-semibold text-tinta">{v?.productos?.nombre}</p>
                        <p className="text-xs text-tinta-suave">{v?.nombre} · {v?.sku}</p>
                        <p className="cifra mt-1 text-xs text-tinta-suave">
                          {numero(it.cantidad)} × {soles(it.costo_unitario)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="cifra font-bold text-tinta">{soles(it.subtotal)}</p>
                        {esBorrador && puedeOperar && (
                          <form action={quitarItemCompra} className="mt-1">
                            <input type="hidden" name="id" value={it.id} />
                            <input type="hidden" name="compra_id" value={compra.id} />
                            <button type="submit" className="text-xs font-semibold text-error underline-offset-4 hover:underline">
                              Quitar
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Vacio
                mensaje="Esta compra todavía no tiene productos"
                descripcion="Agrega al menos uno para poder confirmarla."
              />
            )}
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Resumen">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Subtotal</dt>
                <dd className="cifra">{soles(compra.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Descuento</dt>
                <dd className="cifra">− {soles(compra.descuento)}</dd>
              </div>
              <div className="flex justify-between border-t border-borde pt-2 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="cifra font-bold">{soles(compra.total)}</dd>
              </div>
              {compra.estado === 'confirmada' && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-tinta-suave">Pagado</dt>
                    <dd className="cifra text-exito">{soles(pagado)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Saldo</dt>
                    <dd className={`cifra ${saldo > 0 ? 'text-error' : 'text-exito'}`}>
                      {soles(saldo)}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {esBorrador && puedeOperar && (
              <div className="mt-4 flex flex-col gap-3 border-t border-borde pt-4">
                <form action={aplicarDescuentoCompra} className="flex items-end gap-2">
                  <input type="hidden" name="compra_id" value={compra.id} />
                  <div className="flex-1">
                    <Campo etiqueta="Descuento (S/)">
                      <Input name="descuento" type="number" step="0.01" min="0" defaultValue={compra.descuento} />
                    </Campo>
                  </div>
                  <BotonEnviar variante="secundario" pendienteTexto="…">Aplicar</BotonEnviar>
                </form>

                <ConfirmarAccion
                  etiqueta="Confirmar compra"
                  titulo="¿Confirmar esta compra?"
                  mensaje={
                    <>
                      Entrará el stock al inventario y se recalculará el costo promedio de cada
                      producto. Esta acción <strong>no se puede deshacer</strong>, solo anular después.
                    </>
                  }
                  etiquetaConfirmar="Sí, confirmar"
                  className="w-full"
                >
                  <form action={confirmarCompra}>
                    <input type="hidden" name="compra_id" value={compra.id} />
                  </form>
                </ConfirmarAccion>
              </div>
            )}

            {compra.estado === 'confirmada' && puedeOperar && (
              <div className="mt-4 border-t border-borde pt-4">
                <ConfirmarAccion
                  etiqueta="Anular compra"
                  titulo="¿Anular esta compra?"
                  mensaje="Se sacará del inventario el stock que había ingresado y la compra quedará anulada."
                  etiquetaConfirmar="Sí, anular"
                  variante="peligro"
                  className="w-full"
                >
                  <form action={anularCompra}>
                    <input type="hidden" name="compra_id" value={compra.id} />
                    <input type="hidden" name="motivo" value="Anulada desde el detalle de la compra" />
                  </form>
                </ConfirmarAccion>
              </div>
            )}
          </Tarjeta>

          {compra.estado === 'confirmada' && (
            <Tarjeta
              titulo="Pagos al proveedor"
              accion={
                saldo > 0 && puedeOperar ? (
                  <Panel
                    etiqueta="+ Pagar"
                    titulo="Registrar pago"
                    descripcion={`Saldo pendiente: ${soles(saldo)}`}
                  >
                    <form action={registrarPagoCompra} className="flex flex-col gap-4">
                      <input type="hidden" name="compra_id" value={compra.id} />
                      <Campo etiqueta="Monto (S/)">
                        <Input
                          name="monto"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={saldo}
                          defaultValue={saldo.toFixed(2)}
                          required
                        />
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
                      <BotonEnviar className="w-full">Registrar pago</BotonEnviar>
                    </form>
                  </Panel>
                ) : undefined
              }
            >
              {pagos && pagos.length > 0 ? (
                <ul className="flex flex-col divide-y divide-borde-suave text-sm">
                  {pagos.map((p) => (
                    <li key={p.id} className="flex justify-between py-2 first:pt-0">
                      <span className="capitalize text-tinta-suave">
                        {fecha(p.fecha)} · {p.metodo}
                      </span>
                      <span className="cifra font-semibold">{soles(p.monto)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-tinta-suave">Sin pagos registrados.</p>
              )}
            </Tarjeta>
          )}

          {compra.notas && (
            <Tarjeta titulo="Notas">
              <p className="text-sm text-tinta-media">{compra.notas}</p>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  )
}
