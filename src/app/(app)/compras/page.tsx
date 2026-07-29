import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { Campo, EstadoDoc, Input, Select, Tarjeta, TextArea, TituloPagina, Vacio, BotonLink } from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { crearCompra } from './actions'

export const metadata = { title: 'Compras — MOORA' }

export default async function ComprasPage() {
  const perfil = await requerirRol('admin', 'almacen', 'contador')
  const supabase = await createClient()

  const [{ data: compras }, { data: proveedores }, { data: saldos }] = await Promise.all([
    supabase
      .from('compras')
      .select('id, numero_documento, fecha, total, estado, proveedores(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('v_cuentas_por_pagar').select('compra_id, saldo'),
  ])

  const saldoPorCompra = new Map((saldos ?? []).map((s) => [s.compra_id, Number(s.saldo)]))
  const puedeComprar = perfil.rol === 'admin' || perfil.rol === 'almacen'
  const hayProveedores = (proveedores?.length ?? 0) > 0
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <TituloPagina
        titulo="Compras"
        descripcion="Mercadería que entra desde proveedores"
        accion={
          puedeComprar && hayProveedores ? (
            <Panel
              etiqueta="+ Nueva compra"
              titulo="Nueva compra"
              descripcion="Se crea en borrador; el stock entra al confirmarla."
            >
              <form action={crearCompra} className="flex flex-col gap-4">
                <Campo etiqueta="Proveedor *">
                  <Select name="proveedor_id" required defaultValue="">
                    <option value="" disabled>Elige un proveedor…</option>
                    {proveedores?.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </Select>
                </Campo>
                <Campo etiqueta="N° de documento" ayuda="Factura o boleta del proveedor.">
                  <Input name="numero_documento" />
                </Campo>
                <Campo etiqueta="Fecha">
                  <Input name="fecha" type="date" defaultValue={hoy} />
                </Campo>
                <Campo etiqueta="Notas">
                  <TextArea name="notas" rows={2} />
                </Campo>
                <BotonEnviar className="w-full" pendienteTexto="Creando…">
                  Crear y agregar productos
                </BotonEnviar>
              </form>
            </Panel>
          ) : undefined
        }
      />

      {puedeComprar && !hayProveedores && (
        <div className="mb-4">
          <Vacio
            mensaje="Primero registra un proveedor"
            descripcion="Una compra siempre viene de alguien: necesitas al menos un proveedor."
            accion={<BotonLink href="/proveedores">Ir a proveedores</BotonLink>}
          />
        </div>
      )}

      {compras && compras.length > 0 ? (
        <Tarjeta sinRelleno>
          <div className="hidden px-5 py-4 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['Documento', 'Fecha', 'Proveedor', 'Total', 'Saldo', 'Estado', ''].map((c) => (
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
                {compras.map((c) => {
                  const saldo = saldoPorCompra.get(c.id) ?? 0
                  const proveedor =
                    (c.proveedores as unknown as { nombre: string } | null)?.nombre ?? '—'
                  return (
                    <tr key={c.id} className="border-b border-borde-suave last:border-0">
                      <td className="px-2 py-3 font-semibold text-tinta">
                        {c.numero_documento ?? 'Sin N°'}
                      </td>
                      <td className="px-2 py-3 text-tinta-suave">{fecha(c.fecha)}</td>
                      <td className="px-2 py-3">{proveedor}</td>
                      <td className="cifra px-2 py-3 font-bold">{soles(c.total)}</td>
                      <td className="cifra px-2 py-3">
                        {saldo > 0 ? (
                          <span className="font-bold text-error">{soles(saldo)}</span>
                        ) : c.estado === 'confirmada' ? (
                          <span className="text-sm font-semibold text-exito">Pagada</span>
                        ) : (
                          <span className="text-tinta-tenue">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3"><EstadoDoc estado={c.estado} /></td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          href={`/compras/${c.id}`}
                          className="text-sm font-semibold text-vino underline-offset-4 hover:underline"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 p-4 md:hidden">
            {compras.map((c) => {
              const saldo = saldoPorCompra.get(c.id) ?? 0
              const proveedor =
                (c.proveedores as unknown as { nombre: string } | null)?.nombre ?? '—'
              return (
                <Link
                  key={c.id}
                  href={`/compras/${c.id}`}
                  className="block rounded-xl border border-borde p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-tinta">{proveedor}</p>
                      <p className="truncate text-xs text-tinta-suave">
                        {c.numero_documento ?? 'Sin N°'} · {fecha(c.fecha)}
                      </p>
                    </div>
                    <EstadoDoc estado={c.estado} />
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-tinta-suave">Total</span>
                    <span className="cifra font-bold text-tinta">{soles(c.total)}</span>
                  </div>
                  {saldo > 0 && (
                    <div className="flex justify-between py-0.5 text-sm">
                      <span className="text-tinta-suave">Saldo</span>
                      <span className="cifra font-bold text-error">{soles(saldo)}</span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </Tarjeta>
      ) : (
        hayProveedores && (
          <Vacio
            mensaje="Aún no hay compras registradas"
            descripcion="Registra una compra y confírmala para que entre stock al inventario."
          />
        )
      )}
    </>
  )
}
