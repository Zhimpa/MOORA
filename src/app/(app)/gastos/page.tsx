import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, fecha } from '@/lib/format'
import { METODOS_PAGO } from '@/lib/tipos'
import { Boton, Campo, Input, Kpi, Select, Tabla, Tarjeta, TituloPagina, Vacio } from '@/components/ui'
import { registrarGasto, eliminarGasto, crearCategoriaGasto } from './actions'

export const metadata = { title: 'Gastos — MOORA' }

export default async function GastosPage() {
  const perfil = await requerirRol('admin', 'contador')
  const supabase = await createClient()

  const [{ data: gastos }, { data: categorias }] = await Promise.all([
    supabase
      .from('gastos')
      .select('*, categorias_gasto(nombre)')
      .order('fecha', { ascending: false })
      .limit(100),
    supabase.from('categorias_gasto').select('*').eq('activo', true).order('nombre'),
  ])

  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const delMes = (gastos ?? []).filter((g) => g.fecha >= inicioMes)
  const totalMes = delMes.reduce((s, g) => s + Number(g.monto), 0)
  const total = (gastos ?? []).reduce((s, g) => s + Number(g.monto), 0)
  const esAdmin = perfil.rol === 'admin'

  return (
    <>
      <TituloPagina titulo="Gastos" descripcion="Todo lo que sale que no es compra de mercadería" />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Kpi etiqueta="Gastos de este mes" valor={soles(totalMes)} detalle={`${delMes.length} registros`} />
        <Kpi etiqueta="Total mostrado" valor={soles(total)} detalle="Últimos 100 registros" />
      </div>

      {esAdmin && (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tarjeta titulo="Registrar gasto">
              <form action={registrarGasto} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Campo etiqueta="Descripción *">
                    <Input name="descripcion" required placeholder="Alquiler del local — julio" />
                  </Campo>
                </div>
                <Campo etiqueta="Monto (S/) *">
                  <Input name="monto" type="number" step="0.01" min="0.01" required />
                </Campo>
                <Campo etiqueta="Categoría">
                  <Select name="categoria_gasto_id" defaultValue="">
                    <option value="">— Sin categoría —</option>
                    {categorias?.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </Select>
                </Campo>
                <Campo etiqueta="Fecha">
                  <Input name="fecha" type="date" defaultValue={hoy.toISOString().slice(0, 10)} />
                </Campo>
                <Campo etiqueta="Método de pago">
                  <Select name="metodo" defaultValue="efectivo">
                    {METODOS_PAGO.map((m) => (
                      <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                    ))}
                  </Select>
                </Campo>
                <div className="sm:col-span-2">
                  <Boton type="submit">Guardar gasto</Boton>
                </div>
              </form>
            </Tarjeta>
          </div>

          <Tarjeta titulo="Nueva categoría">
            <form action={crearCategoriaGasto} className="grid gap-3">
              <Campo etiqueta="Nombre">
                <Input name="nombre" required placeholder="Mantenimiento" />
              </Campo>
              <Boton type="submit" variante="secundario">Agregar categoría</Boton>
            </form>
          </Tarjeta>
        </div>
      )}

      <Tarjeta titulo="Historial de gastos">
        {gastos && gastos.length > 0 ? (
          <Tabla cabeceras={['Fecha', 'Descripción', 'Categoría', 'Método', 'Monto', '']}>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fecha(g.fecha)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{g.descripcion}</td>
                <td className="px-3 py-2 text-gray-600">
                  {(g.categorias_gasto as { nombre: string } | null)?.nombre ?? '—'}
                </td>
                <td className="px-3 py-2 text-gray-600 capitalize">{g.metodo}</td>
                <td className="px-3 py-2 font-medium">{soles(g.monto)}</td>
                <td className="px-3 py-2 text-right">
                  {esAdmin && (
                    <form action={eliminarGasto}>
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="text-sm text-red-600 underline">Eliminar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        ) : (
          <Vacio mensaje="Todavía no hay gastos registrados." />
        )}
      </Tarjeta>
    </>
  )
}
