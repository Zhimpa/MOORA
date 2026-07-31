// Tipos compartidos del dominio MOORA.

export type Rol = 'admin' | 'vendedor' | 'almacen' | 'contador'

export type EstadoDocumento = 'borrador' | 'confirmada' | 'anulada'

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'tarjeta' | 'otro'

export type TipoCliente = 'minorista' | 'mayorista'

export type TipoProducto = 'perfume' | 'skincare' | 'maquillaje' | 'otro'

export type TipoMovimiento =
  | 'entrada'
  | 'salida'
  | 'ajuste'
  | 'compra'
  | 'venta'
  | 'devolucion_cliente'
  | 'devolucion_proveedor'

export const METODOS_PAGO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'yape', etiqueta: 'Yape' },
  { valor: 'plin', etiqueta: 'Plin' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export const TIPOS_PRODUCTO: { valor: TipoProducto; etiqueta: string }[] = [
  { valor: 'perfume', etiqueta: 'Perfume' },
  { valor: 'skincare', etiqueta: 'Skincare' },
  { valor: 'maquillaje', etiqueta: 'Maquillaje' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export const CATEGORIAS_PRODUCTO = ['Masculino', 'Femenino', 'Unisex'] as const

export const ROLES: { valor: Rol; etiqueta: string; descripcion: string }[] = [
  { valor: 'admin', etiqueta: 'Administrador', descripcion: 'Acceso total, incluidas finanzas y configuración' },
  { valor: 'vendedor', etiqueta: 'Vendedor', descripcion: 'Registra ventas, ve stock y clientes' },
  { valor: 'almacen', etiqueta: 'Almacén', descripcion: 'Productos, proveedores, compras e inventario' },
  { valor: 'contador', etiqueta: 'Contador', descripcion: 'Solo lectura de reportes financieros' },
]

export interface Perfil {
  id: string
  nombre_completo: string | null
  rol: Rol
  activo: boolean
  created_at: string
}

export interface KpisDashboard {
  ventas_periodo: number
  num_ventas: number
  ventas_hoy: number
  utilidad_periodo: number
  gastos_periodo: number
  por_cobrar: number
  por_pagar: number
  valor_inventario: number
  productos_activos: number
  stock_bajo: number
}
