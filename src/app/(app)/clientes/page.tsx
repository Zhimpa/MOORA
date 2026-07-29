import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles } from '@/lib/format'
import { Boton, Campo, Etiqueta, Input, Select, Tabla, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { crearCliente, actualizarCliente, alternarCliente } from './actions'

export const metadata = { title: 'Clientes — MOORA' }

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

  // Deuda pendiente por cliente
  const { data: deudas } = await supabase.from('v_cuentas_por_cobrar').select('cliente_id, saldo')
  const deudaPorCliente = new Map<string, number>()
  for (const d of deudas ?? []) {
    if (!d.cliente_id) continue
    deudaPorCliente.set(d.cliente_id, (deudaPorCliente.get(d.cliente_id) ?? 0) + Number(d.saldo))
  }

  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'vendedor'

  return (
    <>
      <TituloPagina titulo="Clientes" descripcion="Mayoristas y minoristas" />

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Buscar por nombre…" />
        <Boton type="submit" variante="secundario">Buscar</Boton>
      </form>

      {puedeEditar && (
        <details className="mb-4">
          <summary className="cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            + Nuevo cliente
          </summary>
          <div className="mt-3">
            <Tarjeta>
              <form action={crearCliente} className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" required placeholder="Nombre o razón social" />
                </Campo>
                <Campo etiqueta="Tipo de cliente">
                  <Select name="tipo" defaultValue="minorista">
                    <option value="minorista">Minorista</option>
                    <option value="mayorista">Mayorista</option>
                  </Select>
                </Campo>
                <Campo etiqueta="Tipo de documento">
                  <Select name="tipo_documento" defaultValue="">
                    <option value="">—</option>
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                    <option value="CE">Carné de extranjería</option>
                    <option value="PAS">Pasaporte</option>
                  </Select>
                </Campo>
                <Campo etiqueta="Número de documento">
                  <Input name="numero_documento" />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <Input name="telefono" />
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
                <div className="sm:col-span-2">
                  <Campo etiqueta="Notas">
                    <TextArea name="notas" rows={2} />
                  </Campo>
                </div>
                <div className="sm:col-span-2">
                  <Boton type="submit">Guardar cliente</Boton>
                </div>
              </form>
            </Tarjeta>
          </div>
        </details>
      )}

      <Tarjeta>
        {clientes && clientes.length > 0 ? (
          <Tabla cabeceras={['Cliente', 'Tipo', 'Contacto', 'Deuda', '']}>
            {clientes.map((c) => {
              const deuda = deudaPorCliente.get(c.id) ?? 0
              return (
                <tr key={c.id} className={c.activo ? '' : 'opacity-50'}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-gray-900">{c.nombre}</span>
                    {c.numero_documento && (
                      <span className="text-xs text-gray-500">
                        {c.tipo_documento} {c.numero_documento}
                      </span>
                    )}
                    {!c.activo && <span className="ml-1 text-xs text-red-600">(inactivo)</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Etiqueta
                      texto={c.tipo === 'mayorista' ? 'Mayorista' : 'Minorista'}
                      tono={c.tipo === 'mayorista' ? 'verde' : 'gris'}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {c.telefono ?? '—'}
                    {c.email && <span className="block text-xs text-gray-500">{c.email}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {deuda > 0 ? (
                      <span className="font-medium text-red-600">{soles(deuda)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {puedeEditar && (
                      <details>
                        <summary className="cursor-pointer text-sm text-gray-600 underline">Editar</summary>
                        <form action={actualizarCliente} className="mt-2 grid w-72 gap-2 text-left">
                          <input type="hidden" name="id" value={c.id} />
                          <Input name="nombre" defaultValue={c.nombre} required />
                          <Select name="tipo" defaultValue={c.tipo}>
                            <option value="minorista">Minorista</option>
                            <option value="mayorista">Mayorista</option>
                          </Select>
                          <Select name="tipo_documento" defaultValue={c.tipo_documento ?? ''}>
                            <option value="">—</option>
                            <option value="DNI">DNI</option>
                            <option value="RUC">RUC</option>
                            <option value="CE">CE</option>
                            <option value="PAS">Pasaporte</option>
                          </Select>
                          <Input name="numero_documento" defaultValue={c.numero_documento ?? ''} placeholder="N° documento" />
                          <Input name="telefono" defaultValue={c.telefono ?? ''} placeholder="Teléfono" />
                          <Input name="email" defaultValue={c.email ?? ''} placeholder="Correo" />
                          <Input name="direccion" defaultValue={c.direccion ?? ''} placeholder="Dirección" />
                          <Input name="limite_credito" type="number" step="0.01" defaultValue={c.limite_credito} />
                          <TextArea name="notas" defaultValue={c.notas ?? ''} rows={2} placeholder="Notas" />
                          <Boton type="submit">Guardar cambios</Boton>
                        </form>
                        <form action={alternarCliente} className="mt-2">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="activo" value={String(c.activo)} />
                          <Boton type="submit" variante="peligro" className="w-full">
                            {c.activo ? 'Desactivar' : 'Reactivar'}
                          </Boton>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              )
            })}
          </Tabla>
        ) : (
          <Vacio mensaje={q ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes registrados.'} />
        )}
      </Tarjeta>
    </>
  )
}
