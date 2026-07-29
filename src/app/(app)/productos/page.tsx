import Link from 'next/link'
import { requerirPerfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero } from '@/lib/format'
import { Boton, Campo, Etiqueta, Input, Select, Tabla, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { TIPOS_PRODUCTO } from '@/lib/tipos'
import { crearProducto } from './actions'

export const metadata = { title: 'Productos — MOORA' }

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const perfil = await requerirPerfil()
  const { q } = await searchParams
  const supabase = await createClient()

  let consulta = supabase
    .from('productos')
    .select('id, nombre, codigo, tipo, activo, categorias(nombre), marcas(nombre), variantes(id, sku, stock, precio_venta_menor, activo)')
    .order('nombre')
  if (q) consulta = consulta.ilike('nombre', `%${q}%`)

  const { data: productos } = await consulta
  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'almacen'

  return (
    <>
      <TituloPagina titulo="Productos" descripcion="Catálogo de perfumes, skincare y maquillaje" />

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Buscar producto…" />
        <Boton type="submit" variante="secundario">Buscar</Boton>
      </form>

      {puedeEditar && (
        <details className="mb-4">
          <summary className="cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            + Nuevo producto
          </summary>
          <div className="mt-3">
            <Tarjeta titulo="Datos del producto">
              <form action={crearProducto} className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" required placeholder="Perfume Good Girl" />
                </Campo>
                <Campo etiqueta="Código interno">
                  <Input name="codigo" placeholder="Opcional" />
                </Campo>
                <Campo etiqueta="Tipo">
                  <Select name="tipo" defaultValue="perfume">
                    {TIPOS_PRODUCTO.map((t) => (
                      <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                    ))}
                  </Select>
                </Campo>
                <Campo etiqueta="Marca" ayuda="Si no existe, se crea sola.">
                  <Input name="marca" placeholder="Carolina Herrera" />
                </Campo>
                <Campo etiqueta="Categoría" ayuda="Si no existe, se crea sola.">
                  <Input name="categoria" placeholder="Perfumes de mujer" />
                </Campo>
                <div className="sm:col-span-2">
                  <Campo etiqueta="Descripción">
                    <TextArea name="descripcion" rows={2} />
                  </Campo>
                </div>

                <div className="sm:col-span-2 mt-2 border-t border-gray-200 pt-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">Primera presentación</p>
                  <p className="mb-3 text-xs text-gray-500">
                    Cada presentación (tamaño o tono) se maneja por separado. El stock se carga
                    después, con una compra o un ajuste de inventario.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta="SKU *">
                      <Input name="sku" required placeholder="GG-80ML" />
                    </Campo>
                    <Campo etiqueta="Presentación">
                      <Input name="variante" placeholder="80 ml / Tono 03" defaultValue="Única" />
                    </Campo>
                    <Campo etiqueta="Precio al por menor (S/)">
                      <Input name="precio_menor" type="number" step="0.01" min="0" defaultValue="0" />
                    </Campo>
                    <Campo etiqueta="Precio al por mayor (S/)">
                      <Input name="precio_mayor" type="number" step="0.01" min="0" defaultValue="0" />
                    </Campo>
                    <Campo etiqueta="Stock mínimo" ayuda="Para avisarte cuándo reponer.">
                      <Input name="stock_minimo" type="number" step="0.01" min="0" defaultValue="0" />
                    </Campo>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Boton type="submit">Guardar producto</Boton>
                </div>
              </form>
            </Tarjeta>
          </div>
        </details>
      )}

      <Tarjeta>
        {productos && productos.length > 0 ? (
          <Tabla cabeceras={['Producto', 'Marca', 'Presentaciones', 'Stock total', '']}>
            {productos.map((p) => {
              const variantes = (p.variantes ?? []) as { id: string; sku: string; stock: number; precio_venta_menor: number; activo: boolean }[]
              const stockTotal = variantes.reduce((s, v) => s + Number(v.stock), 0)
              const marca = (p.marcas as unknown as { nombre: string } | null)?.nombre
              const categoria = (p.categorias as unknown as { nombre: string } | null)?.nombre

              return (
                <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                  <td className="px-3 py-2">
                    <Link href={`/productos/${p.id}`} className="font-medium text-gray-900 underline">
                      {p.nombre}
                    </Link>
                    <span className="block text-xs text-gray-500">
                      {categoria ?? 'Sin categoría'}
                      {p.codigo && ` · ${p.codigo}`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{marca ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Etiqueta texto={`${variantes.length}`} />
                  </td>
                  <td className="px-3 py-2 font-medium">{numero(stockTotal)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/productos/${p.id}`} className="text-sm text-gray-600 underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Tabla>
        ) : (
          <Vacio mensaje={q ? 'Ningún producto coincide.' : 'Todavía no hay productos. Crea el primero.'} />
        )}
      </Tarjeta>
    </>
  )
}
