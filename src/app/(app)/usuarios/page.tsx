import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fecha } from '@/lib/format'
import { ROLES } from '@/lib/tipos'
import { Aviso, Boton, Etiqueta, Select, Tabla, Tarjeta, TituloPagina, Vacio } from '@/components/ui'
import { cambiarRol, alternarUsuario } from './actions'

export const metadata = { title: 'Usuarios — MOORA' }

export default async function UsuariosPage() {
  const admin = await requerirRol('admin')
  const supabase = await createClient()

  const { data: usuarios } = await supabase
    .from('perfiles')
    .select('*')
    .order('created_at')

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
        <ul className="space-y-2 text-sm">
          {ROLES.map((r) => (
            <li key={r.valor} className="flex flex-wrap items-center gap-2">
              <Etiqueta texto={r.etiqueta} tono={r.valor === 'admin' ? 'verde' : 'gris'} />
              <span className="text-gray-600">{r.descripcion}</span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <div className="mt-4">
        <Tarjeta titulo="Cuentas registradas">
          {usuarios && usuarios.length > 0 ? (
            <Tabla cabeceras={['Usuario', 'Rol', 'Alta', 'Estado', '']}>
              {usuarios.map((u) => {
                const esYo = u.id === admin.id
                return (
                  <tr key={u.id} className={u.activo ? '' : 'opacity-50'}>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-gray-900">
                        {u.nombre_completo ?? 'Sin nombre'}
                      </span>
                      {esYo && <span className="text-xs text-gray-500">Tú</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Etiqueta
                        texto={ROLES.find((r) => r.valor === u.rol)?.etiqueta ?? u.rol}
                        tono={u.rol === 'admin' ? 'verde' : 'gris'}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-600">{fecha(u.created_at)}</td>
                    <td className="px-3 py-2">
                      {u.activo ? (
                        <span className="text-sm text-green-700">Activo</span>
                      ) : (
                        <span className="text-sm text-red-600">Desactivado</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {esYo ? (
                        <span className="text-xs text-gray-400">No editable</span>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <form action={cambiarRol} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={u.id} />
                            <Select name="rol" defaultValue={u.rol} className="w-36">
                              {ROLES.map((r) => (
                                <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                              ))}
                            </Select>
                            <Boton type="submit" variante="secundario">Cambiar</Boton>
                          </form>
                          <form action={alternarUsuario}>
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="activo" value={String(u.activo)} />
                            <Boton type="submit" variante="peligro">
                              {u.activo ? 'Desactivar' : 'Reactivar'}
                            </Boton>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </Tabla>
          ) : (
            <Vacio mensaje="No hay usuarios registrados." />
          )}
        </Tarjeta>
      </div>
    </>
  )
}
