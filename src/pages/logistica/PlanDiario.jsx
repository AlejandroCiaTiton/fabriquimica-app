import { useState } from 'react'
import { useOrdenesLogistica, getUrgencia, checkStock, URGENCIA_CONFIG } from '../../hooks/useLogistica'
import { useActualizarDatosOC, useAvanzarEstadoOC } from '../../hooks/useOrdenes'
import { useAuth } from '../../context/AuthContext'

function semanaDesd(base) {
  const lunes = new Date(base)
  lunes.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  lunes.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

function fmtFecha(d) {
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

function BadgeStock({ ok }) {
  if (ok === null) return null
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {ok ? '✓ Stock' : '✗ Sin stock'}
    </span>
  )
}

function OCCard({ oc, onFechaChange }) {
  const avanzar = useAvanzarEstadoOC()
  const actualizar = useActualizarDatosOC()

  const cli    = oc.cotizaciones?.clientes
  const items  = oc.cotizaciones?.cotizacion_items ?? []
  const urg    = getUrgencia(oc.fecha_estimada_entrega)
  const stock  = checkStock(items)
  const cfg    = URGENCIA_CONFIG[urg]
  const [fecha, setFecha] = useState(oc.fecha_estimada_entrega ?? '')

  async function guardarFecha(val) {
    setFecha(val)
    await actualizar.mutateAsync({ ocId: oc.id, fechaEstimadaEntrega: val, numeroFactura: oc.numero_factura })
    onFechaChange?.()
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 p-3`} style={{ borderLeftColor: cfg.color }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-mono text-xs font-bold text-[#1b4332]">{oc.numero}</p>
          <p className="text-sm font-semibold text-gray-900">{cli?.razon_social}</p>
          {cli?.zonas_entrega && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: cli.zonas_entrega.color + '22', color: cli.zonas_entrega.color }}>
              {cli.zonas_entrega.nombre}
            </span>
          )}
        </div>
        <BadgeStock ok={stock}/>
      </div>

      <div className="text-xs text-gray-500 space-y-0.5 mb-2">
        {items.slice(0, 3).map(it => (
          <span key={it.id} className="inline-block bg-gray-50 rounded px-1.5 py-0.5 mr-1 mb-0.5">
            {it.productos?.nombre} · {it.cantidad} kg
          </span>
        ))}
        {items.length > 3 && <span className="text-gray-400">+{items.length - 3} más</span>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Fecha entrega</label>
          <input type="date" value={fecha} onChange={e => guardarFecha(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1b4332]"
          />
        </div>

        {oc.estado === 'en-preparacion' && (
          <button
            onClick={() => avanzar.mutate({ ocId: oc.id, estadoActual: oc.estado })}
            disabled={avanzar.isPending}
            className="mt-4 text-xs font-semibold bg-[#1b4332] text-white px-3 py-1.5 rounded-lg hover:bg-[#152e24] transition-colors disabled:opacity-50"
          >
            Listo p/entrega →
          </button>
        )}
        {oc.estado === 'listo-entrega' && (
          <button
            onClick={() => avanzar.mutate({ ocId: oc.id, estadoActual: oc.estado })}
            disabled={avanzar.isPending}
            className="mt-4 text-xs font-semibold bg-[#28a745] text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Marcar entregada ✓
          </button>
        )}
      </div>
    </div>
  )
}

export default function PlanDiario() {
  const { data: ordenes = [], isLoading, refetch } = useOrdenesLogistica()
  const [baseDate, setBaseDate] = useState(() => new Date())
  const dias = semanaDesd(baseDate)

  function semanaAnterior() {
    const d = new Date(baseDate)
    d.setDate(d.getDate() - 7)
    setBaseDate(d)
  }
  function semanaSiguiente() {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + 7)
    setBaseDate(d)
  }

  const porFecha = {}
  const sinFecha = []
  ordenes.forEach(oc => {
    if (oc.fecha_estimada_entrega) {
      const k = oc.fecha_estimada_entrega
      if (!porFecha[k]) porFecha[k] = []
      porFecha[k].push(oc)
    } else {
      sinFecha.push(oc)
    }
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plan diario</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? 'Cargando…' : `${ordenes.length} órdenes pendientes de entrega`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={semanaAnterior}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
            {fmtFecha(dias[0])} – {fmtFecha(dias[6])}
          </span>
          <button onClick={semanaSiguiente}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Sin fecha asignada */}
          {sinFecha.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/>
                Sin fecha asignada
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{sinFecha.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sinFecha.map(oc => <OCCard key={oc.id} oc={oc} onFechaChange={refetch}/>)}
              </div>
            </div>
          )}

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-3">
            {dias.map(dia => {
              const key = isoDate(dia)
              const ocs = porFecha[key] ?? []
              const esHoy = key === isoDate(new Date())
              return (
                <div key={key} className={`min-h-[120px] ${esHoy ? 'ring-2 ring-[#1b4332] rounded-lg' : ''}`}>
                  <div className={`px-2 py-1.5 rounded-t-lg text-xs font-semibold ${
                    esHoy ? 'bg-[#1b4332] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {fmtFecha(dia)}
                    {ocs.length > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                        esHoy ? 'bg-white text-[#1b4332]' : 'bg-[#1b4332] text-white'
                      }`}>{ocs.length}</span>
                    )}
                  </div>
                  <div className="p-1.5 space-y-1.5">
                    {ocs.map(oc => <OCCard key={oc.id} oc={oc} onFechaChange={refetch}/>)}
                    {ocs.length === 0 && (
                      <p className="text-[10px] text-gray-300 text-center pt-3">—</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
