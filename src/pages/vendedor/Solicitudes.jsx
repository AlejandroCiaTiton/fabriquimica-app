import { useNavigate } from 'react-router-dom'
import { useSolicitudesVendedor } from '../../hooks/useSolicitudes'

const ESTADOS = {
  pendiente: { label: 'Nueva',    bg: 'bg-yellow-100', text: 'text-yellow-800' },
  cotizada:  { label: 'Cotizada', bg: 'bg-green-100',  text: 'text-green-800'  },
  cancelada: { label: 'Cancelada',bg: 'bg-gray-100',   text: 'text-gray-500'   },
}

function Badge({ estado }) {
  const e = ESTADOS[estado] ?? { label: estado, bg: 'bg-gray-100', text: 'text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.bg} ${e.text}`}>
      {e.label}
    </span>
  )
}

function SolicitudCard({ sol, onCotizar }) {
  const fechaHora = new Date(sol.creado_en).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const items = sol.solicitud_items ?? []

  return (
    <div className={`bg-white rounded-[10px] shadow-card p-4 ${sol.estado === 'pendiente' ? 'border-l-4 border-[#ffc107]' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-[#1b4332]">{sol.codigo}</span>
            <Badge estado={sol.estado} />
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">
            {sol.clientes?.razon_social ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{fechaHora}</p>
        </div>
        {sol.estado === 'pendiente' && (
          <button
            onClick={() => onCotizar(sol.id)}
            className="flex items-center gap-1.5 bg-[#1b4332] hover:bg-[#152e24] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Preparar cotización
          </button>
        )}
      </div>

      {/* Items */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-3 py-2 font-medium text-gray-400">Producto</th>
              <th className="text-right px-3 py-2 font-medium text-gray-400 w-20">Kg/Lt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((it, i) => (
              <tr key={it.id ?? i}>
                <td className="px-3 py-2 text-gray-700">
                  <span className="font-medium">{it.productos?.nombre}</span>
                  {it.productos?.presentacion && <span className="text-gray-400 ml-1">· {it.productos.presentacion}</span>}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 font-medium">{it.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sol.observaciones && (
        <p className="text-xs text-gray-500 italic mt-2 px-1">
          <span className="font-medium not-italic text-gray-600">Obs:</span> {sol.observaciones}
        </p>
      )}
    </div>
  )
}

export default function Solicitudes() {
  const { data: solicitudes = [], isLoading, error } = useSolicitudesVendedor()
  const navigate = useNavigate()

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const resto      = solicitudes.filter(s => s.estado !== 'pendiente')

  function handleCotizar(solicitudId) {
    navigate(`/vendedor/nueva-cotizacion?solicitud=${solicitudId}`)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Solicitudes</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? 'Cargando…' : (
            pendientes.length > 0
              ? <><span className="text-[#ffc107] font-medium">{pendientes.length} nueva{pendientes.length !== 1 ? 's' : ''}</span> · {solicitudes.length} en total</>
              : `${solicitudes.length} solicitudes`
          )}
        </p>
      </div>

      {error && (
        <p className="bg-red-50 text-[#dc3545] text-sm rounded-lg px-4 py-3 mb-4">
          Error: {error.message}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Pendientes primero */}
          {pendientes.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Nuevas — requieren cotización
              </h2>
              <div className="space-y-3">
                {pendientes.map(sol => (
                  <SolicitudCard key={sol.id} sol={sol} onCotizar={handleCotizar} />
                ))}
              </div>
            </div>
          )}

          {/* Resto */}
          {resto.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Historial
              </h2>
              <div className="space-y-3">
                {resto.map(sol => (
                  <SolicitudCard key={sol.id} sol={sol} onCotizar={handleCotizar} />
                ))}
              </div>
            </div>
          )}

          {solicitudes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">No hay solicitudes todavía.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
