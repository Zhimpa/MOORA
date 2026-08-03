'use client'

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react'
import {
  contextoSeguro, crearLector, hayCamara, imagenDe, leerArchivo, type Lector,
} from '@/lib/escaneo'
import { digitoVerificadorValido } from '@/lib/codigos'

/* ------------------------------------------------------------------ */
/* Iconos                                                              */
/* ------------------------------------------------------------------ */

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1-1.7h5.6l1 1.7h1.7A2.5 2.5 0 0 1 19 8.5v8A2.5 2.5 0 0 1 16.5 19h-11A2.5 2.5 0 0 1 3 16.5v-8Z"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="12" r="3.2" />
    </svg>
  )
}

function IconoBarras() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M3 5h1.6v14H3zM6 5h1v14H6zM8.6 5h2v14h-2zM12 5h1v14h-1zM14.4 5h1.6v14h-1.6zM17.6 5h1v14h-1zM20 5h1.4v14H20z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Lectura desde una imagen                                            */
/* ------------------------------------------------------------------ */

type Estado = { tipo: 'nada' } | { tipo: 'leyendo' } | { tipo: 'error'; mensaje: string }

const SIN_CODIGO =
  'No se encontró ningún código de barras en esa imagen. Prueba con una foto de más cerca, bien enfocada y con el código completo.'

/**
 * Todo lo necesario para llenar un campo a partir de una imagen: arrastrarla,
 * pegarla con Ctrl+V o elegir un archivo.
 */
function useLecturaImagen(alLeer: (codigo: string) => void) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'nada' })
  const [zonaVisible, setZonaVisible] = useState(false)

  const procesar = async (archivo: File) => {
    setZonaVisible(true)
    setEstado({ tipo: 'leyendo' })
    try {
      const lector = await crearLector()
      try {
        const codigo = await leerArchivo(lector, archivo)
        if (!codigo) throw new Error(SIN_CODIGO)
        setEstado({ tipo: 'nada' })
        setZonaVisible(false)
        alLeer(codigo)
      } finally {
        lector.liberar()
      }
    } catch (e) {
      setEstado({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo leer la imagen.' })
    }
  }

  /** Handlers para colgar del contenedor: así se puede soltar la foto en cualquier parte. */
  const zona = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setZonaVisible(true)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const archivo = imagenDe(e.dataTransfer)
      if (archivo) procesar(archivo)
      else setEstado({ tipo: 'error', mensaje: 'Arrastra una imagen (JPG o PNG) con el código de barras.' })
    },
  }

  /** Pegar una captura en el input. Si es texto normal, deja que el input lo maneje. */
  const alPegar = (e: ClipboardEvent) => {
    const archivo = imagenDe(e.clipboardData)
    if (!archivo) return
    e.preventDefault()
    procesar(archivo)
  }

  return { estado, setEstado, zonaVisible, setZonaVisible, procesar, zona, alPegar }
}

