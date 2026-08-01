import { NextResponse } from 'next/server'
import { requerirRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PLATAFORMAS_VENTA, METODOS_PAGO } from '@/lib/tipos'
import { generarBoletaPdf, type DatosBoleta } from '@/lib/pdf/boleta'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requerirRol('admin', 'vendedor', 'contador')
  const supabase = await createClient()

  const { data: venta } = await supabase
    .from('ventas')
    .select(
      '*, clientes(nombre, telefono, direccion, tipo_documento, numero_documento), asesores_venta(nombre)'
    )
    .eq('id', id)
    .single()

  if (!venta) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })

  const [{ data: items }, { data: pagos }, { data: vendedorPerfil }] = await Promise.all([
    supabase
      .from('venta_items')
      .select('cantidad, precio_unitario, subtotal, variantes(sku, nombre, productos(nombre))')
      .eq('venta_id', id)
      .order('created_at'),
    supabase.from('pagos_venta').select('fecha, metodo, monto').eq('venta_id', id).order('fecha'),
    venta.usuario_id
      ? supabase.from('perfiles').select('nombre_completo').eq('id', venta.usuario_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const cliente = venta.clientes as unknown as {
    nombre: string
    telefono: string | null
    direccion: string | null
    tipo_documento: string | null
    numero_documento: string | null
  } | null

  const asesor = venta.asesores_venta as unknown as { nombre: string } | null

  const pagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0)
  const saldo = Number(venta.total) - pagado

  const datos: DatosBoleta = {
    numero: venta.numero,
    fecha: venta.fecha,
    estado: venta.estado,
    tipoPrecio: venta.tipo === 'mayorista' ? 'Por mayor' : 'Por menor',
    canal: PLATAFORMAS_VENTA.find((p) => p.valor === venta.plataforma)?.etiqueta ?? venta.plataforma,
    atendidoPor: vendedorPerfil?.nombre_completo ?? null,
    asesorNombre: asesor?.nombre ?? null,
    compradorNombre: venta.comprador_nombre ?? cliente?.nombre ?? 'Cliente de mostrador',
    compradorDocumento:
      venta.comprador_documento ??
      (cliente?.tipo_documento && cliente?.numero_documento
        ? `${cliente.tipo_documento} ${cliente.numero_documento}`
        : null),
    compradorTelefono: cliente?.telefono ?? null,
    compradorDireccion: cliente?.direccion ?? null,
    items: (items ?? []).map((it) => {
      const v = it.variantes as unknown as {
        sku: string
        nombre: string
        productos: { nombre: string } | null
      } | null
      return {
        producto: v?.productos?.nombre ?? 'Producto',
        variante: v?.nombre ?? '',
        sku: v?.sku ?? '',
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        subtotal: Number(it.subtotal),
      }
    }),
    subtotal: Number(venta.subtotal),
    descuento: Number(venta.descuento),
    total: Number(venta.total),
    pagos: (pagos ?? []).map((p) => ({
      fecha: p.fecha,
      metodo: METODOS_PAGO.find((m) => m.valor === p.metodo)?.etiqueta ?? p.metodo,
      monto: Number(p.monto),
    })),
    metodosPago: [...new Set((pagos ?? []).map((p) => p.metodo))],
    pagado,
    saldo,
    notas: venta.notas,
  }

  const pdf = await generarBoletaPdf(datos)

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Boleta-${venta.numero}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
