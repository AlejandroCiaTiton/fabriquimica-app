export const IVA_RATE = 0.21

export function calcularTotales(items) {
  const subtotal = items.reduce((s, it) => s + (it.precio_unitario ?? 0) * (it.cantidad ?? 0), 0)
  const iva      = subtotal * IVA_RATE
  return { subtotal, iva, total: subtotal + iva }
}

export function fmtUSD(val) {
  if (val == null || isNaN(val)) return '—'
  return 'USD ' + Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtFecha(str) {
  if (!str) return '—'
  // Strings de solo fecha (YYYY-MM-DD) se parsean como UTC → se añade hora local para evitar desfase de día
  const d = typeof str === 'string' && str.length === 10
    ? new Date(str + 'T00:00:00')
    : new Date(str)
  return d.toLocaleDateString('es-AR')
}

export function fmtFechaCorta(str) {
  if (!str) return '—'
  return new Date(str + 'T00:00:00').toLocaleDateString('es-AR')
}
