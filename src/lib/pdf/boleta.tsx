import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { soles, numero, fecha, fechaHora } from '@/lib/format'
import { EMPRESA } from '@/lib/empresa'

export interface ItemBoleta {
  producto: string
  variante: string
  sku: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface PagoBoleta {
  fecha: string
  metodo: string
  monto: number
}

export interface DatosBoleta {
  numero: string
  fecha: string
  estado: 'borrador' | 'confirmada' | 'anulada'
  tipoPrecio: string
  canal: string
  atendidoPor: string | null
  compradorNombre: string
  compradorDocumento: string | null
  compradorTelefono: string | null
  items: ItemBoleta[]
  subtotal: number
  descuento: number
  total: number
  pagos: PagoBoleta[]
  pagado: number
  saldo: number
  notas: string | null
}

const estilos = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1f1a17' },
  filaEncabezado: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  nombreEmpresa: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#5c1a2b' },
  giroEmpresa: { fontSize: 8.5, color: '#6b6560', marginTop: 2, maxWidth: 260 },
  datoEmpresa: { fontSize: 8.5, color: '#6b6560' },
  cajaDoc: { alignItems: 'flex-end' },
  tituloDoc: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1f1a17' },
  numeroDoc: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#5c1a2b', marginTop: 2 },
  lineaDoc: { fontSize: 8.5, color: '#6b6560', marginTop: 2 },
  aviso: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  avisoAlerta: { backgroundColor: '#fdecea', color: '#b3261e' },
  divisor: { borderBottomWidth: 1, borderBottomColor: '#d8cfc6', marginVertical: 10 },
  filaInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  bloqueInfo: { width: '48%' },
  tituloBloque: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b6560',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textoInfo: { fontSize: 9.5, marginBottom: 2 },
  tabla: { marginTop: 4 },
  filaTablaEncabezado: {
    flexDirection: 'row',
    backgroundColor: '#f3ece7',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  filaTabla: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e1da',
  },
  celdaEncabezado: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b6560' },
  colProducto: { width: '46%' },
  colCantidad: { width: '14%', textAlign: 'right' },
  colPrecio: { width: '20%', textAlign: 'right' },
  colSubtotal: { width: '20%', textAlign: 'right' },
  nombreProducto: { fontSize: 9.5 },
  subNombreProducto: { fontSize: 8, color: '#6b6560', marginTop: 1 },
  bloqueTotales: { alignSelf: 'flex-end', width: '45%', marginTop: 12 },
  filaTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  filaTotalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1f1a17',
  },
  etiquetaTotal: { fontSize: 9.5, color: '#6b6560' },
  valorTotal: { fontSize: 9.5 },
  etiquetaTotalFinal: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  valorTotalFinal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#5c1a2b' },
  seccionPagos: { marginTop: 16 },
  piePagina: {
    position: 'absolute',
    bottom: 28,
    left: 36,
    right: 36,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#d8cfc6',
  },
  textoAvisoLegal: { fontSize: 7.5, color: '#8a837c', textAlign: 'center', lineHeight: 1.4 },
  textoGeneracion: { fontSize: 7, color: '#a39c93', textAlign: 'center', marginTop: 4 },
})

const ESTADO_TEXTO: Record<DatosBoleta['estado'], string> = {
  borrador: 'BORRADOR — Venta aún no confirmada',
  confirmada: 'Venta confirmada',
  anulada: 'VENTA ANULADA',
}

