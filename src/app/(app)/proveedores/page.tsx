import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles } from '@/lib/format'
import { Campo, Input, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { crearProveedor, actualizarProveedor, alternarProveedor } from './actions'

export const metadata = { title: 'Proveedores — MOORA' }

export default async function ProveedoresPage() {
  const perfil = await requerirRol('admin', 'almacen', 'contador')
  const supabase = await createClient()

  const { data: proveedores } = await supabase.from('proveedores').select('*').order('nombre')

  const { data: deudas } = await supabase.from('v_cuentas_por_pagar').select('proveedor_id, saldo')
  const deudaPorProveedor = new Map<string, number>()
  for (const d of deudas ?? []) {
    deudaPorProveedor.set(
      d.proveedor_id,
      (deudaPorProveedor.get(d.proveedor_id) ?? 0) + Number(d.saldo)
    )
  }

  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'almacen'

  return (
    <>
      <TituloPagina
        titulo="Proveedores"
        descripcion="A quién le compramos"
        accion={
          puedeEditar ? (
            <Panel etiqueta="+ Nuevo proveedor" titulo="Nuevo proveedor">
              <FormularioProveedor accion={crearProveedor} />
            </Panel>
          ) : undefined
        }
      />

      {proveedores && proveedores.length > 0 ? (
        <Tarjeta sinRelleno>
          <div className="hidden px-5 py-4 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['Proveedor', 'Contacto', 'Le debemos', ''].map((c) => (
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
                {proveedores.map((p) => {
                  const deuda = deudaPorProveedor.get(p.id) ?? 0
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-borde-suave last:border-0 ${p.activo ? '' : 'opacity-50'}`}
                    >
                      <td className="px-2 py-3">
                        <span className="block font-semibold text-tinta">{p.nombre}</span>
                        {p.ruc && <span className="text-xs text-tinta-suave">RUC {p.ruc}</span>}
                        {!p.activo && <span className="ml-1 text-xs text-error">(inactivo)</span>}
                      </td>
                      <td className="px-2 py-3 text-tinta-suave">
                        {p.contacto ?? '—'}
                        {p.telefono && <span className="block text-xs">{p.telefono}</span>}
                      </td>
                      <td className="cifra px-2 py-3">
                        {deuda > 0 ? (
                          <span className="font-bold text-error">{soles(deuda)}</span>
                        ) : (
                          <span className="text-tinta-tenue">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {puedeEditar && <PanelEditar proveedor={p} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 p-4 md:hidden">
            {proveedores.map((p) => {
              const deuda = deudaPorProveedor.get(p.id) ?? 0
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border border-borde p-4 ${p.activo ? '' : 'opacity-50'}`}
                >
                  <p className="font-semibold text-tinta">{p.nombre}</p>
                  <p className="mb-2 text-xs text-tinta-suave">
                    {p.contacto ?? 'Sin contacto'}
                    {p.telefono && ` · ${p.telefono}`}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-tinta-suave">Le debemos</span>
                    <span
                      className={`cifra text-sm font-bold ${deuda > 0 ? 'text-error' : 'text-tinta-tenue'}`}
                    >
                      {deuda > 0 ? soles(deuda) : '—'}
                    </span>
                  </div>
                  {puedeEditar && (
                    <div className="mt-3">
                      <PanelEditar proveedor={p} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Tarjeta>
      ) : (
        <Vacio
          mensaje="Aún no hay proveedores registrados"
          descripcion="Registra un proveedor para poder cargar entradas y que entre stock."
        />
      )}
    </>
  )
}

type Proveedor = {
  id: string
  nombre: string
  ruc: string | null
  contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  activo: boolean
}

function FormularioProveedor({
  accion,
  proveedor,
}: {
  accion: (formData: FormData) => Promise<void>
  proveedor?: Proveedor
}) {
  return (
    <form action={accion} className="flex flex-col gap-4">
      {proveedor && <input type="hidden" name="id" value={proveedor.id} />}
      <Campo etiqueta="Nombre *">
        <Input name="nombre" required defaultValue={proveedor?.nombre} placeholder="Razón social" />
      </Campo>
      <Campo etiqueta="RUC">
        <Input name="ruc" defaultValue={proveedor?.ruc ?? ''} />
      </Campo>
      <Campo etiqueta="Persona de contacto">
        <Input name="contacto" defaultValue={proveedor?.contacto ?? ''} />
      </Campo>
      <Campo etiqueta="Teléfono">
        <Input name="telefono" type="tel" defaultValue={proveedor?.telefono ?? ''} />
      </Campo>
      <Campo etiqueta="Correo">
        <Input name="email" type="email" defaultValue={proveedor?.email ?? ''} />
      </Campo>
      <Campo etiqueta="Dirección">
        <Input name="direccion" defaultValue={proveedor?.direccion ?? ''} />
      </Campo>
      <Campo etiqueta="Notas">
        <TextArea name="notas" rows={2} defaultValue={proveedor?.notas ?? ''} />
      </Campo>
      <BotonEnviar className="w-full">
        {proveedor ? 'Guardar cambios' : 'Guardar proveedor'}
      </BotonEnviar>
    </form>
  )
}

function PanelEditar({ proveedor }: { proveedor: Proveedor }) {
  return (
    <Panel
      etiqueta="Editar"
      titulo={proveedor.nombre}
      descripcion="Datos del proveedor"
      variante="secundario"
    >
      <FormularioProveedor accion={actualizarProveedor} proveedor={proveedor} />

      <form action={alternarProveedor} className="mt-3 border-t border-borde pt-4">
        <input type="hidden" name="id" value={proveedor.id} />
        <input type="hidden" name="activo" value={String(proveedor.activo)} />
        <BotonEnviar variante="peligro" className="w-full" pendienteTexto="Aplicando…">
          {proveedor.activo ? 'Desactivar proveedor' : 'Reactivar proveedor'}
        </BotonEnviar>
      </form>
    </Panel>
  )
}
