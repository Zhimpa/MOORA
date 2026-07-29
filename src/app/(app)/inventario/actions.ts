'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// El stock nunca se escribe directo: se registra un ajuste y el trigger recalcula.
export async function ajustarStock(formData: FormData) {
  const variante_id = String(formData.get('variante_id') ?? '')
  const stock_real = Number(formData.get('stock_real') ?? 0)
  const motivo = String(formData.get('motivo') ?? '').trim() || 'Ajuste por conteo físico'

  if (!variante_id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('ajustar_stock', {
    p_variante_id: variante_id,
    p_stock_real: stock_real,
    p_motivo: motivo,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/inventario')
  revalidatePath('/')
}

// Entrada o salida manual (merma, uso interno, regalo, etc.)
export async function movimientoManual(formData: FormData) {
  const variante_id = String(formData.get('variante_id') ?? '')
  const tipo = String(formData.get('tipo') ?? 'entrada')
  const cantidadBruta = Number(formData.get('cantidad') ?? 0)
  const motivo = String(formData.get('motivo') ?? '').trim() || null

  if (!variante_id || cantidadBruta <= 0) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: almacen } = await supabase
    .from('almacenes').select('id').eq('activo', true).limit(1).single()
  if (!almacen) throw new Error('No hay ningún almacén configurado.')

  const { data: variante } = await supabase
    .from('variantes').select('costo_promedio, stock').eq('id', variante_id).single()

  // La salida va en negativo; la restricción de la tabla exige el signo correcto.
  const cantidad = tipo === 'salida' ? -cantidadBruta : cantidadBruta

  if (tipo === 'salida' && Number(variante?.stock ?? 0) < cantidadBruta) {
    throw new Error('No hay stock suficiente para esa salida.')
  }

  const { error } = await supabase.from('movimientos_inventario').insert({
    variante_id,
    almacen_id: almacen.id,
    tipo,
    cantidad,
    costo_unitario: Number(variante?.costo_promedio ?? 0),
    referencia_tipo: 'manual',
    motivo,
    usuario_id: user?.id ?? null,
  })
  if (error) throw new Error(`No se pudo registrar el movimiento: ${error.message}`)

  revalidatePath('/inventario')
  revalidatePath('/')
}
