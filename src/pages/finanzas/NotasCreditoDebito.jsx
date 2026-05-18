import { useState, useMemo } from 'react'
import { useNotasCredDebito, useCrearNota, useEmitirNota, useAnularNota } from '../../hooks/useFinanzas'

function fmtFecha(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-AR')
}

function fmtUSD(n) {
  return 'USD ' + Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TIPO_CFG = {
  credito: { label: 'NC', fullLabel: 'Nota de Crédito', cls: 'bg-green-100 text-green-700' },
  debito:  { label: 'ND', fullLabel: 'Nota de Débito',  cls: 'bg-orange-100 text-orange-700' },
}

const ESTADO_CFG = {
  pendiente: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
  emitida:   { label: 'Emitida',   cls: 'bg-blue-100 text-blue-700'    },
  anulada:   { label: 'Anulada',   cls: 'bg-red-100 text-red-500'      },
}

const ORIGEN_CFG = {
  finanzas: { label: 'Finanzas', cls: 'bg-gray-100 text-gray-500' },
  reclamo:  { label: 'Reclamo',  cls: 'bg-purple-100 text-purple-700' },
}

// ── Modal para crear nueva NC/ND ──────────────────────────────────────────────

function ModalNuevaNota({ tipo, onClose }) {
  const crear = useCrearNota()
  const [monto,  setMonto]  = useState('')
  const [motivo, setMotivo] = useState('')
  const [ok,     setOk]     = useState(null)
  const cfg = TIPO_CFG[tipo]

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const result = await crear.mutateAsync({ tipo, monto, motivo })
      setOk(result.numero)
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  if (ok) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-[12px] shadow-xl p-8 w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">{cfg.fullLabel} emitida</h3>
        <p className="text-sm text-gray-500 mb-1">Número:</p>
        <p className="font-mono text-lg font-bold text-[#004a99] mb-6">{ok}</p>
        <button onClick={onClose} className="px-5 py-2 bg-[#004a99] text-white rounded-lg text-sm hover:bg-[#003d80]">
          Cerrar
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-[12px] shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Nueva {cfg.fullLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Monto (USD)</label>
            <input
              type="number" min="0.01" step="0.01" required
              value={monto} onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Motivo</label>
            <textarea
              required rows={3}
              value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Describí el motivo de la nota…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={crear.isPending}
              className="flex-1 py-2.5 bg-[#004a99] text-white text-sm font-medium rounded-lg hover:bg-[#003d80] disabled:opacity-50 transition-colors"
            >
              {crear.isPending ? 'Emitiendo…' : `Emitir ${cfg.fullLabel}`}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Fila de nota ──────────────────────────────────────────────────────────────

function FilaNota({ nota }) {
  const emitir  = useEmitirNota()
  const anular  = useAnularNota()
  const [confirmAnular, setConfirmAnular] = useState(false)
  const [emitida, setEmitida] = useState(null)

  const tipoCfg   = TIPO_CFG[nota.tipo]   ?? { label: nota.tipo,   cls: 'bg-gray-100 text-gray-500' }
  const estadoCfg = ESTADO_CFG[nota.estado] ?? { label: nota.estado, cls: 'bg-gray-100 text-gray-500' }
  const origenCfg = ORIGEN_CFG[nota.origen] ?? { label: nota.origen, cls: 'bg-gray-100 text-gray-500' }
  const cliente   = nota.ordenes_compra?.cotizaciones?.clientes?.razon_social
  const ocNum     = nota.ordenes_compra?.numero

  async function handleEmitir() {
    const result = await emitir.mutateAsync({ notaId: nota.id, tipo: nota.tipo })
    setEmitida(result.numero)
  }

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-50">
      <td className="px-4 py-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tipoCfg.cls}`}>
          {tipoCfg.label}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-600">
        {emitida ?? nota.numero ?? <span className="text-gray-300 italic">pendiente</span>}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{cliente ?? <span className="text-gray-400">—</span>}</p>
        {ocNum && <p className="text-xs text-gray-400">OC #{ocNum}</p>}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{fmtUSD(nota.monto)}</td>
      <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate" title={nota.motivo}>{nota.motivo}</td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${origenCfg.cls}`}>
          {origenCfg.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${estadoCfg.cls}`}>
          {emitida ? 'Emitida' : estadoCfg.label}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{fmtFecha(nota.creado_en)}</td>
      <td className="px-4 py-3">
        {!emitida && nota.estado === 'pendiente' && (
          confirmAnular ? (
            <div className="flex items-center gap-1">
              <button onClick={() => anular.mutate(nota.id)}
                disabled={anular.isPending}
                className="text-[10px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                Confirmar
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setConfirmAnular(false)} className="text-[10px] text-gray-400 hover:text-gray-600">No</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleEmitir}
                disabled={emitir.isPending}
                className="text-[10px] font-semibold px-2 py-1 bg-[#004a99] text-white rounded hover:bg-[#003d80] disabled:opacity-50 transition-colors"
              >
                {emitir.isPending ? '…' : 'Emitir'}
              </button>
              <button onClick={() => setConfirmAnular(true)}
                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">
                Anular
              </button>
            </div>
          )
        )}
        {(emitida || nota.estado === 'emitida') && nota.estado !== 'anulada' && (
          confirmAnular ? (
            <div className="flex items-center gap-1">
              <button onClick={() => anular.mutate(nota.id)}
                disabled={anular.isPending}
                className="text-[10px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                Confirmar
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setConfirmAnular(false)} className="text-[10px] text-gray-400">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmAnular(true)}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">
              Anular
            </button>
          )
        )}
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function NotasCreditoDebito() {
  const { data: notas = [], isLoading } = useNotasCredDebito()
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [filtroTipo,   setFiltroTipo]   = useState('todas')
  const [modalTipo,    setModalTipo]    = useState(null)

  const pendientesReclamo = notas.filter(n => n.estado === 'pendiente' && n.origen === 'reclamo')

  const filtradas = useMemo(() => {
    let list = notas
    if (filtroEstado !== 'todas') list = list.filter(n => n.estado === filtroEstado)
    if (filtroTipo   !== 'todas') list = list.filter(n => n.tipo   === filtroTipo)
    return list
  }, [notas, filtroEstado, filtroTipo])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notas de crédito y débito</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Emisión y seguimiento de NC/ND
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalTipo('credito')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Nueva NC
          </button>
          <button
            onClick={() => setModalTipo('debito')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Nueva ND
          </button>
        </div>
      </div>

      {/* Solicitudes de reclamo pendientes */}
      {pendientesReclamo.length > 0 && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-[10px] p-4">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-purple-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
              {pendientesReclamo.length}
            </span>
            Solicitudes de vendedores por reclamos de calidad
          </p>
          <div className="space-y-2">
            {pendientesReclamo.map(nota => {
              const cliente = nota.ordenes_compra?.cotizaciones?.clientes?.razon_social
              const ocNum   = nota.ordenes_compra?.numero
              return (
                <div key={nota.id} className="bg-white border border-purple-100 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0 mt-0.5">NC</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{cliente ?? '—'}</p>
                        {ocNum && <span className="text-xs text-gray-400">OC #{ocNum}</span>}
                        {nota.solicitante?.nombre && (
                          <span className="text-xs text-purple-600">por {nota.solicitante.nombre}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 mt-0.5">{nota.motivo}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmtUSD(nota.monto)}</p>
                    <EmitirRapido nota={nota} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          {[['todas','Todo'],['pendiente','Pendientes'],['emitida','Emitidas'],['anulada','Anuladas']].map(([k,l]) => (
            <button key={k} onClick={() => setFiltroEstado(k)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                filtroEstado === k ? 'bg-[#004a99] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[['todas','NC + ND'],['credito','Solo NC'],['debito','Solo ND']].map(([k,l]) => (
            <button key={k} onClick={() => setFiltroTipo(k)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                filtroTipo === k ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : filtradas.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No hay notas para los filtros seleccionados</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-14">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-40">Número</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente / OC</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Monto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Motivo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Origen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Fecha</th>
                <th className="px-4 py-3 w-32"/>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(nota => <FilaNota key={nota.id} nota={nota}/>)}
            </tbody>
          </table>
        )}
      </div>

      {/* Modales */}
      {modalTipo && <ModalNuevaNota tipo={modalTipo} onClose={() => setModalTipo(null)}/>}
    </div>
  )
}

// Botón rápido de emitir para el panel de reclamos
function EmitirRapido({ nota }) {
  const emitir = useEmitirNota()
  const [emitida, setEmitida] = useState(null)

  async function handleEmitir() {
    const result = await emitir.mutateAsync({ notaId: nota.id, tipo: nota.tipo })
    setEmitida(result.numero)
  }

  if (emitida) return (
    <span className="font-mono text-xs text-green-700 bg-green-50 px-2 py-1 rounded flex-shrink-0">{emitida}</span>
  )

  return (
    <button
      onClick={handleEmitir}
      disabled={emitir.isPending}
      className="text-xs font-semibold px-3 py-1.5 bg-[#004a99] text-white rounded-lg hover:bg-[#003d80] disabled:opacity-50 flex-shrink-0 transition-colors"
    >
      {emitir.isPending ? '…' : 'Emitir NC'}
    </button>
  )
}
