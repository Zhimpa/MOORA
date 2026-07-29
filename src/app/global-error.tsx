'use client'

// Red de seguridad: captura errores que ocurren en el layout raíz, donde el
// error.tsx de las páginas ya no alcanza. Reemplaza al layout completo, así que
// tiene que traer su propio <html> y <body>.
// Los estilos van en línea porque globals.css se importa en el layout que este
// componente está sustituyendo.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: '#FAF6F1',
          color: '#241A1D',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            background: '#FFFFFF',
            border: '1px solid #E7DDD6',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 8px 24px rgba(36,26,29,0.06)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: '#FBEAE9',
              color: '#B3261E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 18,
              marginBottom: 16,
            }}
          >
            !
          </div>

          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>La aplicación no pudo iniciar</h1>

          <div
            style={{
              background: '#FBEAE9',
              borderLeft: '3px solid #B3261E',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 14,
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            {error.message || 'Ocurrió un error inesperado.'}
          </div>

          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: '11px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#7C2A3E',
              color: '#FAF6F1',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
