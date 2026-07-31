import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Boton, Campo, Etiqueta, Input, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { crearAsesor, actualizarAsesor, alternarAsesor } from './actions'

export const metadata = { title: 'Vendedores — MOORA' }

export default async function VendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const perfil = await requerirRol('admin', 'vendedor', 'contador')
  const { q } = await searchParams
  const supabase = await createClient()

  let consulta = supabase.from('asesores_venta').select('*').order('activo', { ascending: false }).order('nombre')
  if (q) consulta = consulta.ilike('nombre', `%${q}%`)
  const { data: asesores } = await consulta

  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'vendedor'

  return (
    <>
      <TituloPagina
        titulo="Vendedores"
        descripcion="Asesores de venta de la marca: quién atiende o refiere cada venta"
        accion={
          puedeEditar ? (
            <Panel etiqueta="+ Nuevo vendedor" titulo="Nuevo vendedor">
              <form action={crearAsesor} className="flex flex-col gap-4">
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" required placeholder="Nombre completo" />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <Input name="telefono" type="tel" />
                </Campo>
                <Campo etiqueta="Notas">
                  <TextArea name="notas" rows={2} />
                </Campo>
                <BotonEnviar className="w-full">Guardar vendedor</BotonEnviar>
              </form>
            </Panel>
          ) : undefined
        }
      />

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Buscar por nombre…" />
        <Boton type="submit" variante="secundario">Buscar</Boton>
      </form>

      {asesores && asesores.length > 0 ? (
        <Tarjeta sinRelleno>
          <div className="hidden px-5 py-4 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['Nombre', 'Teléfono', 'Notas', 'Estado', ''].map((c) => (
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
                {asesores.map((a) => (
                  <tr
                    key={a.id}
                    className={`border-b border-borde-suave last:border-0 ${a.activo ? '' : 'opacity-50'}`}
                  >
                    <td className="px-2 py-3 font-semibold text-tinta">{a.nombre}</td>
                    <td className="px-2 py-3 text-tinta-suave">{a.telefono ?? '—'}</td>
                    <td className="max-w-xs truncate px-2 py-3 text-tinta-suave">{a.notas ?? '—'}</td>
                    <td className="px-2 py-3">
                      <Etiqueta texto={a.activo ? 'Activo' : 'Inactivo'} tono={a.activo ? 'verde' : 'gris'} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      {puedeEditar && <PanelEditar asesor={a} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 p-4 md:hidden">
            {asesores.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border border-borde p-4 ${a.activo ? '' : 'opacity-50'}`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-tinta">{a.nombre}</p>
                    <p className="truncate text-xs text-tinta-suave">{a.telefono ?? 'Sin teléfono'}</p>
                  </div>
                  <Etiqueta texto={a.activo ? 'Activo' : 'Inactivo'} tono={a.activo ? 'verde' : 'gris'} />
                </div>
                {puedeEditar && (
                  <div className="mt-3">
                    <PanelEditar asesor={a} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Tarjeta>
      ) : (
        <Vacio
          mensaje={q ? 'Ningún vendedor coincide con la búsqueda' : 'Aún no hay vendedores registrados'}
          descripcion={
            q
              ? 'Prueba con otro nombre.'
              : 'Regístralos aquí para poder asignarlos a una venta y llevar el control de sus comisiones.'
          }
        />
      )}
    </>
  )
}

/* Panel de edición reutilizado por la tabla y por las tarjetas de móvil */
function PanelEditar({
  asesor,
}: {
  asesor: {
    id: string
    nombre: string
    telefono: string | null
    notas: string | null
    activo: boolean
  }
}) {
  return (
    <Panel etiqueta="Editar" titulo={asesor.nombre} descripcion="Datos del vendedor" variante="secundario">
      <form action={actualizarAsesor} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={asesor.id} />
        <Campo etiqueta="Nombre *">
          <Input name="nombre" defaultValue={asesor.nombre} required />
        </Campo>
        <Campo etiqueta="Teléfono">
          <Input name="telefono" type="tel" defaultValue={asesor.telefono ?? ''} />
        </Campo>
        <Campo etiqueta="Notas">
          <TextArea name="notas" rows={2} defaultValue={asesor.notas ?? ''} />
        </Campo>
        <BotonEnviar className="w-full">Guardar cambios</BotonEnviar>
      </form>

      <form action={alternarAsesor} className="mt-3 border-t border-borde pt-4">
        <input type="hidden" name="id" value={asesor.id} />
        <input type="hidden" name="activo" value={String(asesor.activo)} />
        <BotonEnviar variante="peligro" className="w-full" pendienteTexto="Aplicando…">
          {asesor.activo ? 'Desactivar vendedor' : 'Reactivar vendedor'}
        </BotonEnviar>
        <p className="mt-2 text-xs text-tinta-suave">
          No se borra: se desactiva para no perder el historial de comisiones.
        </p>
      </form>
    </Panel>
  )
}
