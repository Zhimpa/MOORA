import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fecha } from '@/lib/format'
import { ROLES } from '@/lib/tipos'
import { Aviso, Etiqueta, Select, Tarjeta, TituloPagina, Vacio } from '@/components/ui'
import { BotonEnviar } from '@/components/boton-enviar'
import { cambiarRol, alternarUsuario, aprobarSolicitud, rechazarSolicitud } from './actions'

export const metadata = { title: 'Usuarios — MOORA' }

export default async function UsuariosPage() {
  const admin = await requerirRol('admin')
  const supabase = await createClient()

  const { data: usuarios } = await supabase.from('perfiles').select('*').order('created_at')
  const { data: solicitudes } = await supabase
    .from('solicitudes_acceso')
    .select('*')
    .eq('estado', 'pendiente')
    .order('created_at')

  return (
    <>
      <TituloPagina titulo="Usuarios" descripcion="Quién entra al sistema y qué puede hacer" />

      <div className="mb-4">
        <Aviso tipo="ok">
          Para dar de alta a alguien, pídele que solicite acceso desde la pantalla de ingreso. Tú
          apruebas la solicitud eligiendo su rol y Supabase le manda una invitación por correo.
        </Aviso>
      </div>

      {solicitudes && solicitudes.length > 0 && (
        <div className="mb-4">
          <Tarjeta titulo={`Solicitudes pendientes (${solicitudes.length})`} sinRelleno>
            <ul className="flex flex-col divide-y divide-borde-suave px-5 pb-5">
              {solicitudes.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-tinta">{s.nombre_completo}</p>
                    <p className="text-xs text-tinta-suave">
                      {s.email}
                      {s.telefono && <> · {s.telefono}</>} · Pedida {fecha(s.created_at)}
                    </p>
                    {s.mensaje && <p className="mt-1 text-sm text-tinta-media">{s.mensaje}</p>}
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <form action={aprobarSolicitud} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <Select name="rol" defaultValue="vendedor" className="w-40">
                        {ROLES.map((r) => (
                          <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                        ))}
                      </Select>
                      <BotonEnviar pendienteTexto="…">Aprobar</BotonEnviar>
                    </form>
                    <form action={rechazarSolicitud}>
                      <input type="hidden" name="id" value={s.id} />
                      <BotonEnviar variante="peligro" pendienteTexto="…">
                        Rechazar
                      </BotonEnviar>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      )}

      <Tarjeta titulo="Qué puede hacer cada rol">
        <ul className="flex flex-col gap-3">
          {ROLES.map((r) => (
            <li key={r.valor} className="flex flex-wrap items-center gap-2.5">
              <Etiqueta texto={r.etiqueta} tono={r.valor === 'admin' ? 'dorado' : 'gris'} />
              <span className="text-sm text-tinta-suave">{r.descripcion}</span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <div className="mt-4">
        <Tarjeta titulo="Cuentas registradas" sinRelleno>
          {usuarios && usuarios.length > 0 ? (
            <ul className="flex flex-col divide-y divide-borde-suave px-5 pb-5">
              {usuarios.map((u) => {
                const esYo = u.id === admin.id
                return (
                  <li
                    key={u.id}
                    className={`flex flex-wrap items-center justify-between gap-3 py-4 ${
                      u.activo ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-tinta">
                        {u.nombre_completo ?? 'Sin nombre'}
                        {esYo && <span className="ml-2 text-xs font-normal text-tinta-suave">(tú)</span>}
                      </p>
                      <p className="text-xs text-tinta-suave">
                        Alta {fecha(u.created_at)} ·{' '}
                        {u.activo ? (
                          <span className="text-exito">Activo</span>
                        ) : (
                          <span className="text-error">Desactivado</span>
                        )}
                      </p>
                    </div>

                    {esYo ? (
                      <Etiqueta
                        texto={ROLES.find((r) => r.valor === u.rol)?.etiqueta ?? u.rol}
                        tono="dorado"
                      />
                    ) : (
                      <div className="flex flex-wrap items-end gap-2">
                        <form action={cambiarRol} className="flex items-end gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <Select name="rol" defaultValue={u.rol} className="w-40">
                            {ROLES.map((r) => (
                              <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                            ))}
                          </Select>
                          <BotonEnviar variante="secundario" pendienteTexto="…">
                            Cambiar
                          </BotonEnviar>
                        </form>
                        <form action={alternarUsuario}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="activo" value={String(u.activo)} />
                          <BotonEnviar variante="peligro" pendienteTexto="…">
                            {u.activo ? 'Desactivar' : 'Reactivar'}
                          </BotonEnviar>
                        </form>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-5 pb-5">
              <Vacio mensaje="No hay usuarios registrados" />
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
