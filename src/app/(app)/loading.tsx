import { Esqueleto } from '@/components/ui'

export default function CargandoApp() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <Esqueleto className="mb-6 h-8 w-56" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-tarjeta border border-borde bg-papel p-5">
            <Esqueleto className="mb-2.5 h-3 w-2/3" />
            <Esqueleto className="h-6 w-1/2" />
          </div>
        ))}
      </div>

      <div className="rounded-panel border border-borde bg-papel p-5">
        <Esqueleto className="mb-3 h-4 w-full" />
        <Esqueleto className="mb-3 h-4 w-11/12" />
        <Esqueleto className="mb-3 h-4 w-3/5" />
        <Esqueleto className="h-4 w-4/5" />
      </div>
    </div>
  )
}
