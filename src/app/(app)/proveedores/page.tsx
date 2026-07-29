import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles } from '@/lib/format'
import { Boton, Campo, Input, Tabla, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { crearProveedor, actualizarProveedor, alternarProveedor } from './actions'

export const metadata = { title: 'Proveedores — MOORA' }

export default async function ProveedoresPage() {
  const perfil = await requerirRol('admin', 'almacen', 'contador')
  const supabase = await createClient()

  const { data: proveedores } = await supabase.from('proveedores').select('*').order('nombre')

  const { data: deudas } = await supabase.from('v_cuentas_por_pagar').select('proveedor_id, saldo')
  const deudaPorProveedor = new Map<string, number>()
  for (const d of deudas ?? []) {
    deudaPorProveedor.set(d.proveedor_id, (deudaPorProveedor.get(d.proveedor_id) ?? 0) + Number(d.saldo))
  }

  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'almacen'

  return (
    <>
      <TituloPagina titulo="Proveedores" descripcion="A quién le compramos" />

      {puedeEditar && (
        <details className="mb-4">
          <summary className="cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            + Nuevo proveedor
          </summary>
          <div className="mt-3">
            <Tarjeta>
              <form action={crearProveedor} className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" required placeholder="Razón social" />
                </Campo>
                <Campo etiqueta="RUC">
                  <Input name="ruc" />
                </Campo>
                <Campo etiqueta="Persona de contacto">
                  <Input name="contacto" />
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
                <div className="sm:col-span-2">
                  <Campo etiqueta="Notas">
                    <TextArea name="notas" rows={2} />
                  </Campo>
                </div>
                <div className="sm:col-span-2">
                  <Boton type="submit">Guardar proveedor</Boton>
                </div>
              </form>
            </Tarjeta>
          </div>
        </details>
      )}

      <Tarjeta>
        {proveedores && proveedores.length > 0 ? (
          <Tabla cabeceras={['Proveedor', 'Contacto', 'Le debemos', '']}>
            {proveedores.map((p) => {
              const deuda = deudaPorProveedor.get(p.id) ?? 0
              return (
                <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-gray-900">{p.nombre}</span>
                    {p.ruc && <span className="text-xs text-gray-500">RUC {p.ruc}</span>}
                    {!p.activo && <span className="ml-1 text-xs text-red-600">(inactivo)</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {p.contacto ?? '—'}
                    {p.telefono && <span className="block text-xs text-gray-500">{p.telefono}</span>}
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
                        <form action={actualizarProveedor} className="mt-2 grid w-72 gap-2 text-left">
                          <input type="hidden" name="id" value={p.id} />
                          <Input name="nombre" defaultValue={p.nombre} required />
                          <Input name="ruc" defaultValue={p.ruc ?? ''} placeholder="RUC" />
                          <Input name="contacto" defaultValue={p.contacto ?? ''} placeholder="Contacto" />
                          <Input name="telefono" defaultValue={p.telefono ?? ''} placeholder="Teléfono" />
                          <Input name="email" defaultValue={p.email ?? ''} placeholder="Correo" />
                          <Input name="direccion" defaultValue={p.direccion ?? ''} placeholder="Dirección" />
                          <TextArea name="notas" defaultValue={p.notas ?? ''} rows={2} placeholder="Notas" />
                          <Boton type="submit">Guardar cambios</Boton>
                        </form>
                        <form action={alternarProveedor} className="mt-2">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="activo" value={String(p.activo)} />
                          <Boton type="submit" variante="peligro" className="w-full">
                            {p.activo ? 'Desactivar' : 'Reactivar'}
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
          <Vacio mensaje="Todavía no hay proveedores registrados." />
        )}
      </Tarjeta>
    </>
  )
}
