export function formatMoneda(valor, moneda = 'USD') {
  if (valor == null) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(valor)
}

export function formatFecha(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function formatFechaHora(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
