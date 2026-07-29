import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// Toda la plata del sistema es en soles.
export function soles(monto: number | string | null | undefined): string {
  const n = Number(monto ?? 0)
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n)
}

export function numero(valor: number | string | null | undefined, decimales = 2): string {
  const n = Number(valor ?? 0)
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(isNaN(n) ? 0 : n)
}

export function fecha(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  const d = typeof valor === 'string' ? parseISO(valor) : valor
  return format(d, 'dd/MM/yyyy', { locale: es })
}

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  const d = typeof valor === 'string' ? parseISO(valor) : valor
  return format(d, "dd/MM/yyyy HH:mm", { locale: es })
}

export function mesLargo(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  const d = typeof valor === 'string' ? parseISO(valor) : valor
  return format(d, 'MMMM yyyy', { locale: es })
}