function ZonaImagen({
  procesar,
  estado,
  setEstado,
}: {
  procesar: (archivo: File) => void
  estado: Estado
  setEstado: (e: Estado) => void
}) {
  const archivoRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-campo border border-dashed border-borde bg-papel px-4 py-3 text-center">
      {estado.tipo === 'leyendo' ? (
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-tinta-media">
          <span className="girando inline-block size-3.5 rounded-full border-2 border-vino/40 border-t-vino" />
          Leyendo la imagen…
        </p>
      ) : (
        <>
          <p className="text-sm text-tinta-media">Arrastra aquí la foto del código de barras</p>
          <p className="mt-0.5 text-xs text-tinta-suave">
            o pégala con Ctrl+V,{' '}
            <button
              type="button"
              onClick={() => archivoRef.current?.click()}
              className="font-semibold text-vino underline underline-offset-2"
            >
              o elige un archivo
            </button>
          </p>
        </>
      )}

      {estado.tipo === 'error' && (
        <p className="mt-2 text-xs leading-relaxed text-error">{estado.mensaje}</p>
      )}

      <input
        ref={archivoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = '' // para poder reintentar con la misma foto
          if (archivo) {
            setEstado({ tipo: 'nada' })
            procesar(archivo)
          }
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Escáner con la cámara                                               */
/* ------------------------------------------------------------------ */

function mensajeCamara(e: unknown): string {
  const nombre = e instanceof Error ? e.name : ''
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'El navegador tiene bloqueado el permiso de cámara. Ábrelo en el candado de la barra de direcciones, permite la cámara y vuelve a intentar.'
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'Este dispositivo no tiene una cámara disponible.'
  }
  if (nombre === 'NotReadableError') {
    return 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentar.'
  }
  return 'No se pudo abrir la cámara en este dispositivo.'
}

function ModalEscaner({ alLeer, alCerrar }: { alLeer: (codigo: string) => void; alCerrar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camara, setCamara] = useState<'abriendo' | 'lista' | 'sin'>('abriendo')
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const imagen = useLecturaImagen((codigo) => {
    navigator.vibrate?.(60)
    alLeer(codigo)
  })

  // En una ref para no reiniciar la cámara cuando el padre se vuelve a renderizar.
  const alLeerRef = useRef(alLeer)
  alLeerRef.current = alLeer

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [alCerrar])

  useEffect(() => {
    let cancelado = false
    let stream: MediaStream | null = null
    let lector: Lector | null = null
    let temporizador: number | undefined

    const limpiar = () => {
      cancelado = true
      if (temporizador) window.clearTimeout(temporizador)
      stream?.getTracks().forEach((t) => t.stop()) // apaga la cámara
      lector?.liberar()
      const el = videoRef.current
      if (el) el.srcObject = null
    }

    const iniciar = async () => {
      if (!contextoSeguro()) {
        setCamara('sin')
        setErrorCamara(
          'La cámara solo funciona por https:// (o en localhost). Si abriste la app por la IP de la PC, entra por la dirección de Vercel.'
        )
        return
      }
      if (!hayCamara()) {
        setCamara('sin')
        setErrorCamara('Este navegador no permite usar la cámara.')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // en el celular, la de atrás
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelado) return limpiar()

        const el = videoRef.current
        if (!el) return
        el.srcObject = stream
        await el.play()

        lector = await crearLector()
        if (cancelado) return limpiar()
        setCamara('lista')

        // Los códigos de barras 1D se leen mal con facilidad: exigimos dos
        // lecturas iguales seguidas antes de darlo por bueno.
        let anterior = ''
        let giro = 0
        const pausa = lector.nativo ? 120 : 250

        const revisar = async () => {
          if (cancelado || !lector) return
          const codigo = await lector.leer(el, {
            escala: lector.nativo ? 1 : 0.8,
            // El motor nativo lee en cualquier orientación; ZXing no, así que
            // le vamos alternando el giro entre intentos.
            rotar: lector.nativo ? 0 : ([0, 90][giro++ % 2] as 0 | 90),
          })
          if (cancelado) return

          if (codigo && codigo === anterior) {
            navigator.vibrate?.(60)
            alLeerRef.current(codigo)
            return
          }
          if (codigo) anterior = codigo
          temporizador = window.setTimeout(revisar, pausa)
        }
        revisar()
      } catch (e) {
        if (cancelado) return
        setCamara('sin')
        setErrorCamara(mensajeCamara(e))
      }
    }

    iniciar()
    return limpiar
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-tinta/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escanear código de barras"
        className="flex max-h-full w-[min(520px,100%)] flex-col overflow-y-auto rounded-panel bg-crema shadow-modal"
        {...imagen.zona}
      >
        <header className="flex items-start justify-between gap-3 border-b border-borde px-5 py-4">
          <div>
            <h2 className="titulo-editorial text-lg text-tinta">Escanear código de barras</h2>
            <p className="mt-0.5 text-xs text-tinta-suave">
              Apunta al código y espera. La imagen no se guarda ni se sube a ningún lado.
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-tinta-suave hover:bg-borde-suave"
          >
            ×
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-5">
          {camara !== 'sin' && (
            <div className="relative overflow-hidden rounded-tarjeta bg-tinta">
              <video ref={videoRef} muted playsInline className="block max-h-[46vh] w-full" />
              {/* Guía: el código tiene que entrar completo dentro de la franja */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-1/3 w-4/5 rounded-lg border-2 border-crema/80" />
              </div>
              {camara === 'abriendo' && (
                <p className="absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-crema">
                  Abriendo la cámara…
                </p>
              )}
            </div>
          )}

          {errorCamara && (
            <div className="flex items-start gap-2.5 rounded-[10px] border-l-[3px] border-alerta bg-alerta-fondo px-4 py-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-alerta" />
              <p className="text-sm leading-relaxed text-tinta">{errorCamara}</p>
            </div>
          )}

          <p className="text-center text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            {camara === 'sin' ? 'Lee el código de una foto' : 'o lee el código de una foto'}
          </p>

          <ZonaImagen procesar={imagen.procesar} estado={imagen.estado} setEstado={imagen.setEstado} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Botón para abrir el escáner                                         */
/* ------------------------------------------------------------------ */

export function BotonEscanear({
  alLeer,
  titulo = 'Escanear con la cámara',
  children,
  className = '',
}: {
  alLeer: (codigo: string) => void
  titulo?: string
  children?: ReactNode
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={titulo}
        aria-label={titulo}
        className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-campo border border-vino bg-papel px-3 text-sm font-semibold text-vino transition-colors hover:bg-rosa-fondo ${className}`}
      >
        <IconoCamara />
        {children}
      </button>

      {abierto && (
        <ModalEscaner
          alCerrar={() => setAbierto(false)}
          alLeer={(codigo) => {
            alLeer(codigo)
            setAbierto(false)
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Campo de formulario                                                 */
/* ------------------------------------------------------------------ */

const CONTROL =
  'w-full min-h-11 rounded-campo border border-borde bg-papel px-3 py-2.5 text-sm text-tinta placeholder:text-tinta-tenue focus:border-vino focus:outline-none'

const SECUNDARIO =
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-campo border border-borde bg-papel px-3 text-tinta-media transition-colors hover:bg-borde-suave'

/**
 * Campo de código de barras con tres formas de llenarlo: la cámara del celular,
 * arrastrar o pegar una foto, y escribirlo a mano (un lector USB cuenta como teclado).
 */
export function CampoCodigoBarras({
  name = 'codigo_barras',
  defaultValue = '',
  etiqueta = 'Código de barras',
  ayuda = 'Escanéalo con la cámara, arrástrale una foto o escríbelo. Puede quedar vacío.',
}: {
  name?: string
  defaultValue?: string
  etiqueta?: string
  ayuda?: string
}) {
  const [valor, setValor] = useState(defaultValue)
  const imagen = useLecturaImagen(setValor)
  const verificador = digitoVerificadorValido(valor)

  return (
    <div className="flex flex-col gap-1.5" {...imagen.zona}>
      <span className="text-[13px] font-semibold text-tinta-media">{etiqueta}</span>

      <div className="flex gap-2">
        <input
          name={name}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onPaste={imagen.alPegar}
          autoComplete="off"
          placeholder="7501234567890"
          className={`cifra ${CONTROL}`}
        />
        <BotonEscanear alLeer={setValor} />
        <button
          type="button"
          onClick={() => imagen.setZonaVisible(!imagen.zonaVisible)}
          title="Leer el código de una foto"
          aria-label="Leer el código de una foto"
          className={SECUNDARIO}
        >
          <IconoBarras />
        </button>
      </div>

      {imagen.zonaVisible && (
        <ZonaImagen procesar={imagen.procesar} estado={imagen.estado} setEstado={imagen.setEstado} />
      )}

      {verificador === false ? (
        <span className="text-xs text-alerta">
          El dígito verificador no cuadra. Puede ser un código interno tuyo; si lo escaneaste de la
          caja, conviene repetirlo.
        </span>
      ) : (
        <span className="text-xs text-tinta-suave">{ayuda}</span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Buscador con escáner                                               */
/* ------------------------------------------------------------------ */

/** Buscador de productos: al leer un código, lanza la búsqueda solo. */
export function BuscadorConEscaner({
  name = 'q',
  defaultValue = '',
  placeholder = 'Buscar producto…',
}: {
  name?: string
  defaultValue?: string
  placeholder?: string
}) {
  const [valor, setValor] = useState(defaultValue)
  const formRef = useRef<HTMLFormElement>(null)
  // Hay que esperar a que React pinte el valor nuevo antes de enviar el formulario.
  const [porEnviar, setPorEnviar] = useState(false)

  useEffect(() => {
    if (!porEnviar) return
    setPorEnviar(false)
    formRef.current?.requestSubmit()
  }, [porEnviar])

  const imagen = useLecturaImagen((codigo) => {
    setValor(codigo)
    setPorEnviar(true)
  })

  return (
    <form ref={formRef} className="mb-4 flex flex-col gap-2" {...imagen.zona}>
      <div className="flex gap-2">
        <input
          name={name}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onPaste={imagen.alPegar}
          placeholder={placeholder}
          autoComplete="off"
          className={CONTROL}
        />
        <BotonEscanear
          alLeer={(codigo) => {
            setValor(codigo)
            setPorEnviar(true)
          }}
          titulo="Buscar escaneando el código"
        />
        <button
          type="button"
          onClick={() => imagen.setZonaVisible(!imagen.zonaVisible)}
          title="Buscar con la foto de un código"
          aria-label="Buscar con la foto de un código"
          className={SECUNDARIO}
        >
          <IconoBarras />
        </button>
        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-campo border border-vino bg-papel px-5 text-sm font-semibold text-vino transition-colors hover:bg-rosa-fondo"
        >
          Buscar
        </button>
      </div>

      {imagen.zonaVisible && (
        <ZonaImagen procesar={imagen.procesar} estado={imagen.estado} setEstado={imagen.setEstado} />
      )}
    </form>
  )
}
