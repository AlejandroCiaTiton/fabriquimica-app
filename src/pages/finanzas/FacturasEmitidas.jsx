import { useState, useMemo, Fragment } from 'react'
import { useFacturas } from '../../hooks/useFinanzas'
import { AFIP_ENABLED } from '../../lib/afip'
import { fmtFecha } from '../../utils/calc'

function fmtMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0)
}

const TIPO_BADGE = {
  A: 'bg-purple-100 text-purple-700',
  B: 'bg-blue-100  text-blue-700',
  C: 'bg-teal-100  text-teal-700',
}

const ESTADO_BADGE = {
  emitida:  'bg-green-100 text-green-700',
  anulada:  'bg-red-100   text-red-600',
}

export default function FacturasEmitidas() {
  const { data: facturas = [], isLoading } = useFacturas()
  const [busqueda,    setBusqueda]    = useState('')
  const [expandida,   setExpandida]   = useState(null)

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return facturas
    return facturas.filter(f =>
      f.numero?.toLowerCase().includes(q) ||
      f.cae?.toLowerCase().includes(q) ||
      f.ordenes_compra?.cotizaciones?.clientes?.razon_social?.toLowerCase().includes(q)
    )
  }, [facturas, busqueda])

  const totales = useMemo(() => {
    const emitidas = facturas.filter(f => f.estado === 'emitida')
    return {
      cantidad: emitidas.length,
      monto:    emitidas.reduce((s, f) => s + (parseFloat(f.monto_total) || 0), 0),
    }
  }, [facturas])

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Facturas emitidas</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {totales.cantidad} factura{totales.cantidad !== 1 ? 's' : ''} · Total {fmtMoneda(totales.monto)}
          {!AFIP_ENABLED && <span className="ml-2 text-yellow-600 text-xs">(modo simulación)</span>}
        </p>
      </div>

      <div className="relative max-w-sm mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por número, CAE o cliente…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : filtradas.length === 0
          ? <div className="p-12 text-center text-sm text-gray-400">Sin facturas emitidas</div>
          : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-8">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Número</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Orden</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Emisión</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">CAE</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Vto. CAE</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(f => {
                const cliente = f.ordenes_compra?.cotizaciones?.clientes?.razon_social ?? '—'
                const ocNum   = f.ordenes_compra?.numero
                const items   = f.ordenes_compra?.cotizaciones?.cotizacion_items ?? []
                const abierta = expandida === f.id
                return (
                  <Fragment key={f.id}>
                    <tr
                      className={`cursor-pointer transition-colors ${abierta ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setExpandida(abierta ? null : f.id)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${abierta ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${TIPO_BADGE[f.tipo_comprobante] ?? 'bg-gray-100 text-gray-600'}`}>
                            {f.tipo_comprobante}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800">{f.numero}</td>
                      <td className="px-4 py-2.5 text-gray-900 max-w-[180px] truncate">{cliente}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                        {ocNum ? `#${ocNum}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmtMoneda(f.monto_total)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmtFecha(f.fecha_emision)}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500 truncate max-w-[140px]">
                        {f.cae ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{fmtFecha(f.cae_vencimiento)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ESTADO_BADGE[f.estado] ?? 'bg-gray-100 text-gray-500'}`}>
                          {f.estado === 'emitida' ? 'Emitida' : 'Anulada'}
                        </span>
                      </td>
                    </tr>

                    {abierta && items.length > 0 && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={9} className="px-6 pb-3 pt-0">
                          <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-white border-b border-gray-100">
                                <th className="text-left px-3 py-2 font-medium text-gray-500">Producto</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-500 w-20">Código</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-500 w-20">Cantidad</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-500 w-36">Lote</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 bg-white">
                              {items.map(it => (
                                <tr key={it.id}>
                                  <td className="px-3 py-2 font-medium text-gray-800">{it.productos?.nombre ?? '—'}</td>
                                  <td className="px-3 py-2 font-mono text-gray-400">{it.productos?.codigo || '—'}</td>
                                  <td className="px-3 py-2 text-right text-gray-600">{it.cantidad}</td>
                                  <td className="px-3 py-2 font-mono text-gray-600">
                                    {it.lote_aplicado
                                      ? it.lote_aplicado
                                      : <span className="text-gray-300 italic not-italic">—</span>
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
