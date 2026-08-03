import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { Campo, EstadoDoc, Input, Select, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { PLATAFORMAS_VENTA } from '@/lib/tipos'
import { crearVenta } from './actions'

export const metadata = { title: 'Salidas — MOORA' }

export default async function VentasPage() {
  const perfil = await requerirRol('admin', 'vendedor', 'contador')
  const supabase = await createClient()

  const [{ data: ventas }, { data: saldos }, { data: asesores }] = await Promise.all([
    supabase
      .from('ventas')
      .select('id, numero, fecha, total, estado, tipo, plataforma, comprador_nombre, clientes(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('v_cuentas_por_cobrar').select('venta_id, saldo'),
    supabase.from('asesores_venta').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  const saldoPorVenta = new Map((saldos ?? []).map((s) => [s.venta_id, Number(s.saldo)]))
  const puedeVender = perfil.rol === 'admin' || perfil.rol === 'vendedor'
  const hoy = new Date().toISOString().slice(0, 10)
  const etiquetaPlataforma = (valor: string) =>
    PLATAFORMAS_VENTA.find((p) => p.valor === valor)?.etiqueta ?? valor

  return (
    <>
      <TituloPagina
        titulo="Salidas"
        descripcion="Últimas 100 ventas registradas"
        accion={
          puedeVender ? (
            <Panel
              etiqueta="+ Nueva venta"
              titulo="Nueva venta"
              descripcion="Se crea en borrador; los productos se agregan después."
            >
              <form action={crearVenta} className="flex flex-col gap-4">
                <Campo
                  etiqueta="Asesor de venta"
                  ayuda="Quién de tu equipo atendió o refirió esta venta. Se gestionan en Vendedores."
                >
                  <Select name="asesor_id" defaultValue="">
                    <option value="">— Ninguno —</option>
                    {asesores?.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </Select>
                </Campo>
                <Campo
                  etiqueta="Comisión (S/)"
                  ayuda="Se descuenta de la utilidad neta, no del total que paga el cliente."
                >
                  <Input name="comision_monto" type="number" step="0.01" min="0" defaultValue="0" />
                </Campo>
                <Campo etiqueta="Tipo de precio">
                  <Select name="tipo" defaultValue="minorista">
                    <option value="minorista">Por menor</option>
                    <option value="mayorista">Por mayor</option>
                  </Select>
                </Campo>
                <Campo etiqueta="Fecha">
                  <Input name="fecha" type="date" defaultValue={hoy} />
                </Campo>

                <div className="border-t border-borde pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tinta-suave">
                    Datos del comprador
                  </p>
                  <div className="flex flex-col gap-4">
                    <Campo etiqueta="Nombre del comprador" ayuda="Útil para identificar quién compró.">
                      <Input name="comprador_nombre" placeholder="Nombre y apellido" />
                    </Campo>
                    <Campo etiqueta="Documento de identidad" ayuda="Opcional.">
                      <Input name="comprador_documento" placeholder="DNI / CE / RUC" />
                    </Campo>
                    <Campo etiqueta="¿De dónde viene la venta?">
                      <Select name="plataforma" defaultValue="tienda_fisica">
                        {PLATAFORMAS_VENTA.map((p) => (
                          <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
                        ))}
                      </Select>
                    </Campo>
                  </div>
                </div>

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

      {ventas && ventas.length > 0 ? (
        <Tarjeta sinRelleno>
          <div className="hidden px-5 py-4 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['N°', 'Fecha', 'Cliente', 'Total', 'Saldo', 'Estado', ''].map((c) => (
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
                {ventas.map((v) => {
                  const saldo = saldoPorVenta.get(v.id) ?? 0
                  const cliente =
                    v.comprador_nombre ??
                    (v.clientes as unknown as { nombre: string } | null)?.nombre ??
                    'Mostrador'
                  return (
                    <tr key={v.id} className="border-b border-borde-suave last:border-0">
                      <td className="px-2 py-3 font-semibold text-tinta">{v.numero}</td>
                      <td className="px-2 py-3 text-tinta-suave">{fecha(v.fecha)}</td>
                      <td className="px-2 py-3">
                        <span className="block">{cliente}</span>
                        {v.plataforma !== 'tienda_fisica' && (
                          <span className="text-xs text-tinta-suave">{etiquetaPlataforma(v.plataforma)}</span>
                        )}
                      </td>
                      <td className="cifra px-2 py-3 font-bold">{soles(v.total)}</td>
                      <td className="cifra px-2 py-3">
                        {saldo > 0 ? (
                          <span className="font-bold text-error">{soles(saldo)}</span>
                        ) : v.estado === 'confirmada' ? (
                          <span className="text-sm font-semibold text-exito">Pagada</span>
                        ) : (
                          <span className="text-tinta-tenue">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3"><EstadoDoc estado={v.estado} /></td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          href={`/ventas/${v.id}`}
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
            {ventas.map((v) => {
              const saldo = saldoPorVenta.get(v.id) ?? 0
              const cliente =
                v.comprador_nombre ??
                (v.clientes as unknown as { nombre: string } | null)?.nombre ??
                'Mostrador'
              return (
                <Link
                  key={v.id}
                  href={`/ventas/${v.id}`}
                  className="block rounded-xl border border-borde p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-tinta">{cliente}</p>
                      <p className="truncate text-xs text-tinta-suave">
                        {v.numero} · {fecha(v.fecha)}
                        {v.plataforma !== 'tienda_fisica' && ` · ${etiquetaPlataforma(v.plataforma)}`}
                      </p>
                    </div>
                    <EstadoDoc estado={v.estado} />
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-tinta-suave">Total</span>
                    <span className="cifra font-bold text-tinta">{soles(v.total)}</span>
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
        <Vacio
          mensaje="Aún no hay ventas registradas"
          descripcion="Registra tu primera venta del día para verla aquí."
        />
      )}
    </>
  )
}
