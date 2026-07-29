'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { soles } from '@/lib/format'

export function GraficoVentas({ datos }: { datos: { fecha: string; total: number }[] }) {
  if (!datos || datos.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">Todavía no hay ventas registradas.</p>
  }

  const conEtiqueta = datos.map((d) => ({
    ...d,
    total: Number(d.total),
    dia: d.fecha.slice(8, 10) + '/' + d.fecha.slice(5, 7),
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={conEtiqueta} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} width={55} />
          <Tooltip
            formatter={(v) => [soles(Number(v)), 'Ventas']}
            labelFormatter={(l) => `Día ${l}`}
          />
          <Bar dataKey="total" fill="#111827" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
