import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero, fecha } from '@/lib/format'
import { METODOS_PAGO, PLATAFORMAS_VENTA } from '@/lib/tipos'
import {
  Aviso, BotonLink, Campo, EstadoDoc, Etiqueta, Input, Select, Tarjeta, TituloPagina, Vacio,
} from '@/components/ui'
import { Panel, ConfirmarAccion } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import {
  agregarItemVenta, quitarItemVenta, aplicarDescuentoVenta, actualizarOrigenVenta,
  confirmarVenta, anularVenta, registrarPagoVenta,
} from '../actions'

export default async function DetalleVenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const perfil = await requerirRol('admin', 'vendedor', 'contador')
  const supabase = await createClient()

  const { data: venta } = await supabase
    .from('ventas')
    .select('*, clientes(nombre, tipo, telefono), asesores_venta(id, nombre)')
    .eq('id', id)
    .single()

  if (!venta) notFound()

  const [{ data: items }, { data: pagos }, { data: variantes }, { data: asesores }] = await Promise.all([
    supabase
      .from('venta_items')
      .select('id, cantidad, precio_unitario, subtotal, variantes(sku, nombre, stock, productos(nombre))')
      .eq('venta_id', id)
      .order('created_at'),
    supabase.from('pagos_venta').select('*').eq('venta_id', id).order('fecha'),
    supabase
      .from('v_stock_actual')
      .select('variante_id, sku, producto, variante, stock')
      .eq('activo', true)
      .order('producto'),
    supabase.from('asesores_venta').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  const pagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0)
  const saldo = Number(venta.total) - pagado
  const esBorrador = venta.estado === 'borrador'
  const puedeOperar = perfil.rol === 'admin' || perfil.rol === 'vendedor'
  const cliente = venta.clientes as unknown as { nombre: string; telefono: string | null } | null
  const asesorActual = venta.asesores_venta as unknown as { id: string; nombre: string } | null
  const hoy = new Date().toISOString().slice(0, 10)
  const etiquetaPlataforma =
    PLATAFORMAS_VENTA.find((p) => p.valor === venta.plataforma)?.etiqueta ?? venta.plataforma
  // Si el asesor asignado fue desactivado después, igual debe aparecer en el selector.
  const opcionesAsesor =
    asesorActual && !asesores?.some((a) => a.id === asesorActual.id)
      ? [...(asesores ?? []), asesorActual]
      : (asesores ?? [])

  return (
    <>
      <Link
        href="/ventas"
        className="mb-4 inline-block text-sm font-semibold text-vino underline-offset-4 hover:underline"
      >
        ← Volver a ventas
      </Link>

      <TituloPagina
        titulo={`Venta ${venta.numero}`}
        descripcion={`${fecha(venta.fecha)} · ${
          venta.comprador_nombre ?? cliente?.nombre ?? 'Mostrador'
        } · ${venta.tipo === 'mayorista' ? 'Precio por mayor' : 'Precio por menor'}`}
        accion={
          <div className="flex flex-wrap items-center gap-2.5">
            <EstadoDoc estado={venta.estado} />
            {items && items.length > 0 && (
              <BotonLink href={`/ventas/${venta.id}/boleta`} variante="secundario">
                Descargar boleta (PDF)
              </BotonLink>
            )}
          </div>
        }
      />

      {esBorrador && (
        <div className="mb-4">
          <Aviso tipo="alerta">
            Esta venta está en <strong>borrador</strong>: todavía no descuenta stock. Agrega los
            productos y luego confírmala.
          </Aviso>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tarjeta
            titulo="Productos de esta venta"
            accion={
              esBorrador && puedeOperar ? (
                <Panel etiqueta="+ Agregar" titulo="Agregar producto" descripcion={`Venta ${venta.numero}`}>
                  <form action={agregarItemVenta} className="flex flex-col gap-4">
                    <input type="hidden" name="venta_id" value={venta.id} />
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
                    <Campo etiqueta="Precio unitario (S/)" ayuda="Vacío = precio de lista según el tipo de venta.">
                      <Input name="precio_unitario" type="number" step="0.01" min="0" placeholder="Automático" />
                    </Campo>
                    <BotonEnviar className="w-full">Agregar a la venta</BotonEnviar>
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
                          {numero(it.cantidad)} × {soles(it.precio_unitario)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="cifra font-bold text-tinta">{soles(it.subtotal)}</p>
                        {esBorrador && puedeOperar && (
                          <form action={quitarItemVenta} className="mt-1">
                            <input type="hidden" name="id" value={it.id} />
                            <input type="hidden" name="venta_id" value={venta.id} />
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
                mensaje="Esta venta todavía no tiene productos"
                descripcion="Agrega al menos uno para poder confirmarla."
              />
            )}
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-4">
          <Tarjeta
            titulo="Comprador y origen"
            accion={
              esBorrador && puedeOperar ? (
                <Panel
                  etiqueta="Editar"
                  titulo="Comprador y origen"
                  descripcion={`Venta ${venta.numero}`}
                  variante="secundario"
                >
                  <form action={actualizarOrigenVenta} className="flex flex-col gap-4">
                    <input type="hidden" name="venta_id" value={venta.id} />
                    <Campo etiqueta="Nombre del comprador" ayuda="Útil si no es un cliente registrado.">
                      <Input name="comprador_nombre" defaultValue={venta.comprador_nombre ?? ''} />
                    </Campo>
                    <Campo etiqueta="Documento de identidad" ayuda="Opcional.">
                      <Input name="comprador_documento" defaultValue={venta.comprador_documento ?? ''} />
                    </Campo>
                    <Campo etiqueta="¿De dónde viene la venta?">
                      <Select name="plataforma" defaultValue={venta.plataforma}>
                        {PLATAFORMAS_VENTA.map((p) => (
                          <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
                        ))}
                      </Select>
                    </Campo>
                    <Campo
                      etiqueta="Asesor de venta"
                      ayuda="Se gestionan en Vendedores."
                    >
                      <Select name="asesor_id" defaultValue={venta.asesor_id ?? ''}>
                        <option value="">— Ninguno —</option>
                        {opcionesAsesor.map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                      </Select>
                    </Campo>
                    <Campo
                      etiqueta="Comisión (S/)"
                      ayuda="Se descuenta de la utilidad neta, no del total que paga el cliente."
                    >
                      <Input
                        name="comision_monto"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={venta.comision_monto}
                      />
                    </Campo>
                    <BotonEnviar className="w-full" pendienteTexto="Guardando…">
                      Guardar
                    </BotonEnviar>
                  </form>
                </Panel>
              ) : undefined
            }
          >
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Comprador</dt>
                <dd className="text-right font-semibold text-tinta">
                  {venta.comprador_nombre ?? cliente?.nombre ?? 'Mostrador'}
                </dd>
              </div>
              {venta.comprador_documento && (
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-suave">Documento</dt>
                  <dd className="text-right text-tinta">{venta.comprador_documento}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Canal</dt>
                <dd>
                  <Etiqueta texto={etiquetaPlataforma} tono={venta.plataforma === 'tienda_fisica' ? 'gris' : 'vino'} />
                </dd>
              </div>
              {asesorActual && (
                <>
                  <div className="flex justify-between gap-3 border-t border-borde pt-2">
                    <dt className="text-tinta-suave">Asesor</dt>
                    <dd className="text-right font-semibold text-tinta">{asesorActual.nombre}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-tinta-suave">Comisión</dt>
                    <dd className="cifra text-right font-semibold text-error">
                      − {soles(venta.comision_monto)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Resumen">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Subtotal</dt>
                <dd className="cifra">{soles(venta.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Descuento</dt>
                <dd className="cifra">− {soles(venta.descuento)}</dd>
              </div>
              <div className="flex justify-between border-t border-borde pt-2 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="cifra font-bold">{soles(venta.total)}</dd>
              </div>
              {venta.estado === 'confirmada' && (
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
                <form action={aplicarDescuentoVenta} className="flex items-end gap-2">
                  <input type="hidden" name="venta_id" value={venta.id} />
                  <div className="flex-1">
                    <Campo etiqueta="Descuento (S/)">
                      <Input name="descuento" type="number" step="0.01" min="0" defaultValue={venta.descuento} />
                    </Campo>
                  </div>
                  <BotonEnviar variante="secundario" pendienteTexto="…">Aplicar</BotonEnviar>
                </form>

                <ConfirmarAccion
                  etiqueta="Confirmar venta"
                  titulo="¿Confirmar esta venta?"
                  mensaje={
                    <>
                      Al confirmar se descuenta el stock automáticamente. Esta acción{' '}
                      <strong>no se puede deshacer</strong>, solo anular después.
                    </>
                  }
                  etiquetaConfirmar="Sí, confirmar"
                  className="w-full"
                >
                  <form action={confirmarVenta}>
                    <input type="hidden" name="venta_id" value={venta.id} />
                  </form>
                </ConfirmarAccion>
              </div>
            )}

            {venta.estado === 'confirmada' && puedeOperar && (
              <div className="mt-4 border-t border-borde pt-4">
                <ConfirmarAccion
                  etiqueta="Anular venta"
                  titulo="¿Anular esta venta?"
                  mensaje="Se devolverá el stock al inventario y la venta quedará marcada como anulada."
                  etiquetaConfirmar="Sí, anular"
                  variante="peligro"
                  className="w-full"
                >
                  <form action={anularVenta}>
                    <input type="hidden" name="venta_id" value={venta.id} />
                    <input type="hidden" name="motivo" value="Anulada desde el detalle de la venta" />
                  </form>
                </ConfirmarAccion>
              </div>
            )}
          </Tarjeta>

          {venta.estado === 'confirmada' && (
            <Tarjeta
              titulo="Cobros"
              accion={
                saldo > 0 && puedeOperar ? (
                  <Panel
                    etiqueta="+ Cobrar"
                    titulo="Registrar cobro"
                    descripcion={`Saldo pendiente: ${soles(saldo)}`}
                  >
                    <form action={registrarPagoVenta} className="flex flex-col gap-4">
                      <input type="hidden" name="venta_id" value={venta.id} />
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
                      <BotonEnviar className="w-full">Registrar cobro</BotonEnviar>
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
                <p className="text-sm text-tinta-suave">Sin cobros registrados.</p>
              )}
            </Tarjeta>
          )}

          {venta.notas && (
            <Tarjeta titulo="Notas">
              <p className="text-sm text-tinta-media">{venta.notas}</p>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  )
}
