import { useState } from 'react'
import { useOrdenesVendedor, useFacturasPdfOC } from '../../hooks/useOrdenes'
import OCCard, { LABELS } from '../../components/oc/OCCard'

const FILTROS_OC = ['todas', 'recibida', 'en-preparacion', 'listo-entrega', 'entregada']

export default function OrdenesCopra() {
  const { data: ordenes = [], isLoading, error } = useOrdenesVendedor()
  const [filtro, setFiltro] = useState('todas')

  const filtradas     = filtro === 'todas' ? ordenes : ordenes.filter(o => o.estado === filtro)
  const nuevas        = ordenes.filter(o => o.estado === 'recibida')
  const ocIds         = ordenes.map(o => o.id)
  const { data: facturasPdf = [] } = useFacturasPdfOC(ocIds)
  const facturaPdfMap = Object.fromEntries(facturasPdf.map(f => [f.oc_id, f.pdf_url]))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Órdenes de Compra</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? 'Cargando…' : `${ordenes.length} órdenes`}
          {nuevas.length > 0 && <span className="ml-2 text-[#dc3545] font-medium">· {nuevas.length} nueva{nuevas.length !== 1 ? 's' : ''}</span>}
        </p>
      </div>

      <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit flex-wrap">
        {FILTROS_OC.map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${filtro === f ? 'bg-[#004a99] text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            {f === 'todas' ? 'Todas' : LABELS[f] ?? f}
          </button>
        ))}
      </div>

      {error && <p className="text-[#dc3545] text-sm mb-4">Error: {error.message}</p>}
      {isLoading && <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>}
      {!isLoading && !error && (
        filtradas.length === 0
          ? <div className="text-center py-12 text-gray-400 text-sm">No hay órdenes en este estado.</div>
          : <div className="space-y-3">
              {filtradas.map(oc => (
                <OCCard key={oc.id} oc={oc} isNew={oc.estado === 'recibida'} facturaPdfUrl={facturaPdfMap[oc.id]} />
              ))}
            </div>
      )}
    </div>
  )
}
