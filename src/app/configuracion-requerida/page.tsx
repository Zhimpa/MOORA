// Pantalla que aparece cuando faltan las variables de entorno de Supabase.
// No usa Supabase (no podría): es estática a propósito.

export const metadata = { title: 'Falta configurar — MOORA' }

const VARIABLES = [
  {
    nombre: 'NEXT_PUBLIC_SUPABASE_URL',
    donde: 'Project Settings → API → Project URL',
    falta: !process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
  {
    nombre: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    donde: 'Project Settings → API → clave pública (anon / publishable)',
    falta: !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  {
    nombre: 'SUPABASE_SERVICE_ROLE_KEY',
    donde: 'Project Settings → API → clave secreta (service_role). Nunca es pública.',
    falta: !process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
]

export default function ConfiguracionRequerida() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-crema px-4 py-10">
      <div className="w-full max-w-lg rounded-panel border border-borde bg-papel p-7 shadow-elevada">
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-alerta-fondo text-lg font-bold text-alerta">
          !
        </div>

        <h1 className="titulo-editorial mb-2 text-2xl text-tinta">Falta configurar la conexión</h1>
        <p className="mb-5 text-sm leading-relaxed text-tinta-media">
          La aplicación está desplegada, pero no tiene las credenciales de Supabase. Sin ellas no
          puede leer ni guardar nada.
        </p>

        <ul className="mb-6 flex flex-col gap-3">
          {VARIABLES.map((v) => (
            <li key={v.nombre} className="rounded-tarjeta border border-borde p-3.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <code className="text-xs font-semibold text-tinta">{v.nombre}</code>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    v.falta ? 'bg-error-fondo text-error' : 'bg-exito-fondo text-exito'
                  }`}
                >
                  {v.falta ? 'Falta' : 'Configurada'}
                </span>
              </div>
              <p className="text-xs text-tinta-suave">{v.donde}</p>
            </li>
          ))}
        </ul>

        <div className="rounded-tarjeta border-l-[3px] border-alerta bg-alerta-fondo px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-tinta">Cómo arreglarlo en Vercel</p>
          <ol className="ml-4 list-decimal text-sm leading-relaxed text-tinta-media">
            <li>Project Settings → Environment Variables</li>
            <li>Agrega las tres variables (marca Production, Preview y Development)</li>
            <li>
              Deployments → en el último despliegue, <strong>Redeploy</strong>
            </li>
          </ol>
          <p className="mt-2 text-xs text-tinta-media">
            El tercer paso no es opcional: las variables que empiezan con{' '}
            <code className="text-xs">NEXT_PUBLIC_</code> se incrustan al construir, así que un
            despliegue viejo no las ve.
          </p>
        </div>

        <p className="mt-5 text-xs text-tinta-suave">
          En local, estas variables van en el archivo <code>.env.local</code> de la raíz del
          proyecto.
        </p>
      </div>
    </main>
  )
}
