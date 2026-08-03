// Lectura de códigos de barras en el navegador. Solo se usa desde componentes de cliente.
//
// Dos motores, en este orden:
//  1. BarcodeDetector, la API nativa del navegador (Chrome y Edge, en Android y en escritorio).
//     Es instantánea y no agrega ni un KB a la app.
//  2. ZXing en JavaScript, que se descarga solo si el navegador no trae la nativa
//     (Safari del iPhone, Firefox). Va en un chunk aparte: no pesa en la carga inicial.
//
// Todo se procesa en el propio dispositivo: ni la foto ni el video se suben a ningún lado.

import { normalizarCodigo } from './codigos'

/** EAN y UPC son los códigos de fábrica; Code 128/39 e ITF, los de etiquetas propias. */
const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']

/** De dónde se lee: la cámara en vivo o una foto ya cargada. */
export type Fuente = HTMLVideoElement | HTMLImageElement

export type OpcionesLectura = {
  /** Factor de reducción antes de analizar (las fotos de celular son enormes). */
  escala?: number
  /** Giro en grados. Ayuda cuando el código quedó vertical en la foto. */
  rotar?: 0 | 90 | 180
}

export type Lector = {
  /** true si está usando la API nativa del navegador. */
  nativo: boolean
  /** Devuelve el código leído, o null si en esa imagen no había ninguno legible. */
  leer(fuente: Fuente, opciones?: OpcionesLectura): Promise<string | null>
  liberar(): void
}

/* ------------------------------------------------------------------ */
/* Soporte del navegador                                               */
/* ------------------------------------------------------------------ */

/** ¿Se puede pedir la cámara? Necesita HTTPS (o localhost) y permiso del usuario. */
export function hayCamara(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/** En http:// que no sea localhost el navegador bloquea la cámara sin preguntar. */
export function contextoSeguro(): boolean {
  return typeof window === 'undefined' || window.isSecureContext
}

/* ------------------------------------------------------------------ */
/* Lector                                                             */
/* ------------------------------------------------------------------ */

type DetectorNativo = { detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]> }

type ConstructorNativo = {
  new (opciones: { formats: string[] }): DetectorNativo
  getSupportedFormats: () => Promise<string[]>
}

export async function crearLector(): Promise<Lector> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Este navegador no permite procesar imágenes.')

  const nativo = await detectorNativo()
  if (nativo) {
    return {
      nativo: true,
      liberar: () => {},
      leer: async (fuente, opciones = {}) => {
        if (!preparar(canvas, ctx, fuente, opciones)) return null
        try {
          const codigos = await nativo.detect(canvas)
          return limpiar(codigos[0]?.rawValue)
        } catch {
          return null
        }
      },
    }
  }

  // Sin API nativa: cae a ZXing, que se descarga en este momento.
  const zxing = await import('@zxing/library')
  const hints = new Map<number, unknown>()
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
    zxing.BarcodeFormat.EAN_13,
    zxing.BarcodeFormat.EAN_8,
    zxing.BarcodeFormat.UPC_A,
    zxing.BarcodeFormat.UPC_E,
    zxing.BarcodeFormat.CODE_128,
    zxing.BarcodeFormat.CODE_39,
    zxing.BarcodeFormat.ITF,
  ])
  hints.set(zxing.DecodeHintType.TRY_HARDER, true)

  const motor = new zxing.MultiFormatReader()
  motor.setHints(hints)

  return {
    nativo: false,
    liberar: () => motor.reset(),
    leer: async (fuente, opciones = {}) => {
      if (!preparar(canvas, ctx, fuente, opciones)) return null
      const { width: ancho, height: alto } = canvas
      const pixeles = ctx.getImageData(0, 0, ancho, alto).data

      // ZXing trabaja en escala de grises, con el mismo peso hacia el verde que usa internamente.
      const gris = new Uint8ClampedArray(ancho * alto)
      for (let i = 0, p = 0; p < gris.length; i += 4, p++) {
        gris[p] = (pixeles[i] * 306 + pixeles[i + 1] * 601 + pixeles[i + 2] * 117) >> 10
      }

      try {
        const fuenteLuz = new zxing.RGBLuminanceSource(gris, ancho, alto)
        const mapa = new zxing.BinaryBitmap(new zxing.HybridBinarizer(fuenteLuz))
        return limpiar(motor.decode(mapa).getText())
      } catch {
        // NotFoundException: en este frame no había código. Es lo normal.
        return null
      } finally {
        motor.reset()
      }
    },
  }
}

