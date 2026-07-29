'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function registrarGasto(formData: FormData) {
  const descripcion = String(formData.get('descripcion') ?? '').trim()
  const monto = Number(formData.get('monto') ?? 0)
  if (!descripcion || monto <= 0) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const categoria = String(formData.get('categoria_gasto_id') ?? '')

  const { error } = await supabase.from('gastos').insert({
    descripcion,
    monto,
    categoria_gasto_id: categoria || null,
    fecha: String(formData.get('fecha') ?? '') || new Date().toISOString().slice(0, 10),
    metodo: String(formData.get('metodo') ?? 'efectivo'),
    usuario_id: user?.id ?? null,
  })
  if (error) throw new Error(`No se pudo registrar el gasto: ${error.message}`)

  revalidatePath('/gastos')
  revalidatePath('/reportes')
  revalidatePath('/')
}

export async function eliminarGasto(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) throw new Error(`No se pudo eliminar el gasto: ${error.message}`)

  revalidatePath('/gastos')
  revalidatePath('/reportes')
}

export async function crearCategoriaGasto(formData: FormData) {
  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) return

  const supabase = await createClient()
  const { error } = await supabase.from('categorias_gasto').insert({ nombre })
  if (error) throw new Error(`No se pudo crear la categoría: ${error.message}`)

  revalidatePath('/gastos')
}
