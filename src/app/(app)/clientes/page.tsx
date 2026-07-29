import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles } from '@/lib/format'
import {
  Boton, Campo, Etiqueta, Input, Select, Tarjeta, TextArea, TituloPagina, Vacio,
} from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { crearCliente, actualizarCliente, alternarCliente } from './actions'

export const metadata = { title: 'Clientes — MOORA' }

const TIPOS_DOC = [
  ['', '—'],
  ['DNI', 'DNI'],
  ['RUC', 'RUC'],
  ['CE', 'Carné de extranjería'],
  ['PAS', 'Pasaporte'],
] as const

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const perfil = await requerirRol('admin', 'vendedor', 'contador')
  const { q } = await searchParams
  const supabase = await createClient()

  let consulta = supabase.from('clientes').select('*').order('nombre')
  if (q) consulta = consulta.ilike('nombre', `%${q}%`)
  const { data: clientes } = await consulta

  const { data: deudas } = await supabase.from('v_cuentas_por_cobrar').select('cliente_id, saldo')
  const deudaPorCliente = new Map<string, number>()
  for (const d of deudas ?? []) {
    if (!d.cliente_id) continue
    deudaPorCliente.set(d.cliente_id, (deudaPorCliente.get(d.cliente_id) ?? 0) + Number(d.saldo))
  }

  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'vendedor'

  return (
    <>
      <TituloPagina
        titulo="Clientes"
        descripcion="Mayoristas y minoristas"
        accion={
          puedeEditar ? (
            <Panel etiqueta="+ Nuevo cliente" titulo="Nuevo cliente">
              <form action={crearCliente} className="flex flex-col gap-4">
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" required placeholder="Nombre o razón social" />
                </Campo>
                <Campo etiqueta="Tipo de cliente" ayuda="Define qué lista de precios se usa.">
                  <Select name="tipo" defaultValue="minorista">
                    <option value="minorista">Minorista</option>
                    <option value="mayorista">Mayorista</option>
                  </Select>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Documento">
                    <Select name="tipo_documento" defaultValue="">
                      {TIPOS_DOC.map(([v, t]) => (
                        <option key={v} value={v}>{t}</option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo etiqueta="Número">
                    <Input name="numero_documento" />
                  </Campo>
                </div>
                <Campo etiqueta="Teléfono">
                  <Input name="telefono" type="tel" />
                </Campo>
                <Campo etiqueta="Correo">
                  <Input name="email" type="email" />
                </Campo>
                <Campo etiqueta="Dirección">
                  <Input name="direccion" />
                </Campo>
                <Campo etiqueta="Límite de crédito (S/)" ayuda="Cuánto se le permite deber.">
                  <Input name="limite_credito" type="number" step="0.01" min="0" defaultValue="0" />
                </Campo>
                <Campo etiqueta="Notas">
                  <TextArea name="notas" rows={2} />
                </Campo>
                <BotonEnviar className="w-full">Guardar cliente</BotonEnviar>
              </form>
            </Panel>
          ) : undefined
        }
      />

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Buscar por nombre…" />
        <Boton type="submit" variante="secundario">Buscar</Boton>
      </form>

      {clientes && clientes.length > 0 ? (
        <>
          <Tarjeta sinRelleno>
            <div className="hidden px-5 py-4 md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borde text-left">
                    {['Cliente', 'Tipo', 'Contacto', 'Deuda', ''].map((c) => (
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
                  {clientes.map((c) => {
                    const deuda = deudaPorCliente.get(c.id) ?? 0
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-borde-suave last:border-0 ${c.activo ? '' : 'opacity-50'}`}
                      >
                        <td className="px-2 py-3">
                          <span className="block font-semibold text-tinta">{c.nombre}</span>
                          {c.numero_documento && (
                            <span className="text-xs text-tinta-suave">
                              {c.tipo_documento} {c.numero_documento}
                            </span>
                          )}
                          {!c.activo && <span className="ml-1 text-xs text-error">(inactivo)</span>}
                        </td>
                        <td className="px-2 py-3">
                          <Etiqueta
                            texto={c.tipo === 'mayorista' ? 'Mayorista' : 'Minorista'}
                            tono={c.tipo === 'mayorista' ? 'dorado' : 'gris'}
                          />
                        </td>
                        <td className="px-2 py-3 text-tinta-suave">
                          {c.telefono ?? '—'}
                          {c.email && <span className="block text-xs">{c.email}</span>}
                        </td>
                        <td className="cifra px-2 py-3">
                          {deuda > 0 ? (
                            <span className="font-bold text-error">{soles(deuda)}</span>
                          ) : (
                            <span className="text-tinta-tenue">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {puedeEditar && <PanelEditar cliente={c} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2.5 p-4 md:hidden">
              {clientes.map((c) => {
                const deuda = deudaPorCliente.get(c.id) ?? 0
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border border-borde p-4 ${c.activo ? '' : 'opacity-50'}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-tinta">{c.nombre}</p>
                        <p className="truncate text-xs text-tinta-suave">
                          {c.telefono ?? 'Sin teléfono'}
                        </p>
                      </div>
                      <Etiqueta
                        texto={c.tipo === 'mayorista' ? 'Mayorista' : 'Minorista'}
                        tono={c.tipo === 'mayorista' ? 'dorado' : 'gris'}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-tinta-suave">Deuda</span>
                      <span
                        className={`cifra text-sm font-bold ${deuda > 0 ? 'text-error' : 'text-tinta-tenue'}`}
                      >
                        {deuda > 0 ? soles(deuda) : '—'}
                      </span>
                    </div>
                    {puedeEditar && (
                      <div className="mt-3">
                        <PanelEditar cliente={c} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Tarjeta>
        </>
      ) : (
        <Vacio
          mensaje={q ? 'Ningún cliente coincide con la búsqueda' : 'Aún no hay clientes registrados'}
          descripcion={
            q
              ? 'Prueba con otro nombre.'
              : 'Registra a tus clientes para llevar el control de quién te debe.'
          }
        />
      )}
    </>
  )
}

/* Panel de edición reutilizado por la tabla y por las tarjetas de móvil */
function PanelEditar({
  cliente,
}: {
  cliente: {
    id: string
    nombre: string
    tipo: string
    tipo_documento: string | null
    numero_documento: string | null
    telefono: string | null
    email: string | null
    direccion: string | null
    limite_credito: number
    notas: string | null
    activo: boolean
  }
}) {
  return (
    <Panel etiqueta="Editar" titulo={cliente.nombre} descripcion="Datos del cliente" variante="secundario">
      <form action={actualizarCliente} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={cliente.id} />
        <Campo etiqueta="Nombre *">
          <Input name="nombre" defaultValue={cliente.nombre} required />
        </Campo>
        <Campo etiqueta="Tipo de cliente">
          <Select name="tipo" defaultValue={cliente.tipo}>
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
          </Select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Documento">
            <Select name="tipo_documento" defaultValue={cliente.tipo_documento ?? ''}>
              {TIPOS_DOC.map(([v, t]) => (
                <option key={v} value={v}>{t}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Número">
            <Input name="numero_documento" defaultValue={cliente.numero_documento ?? ''} />
          </Campo>
        </div>
        <Campo etiqueta="Teléfono">
          <Input name="telefono" type="tel" defaultValue={cliente.telefono ?? ''} />
        </Campo>
        <Campo etiqueta="Correo">
          <Input name="email" type="email" defaultValue={cliente.email ?? ''} />
        </Campo>
        <Campo etiqueta="Dirección">
          <Input name="direccion" defaultValue={cliente.direccion ?? ''} />
        </Campo>
        <Campo etiqueta="Límite de crédito (S/)">
          <Input name="limite_credito" type="number" step="0.01" min="0" defaultValue={cliente.limite_credito} />
        </Campo>
        <Campo etiqueta="Notas">
          <TextArea name="notas" rows={2} defaultValue={cliente.notas ?? ''} />
        </Campo>
        <BotonEnviar className="w-full">Guardar cambios</BotonEnviar>
      </form>

      <form action={alternarCliente} className="mt-3 border-t border-borde pt-4">
        <input type="hidden" name="id" value={cliente.id} />
        <input type="hidden" name="activo" value={String(cliente.activo)} />
        <BotonEnviar variante="peligro" className="w-full" pendienteTexto="Aplicando…">
          {cliente.activo ? 'Desactivar cliente' : 'Reactivar cliente'}
        </BotonEnviar>
        <p className="mt-2 text-xs text-tinta-suave">
          No se borra: se desactiva para no perder el historial de ventas.
        </p>
      </form>
    </Panel>
  )
}
