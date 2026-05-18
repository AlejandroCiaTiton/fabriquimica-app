import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const AZUL = [0, 74, 153]
const GRIS = [100, 100, 100]
const NEGRO = [30, 30, 30]

function cabecera(doc, codigo, titulo, fecha) {
  doc.setFillColor(...AZUL)
  doc.rect(0, 0, 210, 18, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Fabriquímica S.A.', 14, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('app.fabriquimica.com', 14, 15.5)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(codigo, 196, 10, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(titulo, 196, 14.5, { align: 'right' })
  doc.text(fecha, 196, 18.5, { align: 'right', baseline: 'top' })

  doc.setTextColor(...NEGRO)
}

function seccionCliente(doc, y, cliente, vendedor) {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRIS)
  doc.text('CLIENTE', 14, y)
  doc.setTextColor(...NEGRO)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(cliente?.razon_social ?? '—', 14, y + 5)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRIS)
  if (cliente?.cuit) doc.text(`CUIT: ${cliente.cuit}`, 14, y + 9.5)

  if (vendedor) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRIS)
    doc.text('VENDEDOR', 120, y)
    doc.setTextColor(...NEGRO)
    doc.setFont('helvetica', 'normal')
    doc.text(vendedor, 120, y + 5)
  }

  doc.setTextColor(...NEGRO)
}

function piePagina(doc) {
  const pg = doc.getNumberOfPages()
  for (let i = 1; i <= pg; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...GRIS)
    doc.text('Fabriquímica S.A. · Sistema de Gestión', 14, 290)
    doc.text(`Página ${i} de ${pg}`, 196, 290, { align: 'right' })
    doc.setDrawColor(220, 220, 220)
    doc.line(14, 286, 196, 286)
  }
}

export function generateCotizacionPDF(cotizacion) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const fecha = new Date(cotizacion.creado_en).toLocaleDateString('es-AR')
  const cliente = cotizacion.clientes
  const vendedor = cotizacion.vendedores?.perfiles?.nombre ?? null
  const items = cotizacion.cotizacion_items ?? []

  cabecera(doc, cotizacion.codigo, 'COTIZACIÓN', fecha)

  const estadoColores = { ganada: [40, 167, 69], perdida: [220, 53, 69], espera: [255, 193, 7], revision: [255, 152, 0] }
  const color = estadoColores[cotizacion.estado] ?? GRIS
  doc.setFillColor(...color)
  doc.roundedRect(155, 22, 40, 7, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text((cotizacion.estado ?? '').toUpperCase(), 175, 26.5, { align: 'center' })
  doc.setTextColor(...NEGRO)

  seccionCliente(doc, 24, cliente, vendedor)

  if (cotizacion.validez_dias) {
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    doc.text(`Validez: ${cotizacion.validez_dias} días`, 14, 44)
    doc.setTextColor(...NEGRO)
  }

  autoTable(doc, {
    startY: 50,
    head: [['Código', 'Producto', 'Presentación', 'Cant.', 'Precio unit.', 'Subtotal']],
    body: items.map(it => [
      it.productos?.codigo ?? '',
      it.productos?.nombre ?? '',
      it.productos?.presentacion ?? '',
      it.cantidad ?? 0,
      `USD ${Number(it.precio_unitario).toFixed(2)}`,
      `USD ${Number(it.subtotal).toFixed(2)}`,
    ]),
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: NEGRO },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  const finalY = doc.lastAutoTable.finalY + 5

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRIS)
  doc.text('Subtotal:', 145, finalY)
  doc.text(`USD ${Number(cotizacion.subtotal).toFixed(2)}`, 196, finalY, { align: 'right' })
  doc.text('IVA 21%:', 145, finalY + 6)
  doc.text(`USD ${Number(cotizacion.iva).toFixed(2)}`, 196, finalY + 6, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NEGRO)
  doc.setFontSize(11)
  doc.text('TOTAL USD:', 140, finalY + 14)
  doc.text(`USD ${Number(cotizacion.total).toFixed(2)}`, 196, finalY + 14, { align: 'right' })

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRIS)
  doc.text(`Moneda: ${(cotizacion.moneda ?? 'USD').toUpperCase()}`, 14, finalY)

  if (cotizacion.observaciones) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRIS)
    doc.text('Observaciones:', 14, finalY + 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...NEGRO)
    const lines = doc.splitTextToSize(cotizacion.observaciones, 120)
    doc.text(lines, 14, finalY + 13)
  }

  piePagina(doc)
  doc.save(`${cotizacion.codigo}.pdf`)
}

export function generateOCPDF(oc) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const fecha = new Date(oc.creado_en).toLocaleDateString('es-AR')
  const cot = oc.cotizaciones
  const cliente = cot?.clientes
  const vendedor = cot?.vendedores?.perfiles?.nombre ?? null
  const items = cot?.cotizacion_items ?? []

  cabecera(doc, oc.numero, 'ORDEN DE COMPRA', fecha)

  const estadoLabel = {
    recibida: 'RECIBIDA', 'en-preparacion': 'EN PREPARACIÓN',
    'listo-entrega': 'LISTO P/ENTREGA', entregada: 'ENTREGADA',
  }
  const estadoColor = {
    recibida: [0, 74, 153], 'en-preparacion': [255, 152, 0],
    'listo-entrega': [0, 168, 232], entregada: [40, 167, 69],
  }
  const color = estadoColor[oc.estado] ?? GRIS
  doc.setFillColor(...color)
  doc.roundedRect(140, 22, 55, 7, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(estadoLabel[oc.estado] ?? oc.estado.toUpperCase(), 167.5, 26.5, { align: 'center' })
  doc.setTextColor(...NEGRO)

  seccionCliente(doc, 24, cliente, vendedor)

  const refY = 40
  if (oc.referencia_cliente) {
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    doc.text(`Ref. cliente: ${oc.referencia_cliente}`, 14, refY)
  }
  if (cot?.codigo) {
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    doc.text(`Cotización base: ${cot.codigo}`, oc.referencia_cliente ? 80 : 14, refY)
  }
  doc.setTextColor(...NEGRO)

  autoTable(doc, {
    startY: 48,
    head: [['Código', 'Producto', 'Presentación', 'Cant.', 'Precio unit.', 'Subtotal']],
    body: items.map(it => [
      it.productos?.codigo ?? '',
      it.productos?.nombre ?? '',
      it.productos?.presentacion ?? '',
      it.cantidad ?? 0,
      `USD ${Number(it.precio_unitario).toFixed(2)}`,
      `USD ${Number(it.subtotal).toFixed(2)}`,
    ]),
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: NEGRO },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  const finalY = doc.lastAutoTable.finalY + 5

  if (cot) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRIS)
    doc.text('Subtotal:', 145, finalY)
    doc.text(`USD ${Number(cot.subtotal).toFixed(2)}`, 196, finalY, { align: 'right' })
    doc.text('IVA 21%:', 145, finalY + 6)
    doc.text(`USD ${Number(cot.iva).toFixed(2)}`, 196, finalY + 6, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NEGRO)
    doc.setFontSize(11)
    doc.text('TOTAL USD:', 140, finalY + 14)
    doc.text(`USD ${Number(cot.total).toFixed(2)}`, 196, finalY + 14, { align: 'right' })
  }

  if (oc.observaciones) {
    const obsY = finalY + (cot ? 22 : 5)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRIS)
    doc.text('Observaciones:', 14, obsY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...NEGRO)
    const lines = doc.splitTextToSize(oc.observaciones, 120)
    doc.text(lines, 14, obsY + 5)
  }

  piePagina(doc)
  doc.save(`${oc.numero}.pdf`)
}
