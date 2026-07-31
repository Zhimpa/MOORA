import Link from 'next/link'
import { requerirPerfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero } from '@/lib/format'
import {
  Boton, Campo, Etiqueta, FotoProducto, Input, Select, Tarjeta, TextArea, TituloPagina, Vacio,
} from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { TIPOS_PRODUCTO, CATEGORIAS_PRODUCTO } from '@/lib/tipos'
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
    .select(
      'id, nombre, codigo, tipo, activo, imagen_url, categorias(nombre), marcas(nombre), variantes(id, sku, stock, stock_minimo, precio_venta_menor, activo)'
    )
    .order('nombre')
  if (q) consulta = consulta.ilike('nombre', `%${q}%`)

  const { data: productos } = await consulta
  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'almacen'

  return (
    <>
      <TituloPagina
        titulo="Productos"
        descripcion="Perfumes, skincare y maquillaje"
        accion={
          puedeEditar ? (
            <Panel
              etiqueta="+ Nuevo producto"
              titulo="Nuevo producto"
              descripcion="El stock se carga después, con una compra o un ajuste."
            >
              <form action={crearProducto} className="flex flex-col gap-4">
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" required placeholder="Perfume Good Girl" />
                </Campo>
                <Campo etiqueta="Foto" ayuda="Ayuda a identificar el producto rápido. JPG, PNG o WEBP, máx. 5 MB.">
                  <Input name="imagen" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
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
                <Campo etiqueta="Categoría">
                  <Select name="categoria" defaultValue="">
                    <option value="" disabled>Selecciona una categoría</option>
                    {CATEGORIAS_PRODUCTO.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Campo>
                <Campo etiqueta="Código interno">
                  <Input name="codigo" placeholder="Opcional" />
                </Campo>
                <Campo etiqueta="Descripción">
                  <TextArea name="descripcion" rows={2} />
                </Campo>

                <div className="mt-1 border-t border-borde pt-4">
                  <p className="titulo-editorial mb-1 text-lg">Primera presentación</p>
                  <p className="mb-4 text-xs text-tinta-suave">
                    Cada tamaño o tono se maneja por separado: ahí viven el stock y los precios.
                  </p>
                  <div className="flex flex-col gap-4">
                    <Campo etiqueta="SKU *">
                      <Input name="sku" required placeholder="GG-80ML" />
                    </Campo>
                    <Campo etiqueta="Presentación">
                      <Input name="variante" placeholder="80 ml / Tono 03" defaultValue="Única" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-3">
                      <Campo etiqueta="Precio menor (S/)">
                        <Input name="precio_menor" type="number" step="0.01" min="0" defaultValue="0" />
                      </Campo>
                      <Campo etiqueta="Precio mayor (S/)">
                        <Input name="precio_mayor" type="number" step="0.01" min="0" defaultValue="0" />
                      </Campo>
                    </div>
                    <Campo etiqueta="Stock mínimo" ayuda="Para avisarte cuándo reponer.">
                      <Input name="stock_minimo" type="number" step="0.01" min="0" defaultValue="0" />
                    </Campo>
                  </div>
                </div>

                <BotonEnviar className="w-full">Guardar producto</BotonEnviar>
              </form>
            </Panel>
          ) : undefined
        }
      />

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Buscar producto…" />
        <Boton type="submit" variante="secundario">Buscar</Boton>
      </form>

      {productos && productos.length > 0 ? (
        <Tarjeta sinRelleno>
          <div className="hidden px-5 py-4 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['Producto', 'Marca', 'Presentaciones', 'Stock total', ''].map((c) => (
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
                {productos.map((p) => {
                  const variantes = (p.variantes ?? []) as {
                    id: string; sku: string; stock: number; stock_minimo: number; activo: boolean
                  }[]
                  const stockTotal = variantes.reduce((s, v) => s + Number(v.stock), 0)
                  const hayBajo = variantes.some((v) => Number(v.stock) <= Number(v.stock_minimo))
                  const marca = (p.marcas as unknown as { nombre: string } | null)?.nombre
                  const categoria = (p.categorias as unknown as { nombre: string } | null)?.nombre

                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-borde-suave last:border-0 ${p.activo ? '' : 'opacity-50'}`}
                    >
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <FotoProducto url={p.imagen_url} nombre={p.nombre} />
                          <div className="min-w-0">
                            <Link href={`/productos/${p.id}`} className="font-semibold text-tinta hover:text-vino">
                              {p.nombre}
                            </Link>
                            <span className="block text-xs text-tinta-suave">
                              {categoria ?? 'Sin categoría'}
                              {p.codigo && ` · ${p.codigo}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-tinta-suave">{marca ?? '—'}</td>
                      <td className="px-2 py-3">
                        <Etiqueta texto={`${variantes.length}`} />
                      </td>
                      <td className="cifra px-2 py-3">
                        <span className={hayBajo ? 'font-bold text-error' : 'font-semibold'}>
                          {numero(stockTotal)}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          href={`/productos/${p.id}`}
                          className="text-sm font-semibold text-vino underline-offset-4 hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 p-4 md:hidden">
            {productos.map((p) => {
              const variantes = (p.variantes ?? []) as {
                sku: string; stock: number; stock_minimo: number
              }[]
              const stockTotal = variantes.reduce((s, v) => s + Number(v.stock), 0)
              const hayBajo = variantes.some((v) => Number(v.stock) <= Number(v.stock_minimo))
              const marca = (p.marcas as unknown as { nombre: string } | null)?.nombre

              return (
                <Link
                  key={p.id}
                  href={`/productos/${p.id}`}
                  className={`block rounded-xl border border-borde p-4 ${p.activo ? '' : 'opacity-50'}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FotoProducto url={p.imagen_url} nombre={p.nombre} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-tinta">{p.nombre}</p>
                        <p className="truncate text-xs text-tinta-suave">{marca ?? 'Sin marca'}</p>
                      </div>
                    </div>
                    <Etiqueta texto={`${variantes.length} pres.`} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-tinta-suave">Stock total</span>
                    <span className={`cifra font-bold ${hayBajo ? 'text-error' : 'text-tinta'}`}>
                      {numero(stockTotal)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </Tarjeta>
      ) : (
        <Vacio
          mensaje={q ? 'Ningún producto coincide' : 'Aún no hay productos en el catálogo'}
          descripcion={
            q ? 'Prueba con otro nombre.' : 'Crea tu primer producto con su presentación y precios.'
          }
        />
      )}
    </>
  )
}
