import { useState } from 'react'
import { useCronogramaDeposito, useConfirmarCarga, useReportarProblema } from '../../hooks/useDeposito'

const TIPO_LABEL = {
  'sin-productos':  { label: 'Productos no disponibles', color: 'amber' },
  'sin-transporte': { label: 'Transporte no disponible',  color: 'red'   },
}

function ModalProblema({ envio, tipo, onClose, onConfirm }) {
  const [notas, setNotas] = useState('')
  const cfg = TIPO_LABEL[tipo]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{cfg.label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            OC <strong className="text-gray-900">#{envio.ordenes_compra?.numero}</strong> — {envio.ordenes_compra?.cotizaciones?.clientes?.razon_social}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
              placeholder="Describí el problema..."
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(notas)}
            className={`text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors ${
              cfg.color === 'amber'
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CronogramaDeposito() {
  const { data: envios = [], isLoading } = useCronogramaDeposito()
  const confirmarCarga   = useConfirmarCarga()
  const reportarProblema = useReportarProblema()

  const [modal, setModal] = useState(null) // { envio, tipo }

  async function handleConfirmar(id) {
    if (!confirm('¿Confirmar carga al transporte? Esto marcará la OC como entregada.')) return
    await confirmarCarga.mutateAsync(id)
  }

  async function handleProblema(notas) {
    await reportarProblema.mutateAsync({ id: modal.envio.id, tipo: modal.tipo, notas })
    setModal(null)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Cronograma de entregas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Envíos programados pendientes de carga</p>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : envios.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            No hay envíos programados por el momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">OC</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Productos</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Transportista</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehículo</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {envios.map(envio => {
                  const oc    = envio.ordenes_compra
                  const cot   = oc?.cotizaciones
                  const items = cot?.cotizacion_items ?? []
                  const trans = envio.transportistas

                  return (
                    <tr key={envio.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">#{oc?.numero}</td>
                      <td className="px-4 py-3 text-gray-700">{cot?.clientes?.razon_social || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {items.slice(0, 3).map(it => (
                            <div key={it.id} className="text-xs text-gray-600">
                              {it.productos?.nombre} <span className="text-gray-400">×{it.cantidad}</span>
                            </div>
                          ))}
                          {items.length > 3 && (
                            <div className="text-xs text-gray-400">+{items.length - 3} más</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {envio.fecha_programada}
                        {envio.hora_estimada && (
                          <span className="ml-1.5 text-xs text-gray-400">{envio.hora_estimada.slice(0, 5)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {trans ? `${trans.nombre} ${trans.apellido}` : '—'}
                        {trans?.empresa && <span className="ml-1 text-xs text-gray-400">({trans.empresa})</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{trans?.vehiculo || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleConfirmar(envio.id)}
                            disabled={confirmarCarga.isPending}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                          >
                            Confirmar carga
                          </button>
                          <button
                            onClick={() => setModal({ envio, tipo: 'sin-productos' })}
                            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                          >
                            Sin productos
                          </button>
                          <button
                            onClick={() => setModal({ envio, tipo: 'sin-transporte' })}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                          >
                            Sin transporte
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ModalProblema
          envio={modal.envio}
          tipo={modal.tipo}
          onClose={() => setModal(null)}
          onConfirm={handleProblema}
        />
      )}
    </div>
  )
}
