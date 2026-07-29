import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirPerfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { soles, numero } from '@/lib/format'
import { Campo, Etiqueta, Input, Select, Tarjeta, TextArea, TituloPagina, Vacio } from '@/components/ui'
import { Panel } from '@/components/panel'
import { BotonEnviar } from '@/components/boton-enviar'
import { TIPOS_PRODUCTO } from '@/lib/tipos'
import {
  actualizarProducto, alternarProducto, crearVariante, actualizarVariante, alternarVariante,
} from '../actions'

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
  const marca = (producto.marcas as unknown as { nombre: string } | null)?.nombre ?? ''
  const categoria = (producto.categorias as unknown as { nombre: string } | null)?.nombre ?? ''

  return (
    <>
      <Link
        href="/productos"
        className="mb-4 inline-block text-sm font-semibold text-vino underline-offset-4 hover:underline"
      >
        ← Volver a productos
      </Link>

      <TituloPagina
        titulo={producto.nombre}
        descripcion={[marca, categoria].filter(Boolean).join(' · ') || 'Sin marca ni categoría'}
        accion={
          puedeEditar ? (
            <div className="flex flex-wrap gap-2">
              <Panel etiqueta="Editar producto" titulo={producto.nombre} variante="secundario">
                <form action={actualizarProducto} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={producto.id} />
                  <Campo etiqueta="Nombre *">
                    <Input name="nombre" defaultValue={producto.nombre} required />
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
                  <Campo etiqueta="Código interno">
                    <Input name="codigo" defaultValue={producto.codigo ?? ''} />
                  </Campo>
                  <Campo etiqueta="Descripción">
                    <TextArea name="descripcion" rows={3} defaultValue={producto.descripcion ?? ''} />
                  </Campo>
                  <BotonEnviar className="w-full">Guardar cambios</BotonEnviar>
                </form>

                <form action={alternarProducto} className="mt-3 border-t border-borde pt-4">
                  <input type="hidden" name="id" value={producto.id} />
                  <input type="hidden" name="activo" value={String(producto.activo)} />
                  <BotonEnviar variante="peligro" className="w-full" pendienteTexto="Aplicando…">
                    {producto.activo ? 'Desactivar producto' : 'Reactivar producto'}
                  </BotonEnviar>
                </form>
              </Panel>

              <Panel
                etiqueta="+ Presentación"
                titulo="Nueva presentación"
                descripcion={producto.nombre}
              >
                <form action={crearVariante} className="flex flex-col gap-4">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Precio menor (S/)">
                      <Input name="precio_menor" type="number" step="0.01" min="0" defaultValue="0" />
                    </Campo>
                    <Campo etiqueta="Precio mayor (S/)">
                      <Input name="precio_mayor" type="number" step="0.01" min="0" defaultValue="0" />
                    </Campo>
                  </div>
                  <Campo etiqueta="Stock mínimo">
                    <Input name="stock_minimo" type="number" step="0.01" min="0" defaultValue="0" />
                  </Campo>
                  <BotonEnviar className="w-full">Agregar presentación</BotonEnviar>
                </form>
              </Panel>
            </div>
          ) : undefined
        }
      />

      {variantes && variantes.length > 0 ? (
        <Tarjeta titulo="Presentaciones" sinRelleno>
          <div className="hidden px-5 pb-5 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-borde text-left">
                  {['SKU / Presentación', 'Stock', 'Costo prom.', 'Menor', 'Mayor', ''].map((c) => (
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
                {variantes.map((v) => {
                  const bajo = Number(v.stock) <= Number(v.stock_minimo)
                  return (
                    <tr
                      key={v.id}
                      className={`border-b border-borde-suave last:border-0 ${v.activo ? '' : 'opacity-50'}`}
                    >
                      <td className="px-2 py-3">
                        <span className="block font-semibold text-tinta">{v.nombre}</span>
                        <span className="text-xs text-tinta-suave">{v.sku}</span>
                      </td>
                      <td className="cifra px-2 py-3">
                        <span className={bajo ? 'font-bold text-error' : 'font-semibold'}>
                          {numero(v.stock)}
                        </span>
                        <span className="block text-[11px] text-tinta-suave">
                          mín. {numero(v.stock_minimo)}
                        </span>
                      </td>
                      <td className="cifra px-2 py-3 text-tinta-suave">{soles(v.costo_promedio)}</td>
                      <td className="cifra px-2 py-3">{soles(v.precio_venta_menor)}</td>
                      <td className="cifra px-2 py-3">{soles(v.precio_venta_mayor)}</td>
                      <td className="px-2 py-3 text-right">
                        {puedeEditar && <PanelVariante variante={v} productoId={producto.id} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 p-4 md:hidden">
            {variantes.map((v) => {
              const bajo = Number(v.stock) <= Number(v.stock_minimo)
              return (
                <div
                  key={v.id}
                  className={`rounded-xl border border-borde p-4 ${v.activo ? '' : 'opacity-50'}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-tinta">{v.nombre}</p>
                      <p className="truncate text-xs text-tinta-suave">{v.sku}</p>
                    </div>
                    {bajo && <Etiqueta texto="Reponer" tono="rojo" />}
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-tinta-suave">Stock</span>
                    <span className={`cifra font-bold ${bajo ? 'text-error' : 'text-tinta'}`}>
                      {numero(v.stock)}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-tinta-suave">Precio menor</span>
                    <span className="cifra font-semibold">{soles(v.precio_venta_menor)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-tinta-suave">Precio mayor</span>
                    <span className="cifra font-semibold">{soles(v.precio_venta_mayor)}</span>
                  </div>
                  {puedeEditar && (
                    <div className="mt-3">
                      <PanelVariante variante={v} productoId={producto.id} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Tarjeta>
      ) : (
        <Vacio
          mensaje="Este producto no tiene presentaciones"
          descripcion="Agrega al menos una (tamaño o tono) para poder venderlo."
        />
      )}
    </>
  )
}

type Variante = {
  id: string
  sku: string
  nombre: string
  codigo_barras: string | null
  precio_venta_menor: number
  precio_venta_mayor: number
  stock_minimo: number
  activo: boolean
}

function PanelVariante({ variante, productoId }: { variante: Variante; productoId: string }) {
  return (
    <Panel etiqueta="Editar" titulo={variante.nombre} descripcion={variante.sku} variante="secundario">
      <form action={actualizarVariante} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={variante.id} />
        <input type="hidden" name="producto_id" value={productoId} />
        <Campo etiqueta="SKU *">
          <Input name="sku" defaultValue={variante.sku} required />
        </Campo>
        <Campo etiqueta="Presentación *">
          <Input name="nombre" defaultValue={variante.nombre} required />
        </Campo>
        <Campo etiqueta="Código de barras">
          <Input name="codigo_barras" defaultValue={variante.codigo_barras ?? ''} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Precio menor (S/)">
            <Input name="precio_menor" type="number" step="0.01" min="0" defaultValue={variante.precio_venta_menor} />
          </Campo>
          <Campo etiqueta="Precio mayor (S/)">
            <Input name="precio_mayor" type="number" step="0.01" min="0" defaultValue={variante.precio_venta_mayor} />
          </Campo>
        </div>
        <Campo etiqueta="Stock mínimo">
          <Input name="stock_minimo" type="number" step="0.01" min="0" defaultValue={variante.stock_minimo} />
        </Campo>

        <p className="rounded-lg border-l-[3px] border-alerta bg-alerta-fondo px-3 py-2 text-xs text-tinta">
          El stock no se edita aquí. Cambia solo con una compra, una venta o un ajuste de inventario.
        </p>

        <BotonEnviar className="w-full">Guardar cambios</BotonEnviar>
      </form>

      <form action={alternarVariante} className="mt-3 border-t border-borde pt-4">
        <input type="hidden" name="id" value={variante.id} />
        <input type="hidden" name="producto_id" value={productoId} />
        <input type="hidden" name="activo" value={String(variante.activo)} />
        <BotonEnviar variante="peligro" className="w-full" pendienteTexto="Aplicando…">
          {variante.activo ? 'Desactivar presentación' : 'Reactivar presentación'}
        </BotonEnviar>
      </form>
    </Panel>
  )
}
