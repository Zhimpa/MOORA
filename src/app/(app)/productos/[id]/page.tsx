import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirPerfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero } from '@/lib/format'
import { Boton, Campo, Etiqueta, Input, Select, Tabla, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { TIPOS_PRODUCTO } from '@/lib/tipos'
import { actualizarProducto, alternarProducto, crearVariante, actualizarVariante, alternarVariante } from '../actions'

export default async function DetalleProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const perfil = await requerirPerfil()
  const supabase = await createClient()

  const { data: producto } = await supabase
    .from('productos')
    .select('*, categorias(nombre), marcas(nombre)')
    .eq('id', id)
    .single()

  if (!producto) notFound()

  const { data: variantes } = await supabase
    .from('variantes')
    .select('*')
    .eq('producto_id', id)
    .order('nombre')

  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'almacen'
  const marca = (producto.marcas as { nombre: string } | null)?.nombre ?? ''
  const categoria = (producto.categorias as { nombre: string } | null)?.nombre ?? ''

  return (
    <>
      <Link href="/productos" className="mb-3 inline-block text-sm text-gray-600 underline">
        ← Volver a productos
      </Link>

      <TituloPagina
        titulo={producto.nombre}
        descripcion={[marca, categoria].filter(Boolean).join(' · ') || 'Sin marca ni categoría'}
      />

      {puedeEditar && (
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-gray-600 underline">Editar datos del producto</summary>
          <div className="mt-3">
            <Tarjeta>
              <form action={actualizarProducto} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={producto.id} />
                <Campo etiqueta="Nombre *">
                  <Input name="nombre" defaultValue={producto.nombre} required />
                </Campo>
                <Campo etiqueta="Código interno">
                  <Input name="codigo" defaultValue={producto.codigo ?? ''} />
                </Campo>
                <Campo etiqueta="Tipo">
                  <Select name="tipo" defaultValue={producto.tipo}>
                    {TIPOS_PRODUCTO.map((t) => (
                      <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                    ))}
                  </Select>
                </Campo>
                <Campo etiqueta="Marca">
                  <Input name="marca" defaultValue={marca} />
                </Campo>
                <Campo etiqueta="Categoría">
                  <Input name="categoria" defaultValue={categoria} />
                </Campo>
                <div className="sm:col-span-2">
                  <Campo etiqueta="Descripción">
                    <TextArea name="descripcion" rows={2} defaultValue={producto.descripcion ?? ''} />
                  </Campo>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Boton type="submit">Guardar cambios</Boton>
                </div>
              </form>
              <form action={alternarProducto} className="mt-3 border-t border-gray-200 pt-3">
                <input type="hidden" name="id" value={producto.id} />
                <input type="hidden" name="activo" value={String(producto.activo)} />
                <Boton type="submit" variante="peligro">
                  {producto.activo ? 'Desactivar producto' : 'Reactivar producto'}
                </Boton>
              </form>
            </Tarjeta>
          </div>
        </details>
      )}

      {puedeEditar && (
        <details className="mb-4">
          <summary className="cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            + Nueva presentación
          </summary>
          <div className="mt-3">
            <Tarjeta>
              <form action={crearVariante} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="producto_id" value={producto.id} />
                <Campo etiqueta="SKU *">
                  <Input name="sku" required placeholder="GG-50ML" />
                </Campo>
                <Campo etiqueta="Presentación *">
                  <Input name="nombre" required placeholder="50 ml / Tono 04" />
                </Campo>
                <Campo etiqueta="Código de barras">
                  <Input name="codigo_barras" />
                </Campo>
                <Campo etiqueta="Stock mínimo">
                  <Input name="stock_minimo" type="number" step="0.01" min="0" defaultValue="0" />
                </Campo>
                <Campo etiqueta="Precio al por menor (S/)">
                  <Input name="precio_menor" type="number" step="0.01" min="0" defaultValue="0" />
                </Campo>
                <Campo etiqueta="Precio al por mayor (S/)">
                  <Input name="precio_mayor" type="number" step="0.01" min="0" defaultValue="0" />
                </Campo>
                <div className="sm:col-span-2">
                  <Boton type="submit">Agregar presentación</Boton>
                </div>
              </form>
            </Tarjeta>
          </div>
        </details>
      )}

      <Tarjeta titulo="Presentaciones">
        {variantes && variantes.length > 0 ? (
          <Tabla cabeceras={['SKU / Presentación', 'Stock', 'Costo prom.', 'Menor', 'Mayor', '']}>
            {variantes.map((v) => (
              <tr key={v.id} className={v.activo ? '' : 'opacity-50'}>
                <td className="px-3 py-2">
                  <span className="block font-medium text-gray-900">{v.nombre}</span>
                  <span className="text-xs text-gray-500">{v.sku}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={Number(v.stock) <= Number(v.stock_minimo) ? 'font-medium text-red-600' : ''}>
                    {numero(v.stock)}
                  </span>
                  <span className="block text-xs text-gray-500">mín. {numero(v.stock_minimo)}</span>
                </td>
                <td className="px-3 py-2 text-gray-600">{soles(v.costo_promedio)}</td>
                <td className="px-3 py-2">{soles(v.precio_venta_menor)}</td>
                <td className="px-3 py-2">{soles(v.precio_venta_mayor)}</td>
                <td className="px-3 py-2 text-right">
                  {puedeEditar && (
                    <details>
                      <summary className="cursor-pointer text-sm text-gray-600 underline">Editar</summary>
                      <form action={actualizarVariante} className="mt-2 grid w-64 gap-2 text-left">
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="producto_id" value={producto.id} />
                        <Input name="sku" defaultValue={v.sku} required placeholder="SKU" />
                        <Input name="nombre" defaultValue={v.nombre} required placeholder="Presentación" />
                        <Input name="codigo_barras" defaultValue={v.codigo_barras ?? ''} placeholder="Código de barras" />
                        <Input name="precio_menor" type="number" step="0.01" defaultValue={v.precio_venta_menor} />
                        <Input name="precio_mayor" type="number" step="0.01" defaultValue={v.precio_venta_mayor} />
                        <Input name="stock_minimo" type="number" step="0.01" defaultValue={v.stock_minimo} />
                        <p className="text-xs text-gray-500">
                          El stock no se edita aquí: se cambia con una compra o un ajuste de inventario.
                        </p>
                        <Boton type="submit">Guardar</Boton>
                      </form>
                      <form action={alternarVariante} className="mt-2">
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="producto_id" value={producto.id} />
                        <input type="hidden" name="activo" value={String(v.activo)} />
                        <Boton type="submit" variante="peligro" className="w-full">
                          {v.activo ? 'Desactivar' : 'Reactivar'}
                        </Boton>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        ) : (
          <Vacio mensaje="Este producto no tiene presentaciones todavía." />
        )}
      </Tarjeta>
    </>
  )
}
