import { useState } from 'react'
import { useOCsFinanzas, useEmitirFactura, useSubirFacturaPDF, sinFactura } from '../../hooks/useFinanzas'
import { TIPOS_COMPROBANTE, PUNTO_VENTA_DEFAULT, AFIP_ENABLED } from '../../lib/afip'
import { fmtFecha } from '../../utils/calc'

const ESTADO_LABEL = {
  'recibida':       { label: 'Recibida',       cls: 'bg-blue-100 text-blue-700' },
  'en-preparacion': { label: 'En preparación', cls: 'bg-yellow-100 text-yellow-700' },
  'listo-entrega':  { label: 'Listo',          cls: 'bg-green-100 text-green-700' },
  'entregada':      { label: 'Entregada',      cls: 'bg-gray-100 text-gray-600' },
}

function fmtMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0)
}

function ModalEmitir({ oc, onClose }) {
  const [tipo,            setTipo]          = useState('B')
  const [puntoVenta,      setPuntoVenta]    = useState(PUNTO_VENTA_DEFAULT)
  const [fechaVencimiento, setFechaVenc]   = useState('')
  const [resultado,       setResultado]    = useState(null)
  const [err,             setErr]          = useState('')
  const [pdfUploading,    setPdfUploading] = useState(false)
  const [pdfUrl,          setPdfUrl]       = useState(null)
  const [pdfErr,          setPdfErr]       = useState('')
  const emitir    = useEmitirFactura()
  const subirPDF  = useSubirFacturaPDF()

  const cliente = oc.cotizaciones?.clientes?.razon_social ?? '—'
  const total   = oc.cotizaciones?.total ?? 0
  const items   = oc.cotizaciones?.cotizacion_items ?? []

  async function handleEmitir() {
    setErr(''); setResultado(null)
    try {
      const res = await emitir.mutateAsync({
        oc, tipoComprobante: tipo, puntoVenta,
        fechaVencimiento: fechaVencimiento || undefined,
      })
      setResultado(res)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Emitir factura — Orden #{oc.numero}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Cliente</span>
              <span className="font-medium text-gray-900 truncate max-w-[220px]">{cliente}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-900">{fmtMoneda(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fecha</span>
              <span className="text-gray-600">{fmtFecha(oc.creado_en)}</span>
            </div>
          </div>

          {items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Productos</p>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Producto</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500 w-16">Cant.</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500 w-32">Lote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map(it => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 text-gray-800 font-medium">{it.productos?.nombre ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{it.cantidad}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {it.lote_aplicado
                            ? it.lote_aplicado
                            : <span className="text-gray-300 italic">Sin lote</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!resultado && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de comprobante</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS_COMPROBANTE.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setTipo(t.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                        tipo === t.value
                          ? 'border-[#004a99] bg-blue-50 text-[#004a99]'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <p className="font-semibold">{t.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70 leading-tight">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Punto de venta</label>
                <input type="number" min="1" max="9999"
                  value={puntoVenta}
                  onChange={e => setPuntoVenta(e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vencimiento del pago
                  <span className="ml-1 text-xs font-normal text-gray-400">(para análisis de deudores)</span>
                </label>
                <input type="date"
                  value={fechaVencimiento}
                  onChange={e => setFechaVenc(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
                />
              </div>

              {!AFIP_ENABLED && (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5 text-xs text-yellow-800">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  Modo simulación — AFIP no configurado. El CAE generado no es válido.
                </div>
              )}

              {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

              <button onClick={handleEmitir} disabled={emitir.isPending}
                className="w-full bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {emitir.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                {AFIP_ENABLED ? 'Emitir factura (AFIP)' : 'Emitir factura (simulación)'}
              </button>
            </>
          )}

          {resultado && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className="font-medium text-sm">Factura emitida correctamente</span>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Número</span>
                  <span className="font-mono font-medium text-gray-900">{resultado.factura?.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CAE</span>
                  <span className="font-mono text-xs text-gray-700">{resultado.afipResult?.cae}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vto. CAE</span>
                  <span className="text-gray-700">{fmtFecha(resultado.afipResult?.caeVencimiento)}</span>
                </div>
                {resultado.fechaVencimiento && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vto. pago</span>
                    <span className="font-medium text-gray-900">{fmtFecha(resultado.fechaVencimiento)}</span>
                  </div>
                )}
                {resultado.afipResult?.stub && (
                  <p className="text-[10px] text-yellow-600">⚠ CAE simulado — no válido ante AFIP</p>
                )}
              </div>

              {/* PDF upload */}
              <div className="border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Adjuntar PDF de factura (opcional)</p>
                {pdfErr && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-2">{pdfErr}</p>}
                {pdfUrl
                  ? <div className="flex items-center gap-2 text-green-700 text-xs">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      PDF adjunto correctamente
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[#004a99] hover:underline font-medium">Ver</a>
                    </div>
                  : <label className={`flex items-center gap-2 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg border w-fit transition-colors ${
                      pdfUploading ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-600 hover:border-[#004a99] hover:text-[#004a99]'
                    }`}>
                      <input type="file" accept=".pdf" className="hidden" disabled={pdfUploading}
                        onChange={async e => {
                          const file = e.target.files[0]
                          if (!file || !resultado.factura?.id) return
                          setPdfUploading(true); setPdfErr('')
                          try {
                            const url = await subirPDF.mutateAsync({ facturaId: resultado.factura.id, file })
                            setPdfUrl(url)
                          } catch (e) {
                            setPdfErr(e.message)
                          } finally { setPdfUploading(false); e.target.value = '' }
                        }}
                      />
                      {pdfUploading
                        ? <><div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> Subiendo…</>
                        : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                          </svg>
                          Subir PDF</>
                      }
                    </label>
                }
              </div>

              <button onClick={onClose}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TablaOCs({ ocs, onEmitir }) {
  if (ocs.length === 0) {
    return (
      <div className="bg-white rounded-[10px] shadow-card p-12 text-center text-sm text-gray-400">
        No hay órdenes en esta categoría
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Orden</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Fecha</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Estado</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Factura</th>
            <th className="px-4 py-3 w-28"/>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {ocs.map(oc => {
            const estadoCfg = ESTADO_LABEL[oc.estado] ?? { label: oc.estado, cls: 'bg-gray-100 text-gray-500' }
            const yaFacturada = !sinFactura(oc)
            return (
              <tr key={oc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">#{oc.numero}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{oc.cotizaciones?.clientes?.razon_social ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">{fmtMoneda(oc.cotizaciones?.total)}</td>
                <td className="px-4 py-3 text-gray-500">{fmtFecha(oc.creado_en)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoCfg.cls}`}>
                    {estadoCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {yaFacturada
                    ? <span className="font-mono text-xs text-gray-500">{oc.numero_factura}</span>
                    : <span className="text-xs text-gray-300">Sin factura</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  {yaFacturada
                    ? <span className="text-[10px] text-green-600 font-medium">✓ Emitida</span>
                    : (
                      <button onClick={() => onEmitir(oc)}
                        className="text-xs font-medium text-[#004a99] hover:text-[#003d80] hover:underline">
                        Emitir →
                      </button>
                    )
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function OrdenesFacturar() {
  const { data: todas = [], isLoading, error } = useOCsFinanzas()
  const [ocSelec, setOcSelec] = useState(null)
  const [tab, setTab]         = useState('pendientes')

  const pendientes = todas.filter(sinFactura)
  const facturadas = todas.filter(oc => !sinFactura(oc))

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Órdenes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Emitir facturas y seguimiento de órdenes de compra</p>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          ['pendientes', `Sin factura (${pendientes.length})`],
          ['facturadas', `Facturadas (${facturadas.length})`],
          ['todas',      `Todas (${todas.length})`],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === v ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-mono">
          Error: {error.message}
        </div>
      )}

      {isLoading
        ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
        : <TablaOCs
            ocs={tab === 'pendientes' ? pendientes : tab === 'facturadas' ? facturadas : todas}
            onEmitir={setOcSelec}
          />
      }

      {ocSelec && <ModalEmitir oc={ocSelec} onClose={() => setOcSelec(null)}/>}
    </div>
  )
}
