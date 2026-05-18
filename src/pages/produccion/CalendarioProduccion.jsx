import { useState } from 'react'
import { useTrabajos, useConfirmarLote } from '../../hooks/useProduccion'

const ESTADO_CONFIG = {
  pendiente:  { color: '#f59e0b', bgClass: 'bg-yellow-100 text-yellow-800', label: 'Pendiente'  },
  'en-curso': { color: '#004a99', bgClass: 'bg-blue-100 text-blue-800',    label: 'En curso'   },
  completado: { color: '#16a34a', bgClass: 'bg-green-100 text-green-800',  label: 'Completado' },
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]'

function semanaDesd(base) {
  const lunes = new Date(base)
  lunes.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  lunes.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d
  })
}
function fmtDia(d)  { return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) }
function isoDate(d) { return d.toISOString().split('T')[0] }

// ── Modal confirmar lote ─────────────────────────────────────────────────────

function ModalConfirmarLote({ trabajo, onClose }) {
  const confirmar = useConfirmarLote()
  const [lote, setLote] = useState('')
  const [vto,  setVto]  = useState('')
  const [coa,  setCoa]  = useState(null)
  const [err,  setErr]  = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!lote.trim()) { setErr('El número de lote es obligatorio'); return }
    setErr('')
    try {
      await confirmar.mutateAsync({ trabajo, numeroLote: lote.trim(), fechaVencimiento: vto, coaFile: coa })
      onClose()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Confirmar lote</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">{trabajo.nombre} · {trabajo.cantidad_planificada} kg/lt</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° de lote <span className="text-red-500">*</span></label>
            <input className={INPUT} value={lote} onChange={e => setLote(e.target.value)}
              placeholder="Ej: L2025-042" autoFocus/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
            <input className={INPUT} type="date" value={vto} onChange={e => setVto(e.target.value)}/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">COA (opcional)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setCoa(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-[#004a99] hover:file:bg-blue-100 cursor-pointer"
            />
            {coa && <p className="text-xs text-gray-400 mt-1 truncate">{coa.name}</p>}
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          <button type="submit" disabled={confirmar.isPending}
            className="w-full bg-[#16a34a] hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {confirmar.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Confirmar lote producido
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Card de trabajo ──────────────────────────────────────────────────────────

function TrabajoCard({ trabajo, onConfirmar }) {
  const cfg = ESTADO_CONFIG[trabajo.estado] ?? ESTADO_CONFIG.pendiente

  return (
    <div className="bg-white rounded-lg shadow-sm border-l-4 p-2.5 text-xs" style={{ borderLeftColor: cfg.color }}>
      <p className="font-semibold text-gray-900 leading-tight mb-1 line-clamp-2">{trabajo.nombre}</p>
      {trabajo.cantidad_planificada > 0 && (
        <p className="text-gray-400 mb-1">{trabajo.cantidad_planificada} kg/lt</p>
      )}
      {trabajo.notas && <p className="text-gray-400 italic truncate mb-1">{trabajo.notas}</p>}

      {trabajo.estado === 'completado' ? (
        <div className="space-y-0.5 mt-1 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bgClass}`}>✓ {cfg.label}</span>
          </div>
          {trabajo.numero_lote && (
            <p className="text-gray-500 font-mono">Lote: {trabajo.numero_lote}</p>
          )}
          {trabajo.fecha_vencimiento && (
            <p className="text-gray-400">Vto: {new Date(trabajo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}</p>
          )}
          {trabajo.coa_url && (
            <a href={trabajo.coa_url} target="_blank" rel="noopener noreferrer"
              className="text-[#004a99] hover:underline flex items-center gap-0.5 font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              Ver COA
            </a>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-100">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bgClass}`}>{cfg.label}</span>
          <button
            onClick={() => onConfirmar(trabajo)}
            className="text-[10px] font-semibold text-[#16a34a] hover:underline">
            Confirmar lote →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function CalendarioProduccion() {
  const { data: trabajos = [], isLoading } = useTrabajos()
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [confirmando, setConfirmando] = useState(null)
  const dias = semanaDesd(baseDate)

  function prev() { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }
  function next() { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }

  const porFecha = {}
  const sinFecha = []
  trabajos.forEach(t => {
    if (t.fecha_inicio) {
      if (!porFecha[t.fecha_inicio]) porFecha[t.fecha_inicio] = []
      porFecha[t.fecha_inicio].push(t)
    } else {
      sinFecha.push(t)
    }
  })

  const pendientes  = trabajos.filter(t => t.estado === 'pendiente').length
  const enCurso     = trabajos.filter(t => t.estado === 'en-curso').length
  const completados = trabajos.filter(t => t.estado === 'completado').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calendario de producción</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? 'Cargando…' : `${pendientes} pendiente${pendientes !== 1 ? 's' : ''} · ${enCurso} en curso · ${completados} completado${completados !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
            {fmtDia(dias[0])} – {fmtDia(dias[6])}
          </span>
          <button onClick={next} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mb-4">
        {Object.entries(ESTADO_CONFIG).map(([k, cfg]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }}/>
            <span className="text-xs text-gray-500">{cfg.label}</span>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
        </div>
      )}

      {!isLoading && (
        <>
          {sinFecha.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/>
                Sin fecha programada
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{sinFecha.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sinFecha.map(t => <TrabajoCard key={t.id} trabajo={t} onConfirmar={setConfirmando}/>)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-7 gap-2">
            {dias.map(dia => {
              const key   = isoDate(dia)
              const ocs   = porFecha[key] ?? []
              const esHoy = key === isoDate(new Date())
              return (
                <div key={key} className={esHoy ? 'ring-2 ring-[#004a99] rounded-lg' : ''}>
                  <div className={`px-2 py-1.5 rounded-t-lg text-xs font-semibold flex items-center justify-between select-none ${
                    esHoy ? 'bg-[#004a99] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span>{fmtDia(dia)}</span>
                    {ocs.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${esHoy ? 'bg-white text-[#004a99]' : 'bg-[#004a99] text-white'}`}>
                        {ocs.length}
                      </span>
                    )}
                  </div>
                  <div className="p-1.5 space-y-1.5 min-h-[100px]">
                    {ocs.map(t => <TrabajoCard key={t.id} trabajo={t} onConfirmar={setConfirmando}/>)}
                    {ocs.length === 0 && <p className="text-[10px] text-gray-200 text-center pt-3">—</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {confirmando && (
        <ModalConfirmarLote trabajo={confirmando} onClose={() => setConfirmando(null)}/>
      )}
    </div>
  )
}
