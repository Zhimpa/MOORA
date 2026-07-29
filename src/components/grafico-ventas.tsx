'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { soles } from '@/lib/format'

// Barras sobrias en color borde; el día de hoy se destaca en vino.
export function GraficoVentas({ datos }: { datos: { fecha: string; total: number }[] }) {
  if (!datos || datos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-tinta-suave">
        Todavía no hay ventas registradas.
      </p>
    )
  }

  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const conEtiqueta = datos.map((d, i) => {
    // La fecha llega como AAAA-MM-DD: se parsea a mano para no depender de la zona horaria
    const [a, m, dia] = d.fecha.split('-').map(Number)
    return {
      total: Number(d.total),
      dia: DIAS[new Date(a, m - 1, dia).getDay()],
      esHoy: i === datos.length - 1,
    }
  })

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={conEtiqueta} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="dia"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#6B5D60' }}
          />
          <Tooltip
            cursor={{ fill: '#F1EAE4' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #E7DDD6',
              fontSize: 13,
              boxShadow: '0 6px 18px rgba(36,26,29,0.08)',
            }}
            formatter={(v) => [soles(Number(v)), 'Vendido']}
          />
          <Bar dataKey="total" radius={[6, 6, 2, 2]} maxBarSize={38}>
            {conEtiqueta.map((d, i) => (
              <Cell key={i} fill={d.esHoy ? '#7C2A3E' : '#E7DDD6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
