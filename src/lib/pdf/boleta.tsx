import fs from 'node:fs'
import path from 'node:path'
import { Document, Page, StyleSheet, Text, View, Image, renderToBuffer } from '@react-pdf/renderer'
import { soles, numero, fecha } from '@/lib/format'
import { EMPRESA } from '@/lib/empresa'

// Logo de marca usado como marca de agua de fondo (sello de autenticidad) en todas las boletas.
const MARCA_AGUA = fs.readFileSync(path.join(process.cwd(), 'public', 'marca-agua-moora.png'))

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
  asesorNombre: string | null
  compradorNombre: string
  compradorDocumento: string | null
  compradorTelefono: string | null
  compradorDireccion: string | null
  items: ItemBoleta[]
  subtotal: number
  descuento: number
  total: number
  pagos: PagoBoleta[]
  metodosPago: string[]
  pagado: number
  saldo: number
  notas: string | null
}

// Paleta alineada a las variables de marca definidas en src/app/globals.css (@theme).
const color = {
  vino: '#7c2a3e',
  vinoOscuro: '#611f30',
  vinoClaro: '#c9a8b2',
  dorado: '#a9824b',
  doradoFondo: '#f3e9d6',
  tinta: '#241a1d',
  tintaMedia: '#4a3d40',
  tintaSuave: '#6b5d60',
  tintaTenue: '#8a7b7e',
  crema: '#faf6f1',
  papel: '#ffffff',
  borde: '#e7ddd6',
  bordeSuave: '#f1eae4',
  error: '#b3261e',
  errorFondo: '#fbeae9',
}

const estilos = StyleSheet.create({
  page: { padding: 30, paddingBottom: 40, fontSize: 9, fontFamily: 'Helvetica', color: color.tinta, backgroundColor: color.crema },

  // Marca de agua de fondo (sello de autenticidad)
  marcaAgua: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaAguaImagen: { width: 360, height: 360, opacity: 0.13 },

  // Encabezado
  filaEncabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoNombre: { fontSize: 26, fontFamily: 'Times-BoldItalic', color: color.vinoOscuro },
  logoSub: { fontSize: 8, fontFamily: 'Helvetica', color: color.tintaSuave, letterSpacing: 3, marginTop: 3 },

  cajaDoc: { alignItems: 'flex-end' },
  tituloDoc: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: color.tinta },
  subtituloDoc: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: color.vino, letterSpacing: 3, marginTop: -2 },
  badgeNumero: {
    marginTop: 8,
    backgroundColor: color.bordeSuave,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  badgeNumeroTexto: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: color.tinta },

  filaDato: { flexDirection: 'row', marginTop: 6 },
  etiquetaDato: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: color.tintaSuave, width: 55, textAlign: 'right' },
  valorDato: { fontSize: 8.5, marginLeft: 6, color: color.tinta },

  aviso: {
    marginTop: 12,
    paddingVertical: 5,
    borderRadius: 3,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    backgroundColor: color.errorFondo,
    color: color.error,
  },

  divisor: { borderBottomWidth: 1, borderBottomColor: color.borde, marginTop: 14, marginBottom: 14 },

  // Datos del vendedor / bienvenida
  filaCajas: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  caja: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: color.borde,
    borderRadius: 6,
    backgroundColor: color.papel,
    overflow: 'hidden',
  },
  cajaTitulo: {
    backgroundColor: color.bordeSuave,
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: color.tinta,
    letterSpacing: 0.5,
  },
  cajaCuerpo: { padding: 10 },
  filaCampo: { flexDirection: 'row', marginBottom: 4 },
  etiquetaCampo: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: color.tintaSuave, width: 60 },
  valorCampo: { fontSize: 8.5, flex: 1, color: color.tinta },

  gracias: { alignItems: 'center', padding: 12 },
  graciasCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: color.tinta,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  graciasCheckInterior: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: color.tinta,
  },
  graciasTitulo: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: color.tinta, textAlign: 'center', marginBottom: 5 },
  graciasTexto: { fontSize: 7.5, color: color.tintaSuave, textAlign: 'center', lineHeight: 1.4 },
  graciasCierre: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: color.vino,
    textAlign: 'center',
    marginTop: 6,
  },

  // Tabla de items
  tabla: { marginTop: 16 },
  filaTablaEncabezado: {
    flexDirection: 'row',
    backgroundColor: color.tinta,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  filaTabla: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: color.borde,
  },
  celdaEncabezado: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: color.papel, letterSpacing: 0.5 },
  colCantidad: { width: '10%' },
  colProducto: { width: '46%' },
  colPrecio: { width: '22%', textAlign: 'right' },
  colSubtotal: { width: '22%', textAlign: 'right' },
  nombreProducto: { fontSize: 9 },
  subNombreProducto: { fontSize: 7.5, color: color.tintaSuave, marginTop: 1 },
  valorCelda: { fontSize: 8.5 },

  // Pie: forma de pago + observaciones + totales
  filaPie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  columnaIzquierda: { width: '52%' },
  columnaDerecha: { width: '44%' },

  tituloSeccion: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: color.tinta, marginBottom: 6, textTransform: 'uppercase' },
  filaFormasPago: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  opcionPago: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 },
  casilla: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: color.tinta,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaMarcada: { backgroundColor: color.tinta },
  casillaCheck: { fontSize: 6, color: color.papel, fontFamily: 'Helvetica-Bold' },
  textoOpcionPago: { fontSize: 8 },

  cajaObservaciones: {
    borderWidth: 1,
    borderColor: color.borde,
    borderRadius: 4,
    minHeight: 40,
    padding: 8,
    backgroundColor: color.papel,
  },
  textoObservaciones: { fontSize: 8, color: color.tinta, lineHeight: 1.4 },

  bloqueTotales: {
    borderWidth: 1,
    borderColor: color.borde,
    borderRadius: 4,
    overflow: 'hidden',
  },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: color.borde,
  },
  etiquetaTotal: { fontSize: 8.5, color: color.tintaSuave },
  valorTotal: { fontSize: 8.5, color: color.tinta },
  filaTotalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: color.tinta,
  },
  etiquetaTotalFinal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: color.papel },
  valorTotalFinal: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: color.papel },

  seccionPagos: { marginTop: 10 },
  saldoAlerta: { color: color.error },

  // Franja de confianza + pie de marca
  franjaConfianza: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color.borde,
    borderRadius: 6,
    backgroundColor: color.papel,
  },
  itemConfianza: { width: '24%' },
  itemConfianzaTitulo: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: color.tinta },
  itemConfianzaTexto: { fontSize: 6.5, color: color.tintaSuave, marginTop: 2, lineHeight: 1.3 },

  piePagina: {
    marginTop: 10,
    backgroundColor: color.tinta,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  contactoFila: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  contactoTexto: { fontSize: 7.5, color: color.crema },
  contactoSeparador: { fontSize: 7.5, color: color.tintaTenue, marginHorizontal: 8 },
  marcaPie: { fontSize: 10, fontFamily: 'Times-BoldItalic', color: color.papel, textAlign: 'center', marginTop: 8 },
  taglinePie: { fontSize: 6.5, color: color.vinoClaro, textAlign: 'center', marginTop: 2, letterSpacing: 0.5 },
  legalPie: { fontSize: 6, color: color.tintaTenue, textAlign: 'center', marginTop: 6, lineHeight: 1.3 },
})

