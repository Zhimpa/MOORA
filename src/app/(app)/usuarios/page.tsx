import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fecha } from '@/lib/format'
import { ROLES } from '@/lib/tipos'
import { Aviso, Etiqueta, Select, Tarjeta, TituloPagina, Vacio } from '@/components/ui'
import { BotonEnviar } from '@/components/boton-enviar'
import { cambiarRol, alternarUsuario } from './actions'

export const metadata = { title: 'Usuarios — MOORA' }

export default async function UsuariosPage() {
  const admin = await requerirRol('admin')
  const supabase = await createClient()

  const { data: usuarios } = await supabase.from('perfiles').select('*').order('created_at')

  return (
    <>
      <TituloPagina titulo="Usuarios" descripcion="Quién entra al sistema y qué puede hacer" />

      <div className="mb-4">
        <Aviso tipo="ok">
          Para dar de alta a alguien, pídele que se registre desde la pantalla de ingreso. Entrará
          como <strong>vendedor</strong> y desde aquí le cambias el rol.
        </Aviso>
      </div>

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
