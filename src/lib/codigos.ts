// Utilidades de códigos de barras y SKU. Sirven igual en servidor y en cliente.

/** Deja el código como lo guardamos: sin espacios ni saltos (los lectores USB los agregan). */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\s+/g, '').trim()
}

/**
 * ¿Este texto parece un código de barras o un SKU, y no el nombre de un producto?
 * Se usa para decidir si buscamos por código exacto en vez de por nombre, y también
 * para no interpolar texto libre en los filtros de PostgREST.
 */
export function pareceCodigo(texto: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/.test(normalizarCodigo(texto))
}

/** ¿Es un código de barras de fábrica (EAN-8/13, UPC, ITF-14: solo dígitos)? */
export function esCodigoDeFabrica(texto: string): boolean {
  return /^\d{8,14}$/.test(normalizarCodigo(texto))
}

/**
 * Valida el dígito verificador de un EAN-13 / EAN-8 / UPC-A.
 * Solo es un aviso para el usuario: los códigos de etiqueta propia (Code 128) no lo llevan,
 * así que nunca bloqueamos por esto.
 */
export function digitoVerificadorValido(codigo: string): boolean | null {
  const limpio = normalizarCodigo(codigo)
  if (!/^\d+$/.test(limpio) || ![8, 12, 13].includes(limpio.length)) return null

  const digitos = [...limpio].map(Number)
  const verificador = digitos.pop()!
  // De derecha a izquierda: se alterna peso 3 y 1.
  const suma = digitos
    .reverse()
    .reduce((total, d, i) => total + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (suma % 10)) % 10 === verificador
}