const ESTADO_TEXTO: Record<DatosBoleta['estado'], string> = {
  borrador: 'BORRADOR — Venta aún no confirmada',
  confirmada: 'VENTA CONFIRMADA',
  anulada: 'VENTA ANULADA',
}

function tieneMetodo(metodosPago: string[], ...codigos: string[]) {
  return codigos.some((c) => metodosPago.includes(c))
}

function Casilla({ marcada }: { marcada: boolean }) {
  return (
    <View style={[estilos.casilla, marcada ? estilos.casillaMarcada : {}]}>
      {marcada && <Text style={estilos.casillaCheck}>X</Text>}
    </View>
  )
}

function BoletaDocument({ datos }: { datos: DatosBoleta }) {
  const efectivo = tieneMetodo(datos.metodosPago, 'efectivo')
  const transferencia = tieneMetodo(datos.metodosPago, 'transferencia', 'tarjeta')
  const yapePlin = tieneMetodo(datos.metodosPago, 'yape', 'plin')

  return (
    <Document
      title={`Boleta ${datos.numero}`}
      author={EMPRESA.nombreCompleto}
      subject="Boleta de venta interna"
    >
      <Page size="A4" style={estilos.page}>
        <View style={estilos.marcaAgua} fixed>
          <Image src={MARCA_AGUA} style={estilos.marcaAguaImagen} />
        </View>

        <View style={estilos.filaEncabezado}>
          <View>
            <Text style={estilos.logoNombre}>{EMPRESA.nombre}</Text>
            <Text style={estilos.logoSub}>— IMPORTS —</Text>
          </View>

          <View style={estilos.cajaDoc}>
            <Text style={estilos.tituloDoc}>BOLETA</Text>
            <Text style={estilos.subtituloDoc}>DE VENTA</Text>
            <View style={estilos.badgeNumero}>
              <Text style={estilos.badgeNumeroTexto}>N° {datos.numero}</Text>
            </View>

            <View style={estilos.filaDato}>
              <Text style={estilos.etiquetaDato}>FECHA:</Text>
              <Text style={estilos.valorDato}>{fecha(datos.fecha)}</Text>
            </View>
            <View style={estilos.filaDato}>
              <Text style={estilos.etiquetaDato}>VENDEDOR:</Text>
              <Text style={estilos.valorDato}>{datos.asesorNombre ?? datos.atendidoPor ?? '—'}</Text>
            </View>
            <View style={estilos.filaDato}>
              <Text style={estilos.etiquetaDato}>DNI/RUC:</Text>
              <Text style={estilos.valorDato}>—</Text>
            </View>
          </View>
        </View>

        {datos.estado !== 'confirmada' && (
          <Text style={estilos.aviso}>{ESTADO_TEXTO[datos.estado]}</Text>
        )}

        <View style={estilos.divisor} />

        <View style={estilos.filaCajas}>
          <View style={estilos.caja}>
            <Text style={estilos.cajaTitulo}>DATOS DEL COMPRADOR</Text>
            <View style={estilos.cajaCuerpo}>
              <View style={estilos.filaCampo}>
                <Text style={estilos.etiquetaCampo}>NOMBRE:</Text>
                <Text style={estilos.valorCampo}>{datos.compradorNombre}</Text>
              </View>
              <View style={estilos.filaCampo}>
                <Text style={estilos.etiquetaCampo}>TELÉFONO:</Text>
                <Text style={estilos.valorCampo}>{datos.compradorTelefono ?? '—'}</Text>
              </View>
              <View style={estilos.filaCampo}>
                <Text style={estilos.etiquetaCampo}>DIRECCIÓN:</Text>
                <Text style={estilos.valorCampo}>{datos.compradorDireccion ?? '—'}</Text>
              </View>
              <View style={estilos.filaCampo}>
                <Text style={estilos.etiquetaCampo}>DOCUMENTO:</Text>
                <Text style={estilos.valorCampo}>{datos.compradorDocumento ?? '—'}</Text>
              </View>
              <View style={[estilos.filaCampo, { marginBottom: 0 }]}>
                <Text style={estilos.etiquetaCampo}>VENTA:</Text>
                <Text style={estilos.valorCampo}>{datos.tipoPrecio} · {datos.canal}</Text>
              </View>
            </View>
          </View>

          <View style={estilos.caja}>
            <View style={estilos.gracias}>
              <View style={estilos.graciasCheck}>
                <View style={estilos.graciasCheckInterior} />
              </View>
              <Text style={estilos.graciasTitulo}>GRACIAS POR ELEGIR {EMPRESA.nombreCompleto}</Text>
              <Text style={estilos.graciasTexto}>
                Ofrecemos productos 100% originales, seleccionados para brindarte la mejor calidad y
                confianza. Tu satisfacción es nuestra prioridad.
              </Text>
              <Text style={estilos.graciasCierre}>¡CON CALIDAD, CONFIANZA Y COMPROMISO!</Text>
            </View>
          </View>
        </View>

        <View style={estilos.tabla}>
          <View style={estilos.filaTablaEncabezado}>
            <Text style={[estilos.celdaEncabezado, estilos.colCantidad]}>CANT.</Text>
            <Text style={[estilos.celdaEncabezado, estilos.colProducto]}>DESCRIPCIÓN</Text>
            <Text style={[estilos.celdaEncabezado, estilos.colPrecio]}>P. UNITARIO</Text>
            <Text style={[estilos.celdaEncabezado, estilos.colSubtotal]}>SUBTOTAL</Text>
          </View>
          {datos.items.map((it, i) => (
            <View key={i} style={estilos.filaTabla} wrap={false}>
              <Text style={[estilos.colCantidad, estilos.valorCelda]}>{numero(it.cantidad)}</Text>
              <View style={estilos.colProducto}>
                <Text style={estilos.nombreProducto}>{it.producto}</Text>
                {(it.variante || it.sku) && (
                  <Text style={estilos.subNombreProducto}>
                    {[it.variante, it.sku].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <Text style={[estilos.colPrecio, estilos.valorCelda]}>{soles(it.precio_unitario)}</Text>
              <Text style={[estilos.colSubtotal, estilos.valorCelda]}>{soles(it.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={estilos.filaPie}>
          <View style={estilos.columnaIzquierda}>
            <Text style={estilos.tituloSeccion}>Forma de pago</Text>
            <View style={estilos.filaFormasPago}>
              <View style={estilos.opcionPago}>
                <Casilla marcada={efectivo} />
                <Text style={estilos.textoOpcionPago}>Efectivo</Text>
              </View>
              <View style={estilos.opcionPago}>
                <Casilla marcada={transferencia} />
                <Text style={estilos.textoOpcionPago}>Transferencia</Text>
              </View>
              <View style={estilos.opcionPago}>
                <Casilla marcada={yapePlin} />
                <Text style={estilos.textoOpcionPago}>Yape / Plin</Text>
              </View>
            </View>

            <Text style={estilos.tituloSeccion}>Observaciones</Text>
            <View style={estilos.cajaObservaciones}>
              <Text style={estilos.textoObservaciones}>{datos.notas || '—'}</Text>
            </View>

            {datos.estado === 'confirmada' && (
              <View style={estilos.seccionPagos}>
                <Text style={estilos.tituloSeccion}>Pagos registrados</Text>
                {datos.pagos.length > 0 ? (
                  datos.pagos.map((p, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={estilos.etiquetaTotal}>{fecha(p.fecha)} · {p.metodo}</Text>
                      <Text style={estilos.valorTotal}>{soles(p.monto)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={estilos.etiquetaTotal}>Sin pagos registrados.</Text>
                )}
              </View>
            )}
          </View>

          <View style={estilos.columnaDerecha}>
            <View style={estilos.bloqueTotales}>
              <View style={estilos.filaTotal}>
                <Text style={estilos.etiquetaTotal}>Subtotal</Text>
                <Text style={estilos.valorTotal}>{soles(datos.subtotal)}</Text>
              </View>
              <View style={estilos.filaTotal}>
                <Text style={estilos.etiquetaTotal}>Descuento</Text>
                <Text style={estilos.valorTotal}>− {soles(datos.descuento)}</Text>
              </View>
              {datos.estado === 'confirmada' && (
                <>
                  <View style={estilos.filaTotal}>
                    <Text style={estilos.etiquetaTotal}>Pagado</Text>
                    <Text style={estilos.valorTotal}>{soles(datos.pagado)}</Text>
                  </View>
                  <View style={estilos.filaTotal}>
                    <Text style={[estilos.etiquetaTotal, datos.saldo > 0 ? estilos.saldoAlerta : {}]}>
                      Saldo pendiente
                    </Text>
                    <Text style={[estilos.valorTotal, datos.saldo > 0 ? estilos.saldoAlerta : {}]}>
                      {soles(datos.saldo)}
                    </Text>
                  </View>
                </>
              )}
              <View style={estilos.filaTotalFinal}>
                <Text style={estilos.etiquetaTotalFinal}>TOTAL</Text>
                <Text style={estilos.valorTotalFinal}>{soles(datos.total)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={estilos.franjaConfianza}>
          <View style={estilos.itemConfianza}>
            <Text style={estilos.itemConfianzaTitulo}>100% ORIGINALES</Text>
            <Text style={estilos.itemConfianzaTexto}>Productos auténticos y garantizados.</Text>
          </View>
          <View style={estilos.itemConfianza}>
            <Text style={estilos.itemConfianzaTitulo}>COMPRA SEGURA</Text>
            <Text style={estilos.itemConfianzaTexto}>Tu compra está protegida.</Text>
          </View>
          <View style={estilos.itemConfianza}>
            <Text style={estilos.itemConfianzaTitulo}>ENVÍOS A TODO EL PERÚ</Text>
            <Text style={estilos.itemConfianzaTexto}>Llegamos a donde estés.</Text>
          </View>
          <View style={estilos.itemConfianza}>
            <Text style={estilos.itemConfianzaTitulo}>¿DUDAS O CONSULTAS?</Text>
            <Text style={estilos.itemConfianzaTexto}>WhatsApp {EMPRESA.whatsapp}</Text>
          </View>
        </View>

        <View style={estilos.piePagina}>
          <View style={estilos.contactoFila}>
            <Text style={estilos.contactoTexto}>{EMPRESA.instagram}</Text>
            <Text style={estilos.contactoSeparador}>|</Text>
            <Text style={estilos.contactoTexto}>{EMPRESA.whatsapp}</Text>
            <Text style={estilos.contactoSeparador}>|</Text>
            <Text style={estilos.contactoTexto}>{EMPRESA.ciudad}</Text>
          </View>
          <Text style={estilos.marcaPie}>{EMPRESA.nombreCompleto}</Text>
          <Text style={estilos.taglinePie}>{EMPRESA.tagline.toUpperCase()}</Text>
          <Text style={estilos.legalPie}>
            Documento de control interno generado por el sistema de gestión de {EMPRESA.nombre}. No
            constituye un comprobante de pago válido ante SUNAT ni reemplaza a una boleta o factura
            electrónica.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generarBoletaPdf(datos: DatosBoleta): Promise<Buffer> {
  return renderToBuffer(<BoletaDocument datos={datos} />)
}
