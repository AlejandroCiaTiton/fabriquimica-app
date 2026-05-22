import { useState, useMemo } from 'react'
import { useOrdenesAsistente, useFacturasPdfOC } from '../../hooks/useOrdenes'
import OCCard, { LABELS } from '../../components/oc/OCCard'

const FILTROS = ['todas', 'recibida', 'en-preparacion', 'listo-entrega', 'entregada']

function fmtUSD(v) {
  return 'USD ' + Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function OrdenesAsistente() {
  const { data: ordenes = [], isLoading, error } = useOrdenesAsistente()

  const [busqueda,       setBusqueda]       = useState('')
  const [filtroEstado,   setFiltroEstado]   = useState('todas')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [filtroPago,     setFiltroPago]     = useState('todos')

  const ocIds = ordenes.map(o => o.id)
  const { data: facturasPdf = [] } = useFacturasPdfOC(ocIds)
  const facturaPdfMap = Object.fromEntries(facturasPdf.map(f => [f.oc_id, f.pdf_url]))

  const vendedores = useMemo(() => {
    const names = ordenes.map(o => o.cotizaciones?.vendedores?.perfiles?.nombre).filter(Boolean)
    return [...new Set(names)].sort()
  }, [ordenes])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ordenes.filter(o => {
      if (filtroEstado   !== 'todas' && o.estado !== filtroEstado) return false
      if (filtroPago     !== 'todos' && (o.estado_pago ?? 'pendiente') !== filtroPago) return false
      const nombreVend = o.cotizaciones?.vendedores?.perfiles?.nombre ?? ''
      if (filtroVendedor !== 'todos' && nombreVend !== filtroVendedor) return false
      if (q) {
        const cliente = o.cotizaciones?.clientes?.razon_social?.toLowerCase() ?? ''
        const numero  = o.numero?.toLowerCase() ?? ''
        if (!cliente.includes(q) && !numero.includes(q)) return false
      }
      return true
    })
  }, [ordenes, busqueda, filtroEstado, filtroVendedor, filtroPago])

  const nuevas = ordenes.filter(o => o.estado === 'recibida').length
  const porEstado = FILTROS.slice(1).reduce((acc, e) => ({ ...acc, [e]: ordenes.filter(o => o.estado === e).length }), {})

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Órdenes de Compra</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? 'Cargando…' : `${ordenes.length} órdenes · Todos los clientes`}
            {nuevas > 0 && <span className="ml-2 text-[#dc3545] font-medium">· {nuevas} nueva{nuevas !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        {!isLoading && ordenes.length > 0 && (
          <p className="text-sm font-semibold text-[#1b4332]">
            {fmtUSD(ordenes.reduce((s, o) => s + parseFloat(o.cotizaciones?.total ?? 0), 0))}
          </p>
        )}
      </div>

      {/* Filtro por estado (tabs) */}
      <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit flex-wrap">
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltroEstado(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filtroEstado === f ? 'bg-[#1b4332] text-white' : 'text-gray-500 hover:text-gray-800'
            }`}>
            {f === 'todas' ? `Todas (${ordenes.length})` : `${LABELS[f]} (${porEstado[f] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Filtros adicionales */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente u OC#…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b4332] bg-white"/>
        </div>

        {vendedores.length > 0 && (
          <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b4332]">
            <option value="todos">Todos los vendedores</option>
            {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}

        <select value={filtroPago} onChange={e => setFiltroPago(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b4332]">
          <option value="todos">Todos los pagos</option>
          <option value="pendiente">Pago pendiente</option>
          <option value="parcial">Pago parcial</option>
          <option value="pagado">Pagado</option>
        </select>

        {(busqueda || filtroVendedor !== 'todos' || filtroPago !== 'todos') && (
          <button onClick={() => { setBusqueda(''); setFiltroVendedor('todos'); setFiltroPago('todos') }}
            className="text-xs text-gray-400 hover:text-gray-700 underline">
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          Error al cargar: {error.message}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
        </div>
      )}

      {!isLoading && !error && (
        filtradas.length === 0
          ? <div className="text-center py-12 text-gray-400 text-sm">
              {ordenes.length === 0 ? 'No hay órdenes registradas.' : 'Ninguna orden coincide con los filtros.'}
            </div>
          : <div className="space-y-3 max-w-2xl">
              {filtradas.map(oc => (
                <OCCard key={oc.id} oc={oc} isNew={oc.estado === 'recibida'}
                  facturaPdfUrl={facturaPdfMap[oc.id]} showVendedor />
              ))}
            </div>
      )}

      {!isLoading && filtradas.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 max-w-2xl text-right">
          {filtradas.length} orden{filtradas.length !== 1 ? 'es' : ''} · {fmtUSD(filtradas.reduce((s, o) => s + parseFloat(o.cotizaciones?.total ?? 0), 0))}
        </p>
      )}
    </div>
  )
}