function BoletaDocument({ datos }: { datos: DatosBoleta }) {
  return (
    <Document
      title={`Boleta interna ${datos.numero}`}
      author={EMPRESA.nombre}
      subject="Comprobante interno de venta"
    >
      <Page size="A4" style={estilos.page}>
        <View style={estilos.filaEncabezado}>
          <View style={{ maxWidth: 280 }}>
            <Text style={estilos.nombreEmpresa}>{EMPRESA.nombre}</Text>
            <Text style={estilos.giroEmpresa}>{EMPRESA.giro}</Text>
            {EMPRESA.ruc && <Text style={estilos.datoEmpresa}>RUC {EMPRESA.ruc}</Text>}
            {EMPRESA.direccion && <Text style={estilos.datoEmpresa}>{EMPRESA.direccion}</Text>}
            {(EMPRESA.telefono || EMPRESA.correo) && (
              <Text style={estilos.datoEmpresa}>
                {[EMPRESA.telefono, EMPRESA.correo].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          <View style={estilos.cajaDoc}>
            <Text style={estilos.tituloDoc}>COMPROBANTE INTERNO DE VENTA</Text>
            <Text style={estilos.numeroDoc}>{datos.numero}</Text>
            <Text style={estilos.lineaDoc}>Fecha: {fecha(datos.fecha)}</Text>
            {datos.atendidoPor && <Text style={estilos.lineaDoc}>Atendido por: {datos.atendidoPor}</Text>}
            {datos.estado !== 'confirmada' && (
              <Text style={[estilos.aviso, estilos.avisoAlerta]}>{ESTADO_TEXTO[datos.estado]}</Text>
            )}
          </View>
        </View>

        <View style={estilos.divisor} />

        <View style={estilos.filaInfo}>
          <View style={estilos.bloqueInfo}>
            <Text style={estilos.tituloBloque}>Cliente</Text>
            <Text style={estilos.textoInfo}>{datos.compradorNombre}</Text>
            {datos.compradorDocumento && (
              <Text style={estilos.textoInfo}>Documento: {datos.compradorDocumento}</Text>
            )}
            {datos.compradorTelefono && (
              <Text style={estilos.textoInfo}>Teléfono: {datos.compradorTelefono}</Text>
            )}
          </View>
          <View style={estilos.bloqueInfo}>
            <Text style={estilos.tituloBloque}>Detalle de la venta</Text>
            <Text style={estilos.textoInfo}>Tipo de precio: {datos.tipoPrecio}</Text>
            <Text style={estilos.textoInfo}>Canal de venta: {datos.canal}</Text>
          </View>
        </View>

        <View style={estilos.tabla}>
          <View style={estilos.filaTablaEncabezado}>
            <Text style={[estilos.celdaEncabezado, estilos.colProducto]}>Producto</Text>
            <Text style={[estilos.celdaEncabezado, estilos.colCantidad]}>Cant.</Text>
            <Text style={[estilos.celdaEncabezado, estilos.colPrecio]}>P. unitario</Text>
            <Text style={[estilos.celdaEncabezado, estilos.colSubtotal]}>Subtotal</Text>
          </View>
          {datos.items.map((it, i) => (
            <View key={i} style={estilos.filaTabla} wrap={false}>
              <View style={estilos.colProducto}>
                <Text style={estilos.nombreProducto}>{it.producto}</Text>
                <Text style={estilos.subNombreProducto}>{it.variante} · {it.sku}</Text>
              </View>
              <Text style={[estilos.colCantidad, estilos.valorTotal]}>{numero(it.cantidad)}</Text>
              <Text style={[estilos.colPrecio, estilos.valorTotal]}>{soles(it.precio_unitario)}</Text>
              <Text style={[estilos.colSubtotal, estilos.valorTotal]}>{soles(it.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={estilos.bloqueTotales}>
          <View style={estilos.filaTotal}>
            <Text style={estilos.etiquetaTotal}>Subtotal</Text>
            <Text style={estilos.valorTotal}>{soles(datos.subtotal)}</Text>
          </View>
          <View style={estilos.filaTotal}>
            <Text style={estilos.etiquetaTotal}>Descuento</Text>
            <Text style={estilos.valorTotal}>− {soles(datos.descuento)}</Text>
          </View>
          <View style={estilos.filaTotalFinal}>
            <Text style={estilos.etiquetaTotalFinal}>Total</Text>
            <Text style={estilos.valorTotalFinal}>{soles(datos.total)}</Text>
          </View>
        </View>

        {datos.estado === 'confirmada' && (
          <View style={estilos.seccionPagos}>
            <Text style={estilos.tituloBloque}>Pagos</Text>
            {datos.pagos.length > 0 ? (
              <>
                {datos.pagos.map((p, i) => (
                  <View key={i} style={estilos.filaTotal}>
                    <Text style={estilos.etiquetaTotal}>
                      {fecha(p.fecha)} · {p.metodo}
                    </Text>
                    <Text style={estilos.valorTotal}>{soles(p.monto)}</Text>
                  </View>
                ))}
                <View style={estilos.filaTotal}>
                  <Text style={estilos.etiquetaTotal}>Total pagado</Text>
                  <Text style={estilos.valorTotal}>{soles(datos.pagado)}</Text>
                </View>
                <View style={estilos.filaTotal}>
                  <Text style={[estilos.etiquetaTotal, datos.saldo > 0 ? { color: '#b3261e' } : {}]}>
                    Saldo pendiente
                  </Text>
                  <Text style={[estilos.valorTotal, datos.saldo > 0 ? { color: '#b3261e' } : {}]}>
                    {soles(datos.saldo)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={estilos.textoInfo}>Sin pagos registrados. Saldo pendiente: {soles(datos.saldo)}</Text>
            )}
          </View>
        )}

        {datos.notas && (
          <View style={{ marginTop: 16 }}>
            <Text style={estilos.tituloBloque}>Notas</Text>
            <Text style={estilos.textoInfo}>{datos.notas}</Text>
          </View>
        )}

        <View style={estilos.piePagina} fixed>
          <Text style={estilos.textoAvisoLegal}>
            Documento de control interno generado por el sistema de gestión de {EMPRESA.nombre}. No
            constituye un comprobante de pago válido para efectos tributarios ante SUNAT ni reemplaza a una
            boleta o factura electrónica.
          </Text>
          <Text style={estilos.textoGeneracion}>Generado el {fechaHora(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generarBoletaPdf(datos: DatosBoleta): Promise<Buffer> {
  return renderToBuffer(<BoletaDocument datos={datos} />)
}