async function detectorNativo(): Promise<DetectorNativo | null> {
  const Nativo = (globalThis as { BarcodeDetector?: ConstructorNativo }).BarcodeDetector
  if (!Nativo) return null
  try {
    const soportados = await Nativo.getSupportedFormats()
    const formats = FORMATOS_NATIVOS.filter((f) => soportados.includes(f))
    if (formats.length === 0) return null
    return new Nativo({ formats })
  } catch {
    // Algunos navegadores exponen la API pero no la implementan de verdad.
    return null
  }
}

function limpiar(valor: string | undefined): string | null {
  const codigo = normalizarCodigo(valor ?? '')
  return codigo.length >= 4 ? codigo : null
}

/** Copia la fuente al canvas de trabajo, escalada y girada. false si todavía no hay imagen. */
function preparar(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  fuente: Fuente,
  { escala = 1, rotar = 0 }: OpcionesLectura
): boolean {
  const anchoReal = fuente instanceof HTMLVideoElement ? fuente.videoWidth : fuente.naturalWidth
  const altoReal = fuente instanceof HTMLVideoElement ? fuente.videoHeight : fuente.naturalHeight
  if (!anchoReal || !altoReal) return false

  const ancho = Math.max(1, Math.round(anchoReal * escala))
  const alto = Math.max(1, Math.round(altoReal * escala))
  const vertical = rotar === 90

  canvas.width = vertical ? alto : ancho
  canvas.height = vertical ? ancho : alto

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (rotar) {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotar * Math.PI) / 180)
    ctx.drawImage(fuente, -ancho / 2, -alto / 2, ancho, alto)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  } else {
    ctx.drawImage(fuente, 0, 0, ancho, alto)
  }
  return true
}

/* ------------------------------------------------------------------ */
/* Lectura desde una foto (arrastrada, pegada o elegida del carrete)   */
/* ------------------------------------------------------------------ */

const PESO_MAXIMO = 25 * 1024 * 1024
const ANCHO_ANALISIS = 1600

export async function leerArchivo(lector: Lector, archivo: File): Promise<string | null> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Eso no es una imagen. Arrastra una foto o captura del código de barras.')
  }
  if (archivo.size > PESO_MAXIMO) {
    throw new Error('La imagen es demasiado pesada. Usa una de menos de 25 MB.')
  }

  const imagen = await cargarImagen(archivo)
  try {
    // Primero reducida: es más rápido y suele acertar más que la foto a tamaño completo.
    const escala =
      imagen.naturalWidth > ANCHO_ANALISIS ? ANCHO_ANALISIS / imagen.naturalWidth : 1
    const intentos: OpcionesLectura[] = [
      { escala },
      { escala, rotar: 90 },
      { escala, rotar: 180 },
      { escala: 1 },
      { escala: 1, rotar: 90 },
    ]
    for (const intento of intentos) {
      const codigo = await lector.leer(imagen, intento)
      if (codigo) return codigo
    }
    return null
  } finally {
    URL.revokeObjectURL(imagen.src)
  }
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()
    imagen.onload = () => resolver(imagen)
    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      rechazar(new Error('No se pudo abrir esa imagen.'))
    }
    imagen.src = url
  })
}

/** Saca el primer archivo de imagen de un arrastre o de un pegado (Ctrl+V). */
export function imagenDe(datos: DataTransfer | null): File | null {
  if (!datos) return null
  const archivos = [...(datos.files ?? [])].filter((f) => f.type.startsWith('image/'))
  if (archivos.length > 0) return archivos[0]

  for (const item of datos.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const archivo = item.getAsFile()
      if (archivo) return archivo
    }
  }
  return null
}
