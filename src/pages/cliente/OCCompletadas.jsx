import { useState } from 'react'
import { useOrdenesCliente, useSubirComprobantePago, useComprobantesOC } from '../../hooks/useOrdenes'

const PAGO_BADGE = {
  pendiente: { label: 'Pendiente', cls: 'bg-red-100 text-red-700' },
  parcial:   { label: 'Parcial',   cls: 'bg-yellow-100 text-yellow-800' },
  pagado:    { label: 'Pagado',    cls: 'bg-green-100 text-green-700' },
}

function fmtUSD(v) {
  if (v == null) return '—'
  return 'USD ' + Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function BtnSubirComprobante({ ocId }) {
  const subir = useSubirComprobantePago()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try { await subir.mutateAsync({ ocId, file }) }
    finally { setUploading(false); e.target.value = '' }
  }

  return (
    <label className={`flex items-center gap-1 cursor-pointer text-xs font-medium px-2 py-1 rounded border transition-colors ${
      uploading ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-500 hover:border-[#004a99] hover:text-[#004a99]'
    }`}>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading} onChange={handleFile}/>
      {uploading
        ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
        : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
      }
      {uploading ? 'Subiendo…' : 'Subir'}
    </label>
  )
}

export default function OCCompletadas() {
  const { data: ordenes = [], isLoading } = useOrdenesCliente()
  const completadas = ordenes.filter(o => o.recepcion_confirmada)
  const ocIds       = completadas.map(o => o.id)
  const { data: comprobantes = [] } = useComprobantesOC(ocIds)
  const comprobanteMap = Object.fromEntries(comprobantes.map(c => [c.oc_id, c]))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">OC Completadas</h1>
        <p className="text-sm text-gray-400 mt-0.5">{isLoading ? 'Cargando…' : `${completadas.length} órdenes completadas`}</p>
      </div>

      {isLoading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>}

      {!isLoading && (
        <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
          {completadas.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No hay órdenes completadas todavía.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Número</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Fecha OC</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Factura</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Pago</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Recepción</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-32">Comprobante</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-14">PDF OC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completadas.map(oc => {
                  const recepciones = oc.recepciones ?? []
                  const hayProb     = recepciones.some(r => r.estado === 'prob' || r.estado === 'rech')
                  const pagoBadge   = PAGO_BADGE[oc.estado_pago ?? 'pendiente']
                  const factura     = Array.isArray(oc.facturas) ? oc.facturas[0] : oc.facturas
                  const comprobante = comprobanteMap[oc.id]

                  return (
                    <tr key={oc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#004a99]">{oc.numero}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(oc.creado_en).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{oc.numero_factura ?? <span className="text-gray-300">—</span>}</span>
                          {factura?.pdf_url && (
                            <a href={factura.pdf_url} target="_blank" rel="noopener noreferrer"
                              className="text-[#004a99] hover:underline font-medium flex items-center gap-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                              </svg>
                              PDF
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtUSD(oc.cotizaciones?.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pagoBadge.cls}`}>
                          {pagoBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hayProb ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'}`}>
                          {hayProb ? 'Con obs.' : 'Conforme'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {comprobante
                          ? <a href={comprobante.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-green-700 font-medium hover:underline flex items-center justify-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              Ver
                            </a>
                          : <BtnSubirComprobante ocId={oc.id}/>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => import('../../utils/pdfGenerator').then(m => m.generateOCPDF(oc))}
                          title="Descargar PDF de OC"
                          className="text-gray-300 hover:text-[#004a99] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
