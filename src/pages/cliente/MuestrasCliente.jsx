import { useState } from 'react'
import {
  useMuestrasCliente, useActualizarMuestra,
  useSolicitudesCliente, useSolicitarMuestra,
  useAceptarAlternativa, useProductosActivos,
} from '../../hooks/useMuestras'
import { fmtFecha } from '../../utils/calc'

const SOLIC_CFG = {
  pendiente:            { label: 'Pendiente',         cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400'  },
  aceptada:             { label: 'Aceptada',          cls: 'bg-green-100 text-green-700', dot: 'bg-green-500'  },
  alternativa_sugerida: { label: 'Alternativa suger.', cls: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-500'   },
  rechazada:            { label: 'Rechazada',         cls: 'bg-red-100 text-red-700',     dot: 'bg-red-400'    },
}

// ── Tarjeta muestra recibida ──────────────────────────────────────────────────
function CardMuestra({ muestra }) {
  const actualizar = useActualizarMuestra()
  const [expandida, setExpandida]  = useState(false)
  const [uso,       setUso]        = useState(muestra.uso       ?? '')
  const [resultado, setResultado]  = useState(muestra.resultado ?? '')
  const [guardando, setGuardando]  = useState(false)

  async function confirmarRecepcion() {
    await actualizar.mutateAsync({
      id:     muestra.id,
      campos: { estado: 'recibida', recibida_en: new Date().toISOString() },
    })
  }

  async function guardarEvaluacion() {
    if (!uso.trim()) return
    setGuardando(true)
    try {
      await actualizar.mutateAsync({
        id:     muestra.id,
        campos: { estado: 'evaluada', uso: uso.trim(), resultado: resultado.trim() || null, evaluada_en: new Date().toISOString() },
      })
      setExpandida(false)
    } finally { setGuardando(false) }
  }

  const estadoBadge = {
    enviada:  { label: 'Por recibir',    cls: 'bg-blue-100 text-blue-700'    },
    recibida: { label: 'Recibida',       cls: 'bg-yellow-100 text-yellow-800' },
    evaluada: { label: 'Evaluada',       cls: 'bg-green-100 text-green-700'  },
  }[muestra.estado] ?? { label: muestra.estado, cls: 'bg-gray-100 text-gray-500' }

  return (
    <div className="bg-white rounded-[10px] shadow-card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{muestra.productos?.nombre}</p>
          <p className="text-xs text-gray-400">
            {muestra.cantidad} unidad{muestra.cantidad !== 1 ? 'es' : ''}
            {muestra.lote && <> · Lote <span className="font-mono">{muestra.lote}</span></>}
            {muestra.vendedores && <> · {(Array.isArray(muestra.vendedores) ? muestra.vendedores[0] : muestra.vendedores)?.perfiles?.nombre}</>}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Enviado: {fmtFecha(muestra.creado_en)}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoBadge.cls}`}>{estadoBadge.label}</span>
      </div>

      {muestra.notas && (
        <p className="text-xs text-gray-500 italic mb-2 bg-gray-50 rounded px-2 py-1">"{muestra.notas}"</p>
      )}

      {/* Acción: confirmar recepción */}
      {muestra.estado === 'enviada' && (
        <button onClick={confirmarRecepcion} disabled={actualizar.isPending}
          className="mt-1 w-full bg-[#004a99] hover:bg-[#003d80] text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {actualizar.isPending
            ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
          }
          Confirmar recepción
        </button>
      )}

      {/* Acción: registrar evaluación */}
      {muestra.estado === 'recibida' && (
        <>
          <button onClick={() => setExpandida(e => !e)}
            className="mt-1 w-full border border-[#004a99] text-[#004a99] text-xs font-medium py-2 rounded-lg hover:bg-blue-50 transition-colors">
            {expandida ? 'Cancelar' : 'Registrar evaluación'}
          </button>
          {expandida && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">¿Para qué la usaste? *</label>
                <textarea rows={2} value={uso} onChange={e => setUso(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
                  placeholder="Describí la aplicación o proceso donde usaste la muestra…"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Resultado (opcional)</label>
                <textarea rows={2} value={resultado} onChange={e => setResultado(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
                  placeholder="Resultado obtenido, observaciones, si cumplió las expectativas…"/>
              </div>
              <button onClick={guardarEvaluacion} disabled={!uso.trim() || guardando}
                className="w-full bg-[#28a745] hover:bg-green-700 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {guardando && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Guardar evaluación
              </button>
            </div>
          )}
        </>
      )}

      {/* Evaluación ya registrada */}
      {muestra.estado === 'evaluada' && (
        <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 space-y-1">
          <p className="text-xs text-gray-700"><span className="font-semibold">Uso registrado:</span> {muestra.uso}</p>
          {muestra.resultado && <p className="text-xs text-gray-700"><span className="font-semibold">Resultado:</span> {muestra.resultado}</p>}
          <p className="text-[10px] text-gray-400">Evaluada: {fmtFecha(muestra.evaluada_en)}</p>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta solicitud ─────────────────────────────────────────────────────────
function CardSolicitud({ solicitud }) {
  const aceptarAlt = useAceptarAlternativa()
  const cfg = SOLIC_CFG[solicitud.estado] ?? { label: solicitud.estado, cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300' }
  const [err, setErr] = useState('')

  async function handleAceptarAlternativa() {
    setErr('')
    try { await aceptarAlt.mutateAsync({ solicitud }) }
    catch (e) { setErr(e.message) }
  }

  return (
    <div className="bg-white rounded-[10px] shadow-card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          {solicitud.productos
            ? <p className="text-sm font-semibold text-gray-900">{solicitud.productos.nombre}</p>
            : <p className="text-sm font-semibold text-gray-400 italic">Sin producto específico</p>
          }
          <p className="text-xs text-gray-400">{fmtFecha(solicitud.creado_en)}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
      </div>

      <p className="text-xs text-gray-600 italic mb-2">"{solicitud.uso_previsto}"</p>

      {solicitud.respuesta_vendedor && (
        <div className={`rounded-lg px-3 py-2 text-xs mb-2 ${solicitud.estado === 'rechazada' ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
          <span className="font-semibold">Respuesta del vendedor:</span> {solicitud.respuesta_vendedor}
        </div>
      )}

      {solicitud.estado === 'alternativa_sugerida' && solicitud.producto_alternativo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 space-y-2">
          <p className="text-xs text-blue-800">
            <span className="font-semibold">Producto alternativo sugerido:</span> {solicitud.producto_alternativo.nombre}
          </p>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button
            onClick={handleAceptarAlternativa}
            disabled={aceptarAlt.isPending}
            className="w-full bg-[#004a99] text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
            {aceptarAlt.isPending
              ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> Procesando…</>
              : <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  Aceptar alternativa y solicitar muestra
                </>
            }
          </button>
        </div>
      )}
    </div>
  )
}

// ── Formulario solicitud ──────────────────────────────────────────────────────
function FormSolicitar({ onClose }) {
  const { data: productos = [] } = useProductosActivos()
  const solicitar = useSolicitarMuestra()
  const [productoId,   setProductoId]  = useState('')
  const [usoPrevisto,  setUsoPrevisto] = useState('')
  const [err,          setErr]         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!usoPrevisto.trim()) { setErr('Describí el uso previsto.'); return }
    setErr('')
    try {
      await solicitar.mutateAsync({ productoId: productoId || null, usoPrevisto: usoPrevisto.trim() })
      onClose()
    } catch (ex) { setErr(ex.message) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Producto de interés (opcional)</label>
        <select value={productoId} onChange={e => setProductoId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]">
          <option value="">No sé / Quiero una recomendación</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.codigo ? `(${p.codigo})` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">¿Para qué la usarías? *</label>
        <textarea rows={3} value={usoPrevisto} onChange={e => setUsoPrevisto(e.target.value)} required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
          placeholder="Describí la aplicación o proceso en el que querés usarla, el tipo de producto que buscás…"/>
      </div>
      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={solicitar.isPending}
          className="flex-1 bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {solicitar.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
          Enviar solicitud
        </button>
      </div>
    </form>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MuestrasCliente() {
  const [tab,      setTab]      = useState('recibidas')
  const [showForm, setShowForm] = useState(false)

  const { data: muestras    = [], isLoading: loadM, error: errM } = useMuestrasCliente()
  const { data: solicitudes = [], isLoading: loadS, error: errS } = useSolicitudesCliente()

  const pendientesConfirmar = muestras.filter(m => m.estado === 'enviada').length
  const solicPendientes     = solicitudes.filter(s => s.estado === 'pendiente').length

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Muestras</h1>
          <p className="text-sm text-gray-400 mt-0.5">Muestras recibidas y solicitudes</p>
        </div>
        {tab === 'solicitar' && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Solicitar muestra
          </button>
        )}
      </div>

      {(errM || errS) && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 font-mono">
          {errM?.message || errS?.message}
        </div>
      )}

      {/* Alertas */}
      {pendientesConfirmar > 0 && tab === 'recibidas' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
          <p className="text-sm text-blue-800 font-medium">
            {pendientesConfirmar} muestra{pendientesConfirmar !== 1 ? 's' : ''} pendiente{pendientesConfirmar !== 1 ? 's' : ''} de confirmación de recepción
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          ['recibidas', 'Muestras recibidas', pendientesConfirmar > 0 ? pendientesConfirmar : null],
          ['solicitar', 'Mis solicitudes',    solicPendientes > 0     ? solicPendientes     : null],
        ].map(([v, l, count]) => (
          <button key={v} onClick={() => { setTab(v); setShowForm(false) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === v ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
            {count != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#004a99] text-white">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB RECIBIDAS ── */}
      {tab === 'recibidas' && (
        loadM
          ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : muestras.length === 0
            ? <div className="bg-white rounded-[10px] shadow-card p-12 text-center text-sm text-gray-400">
                Todavía no recibiste muestras.
                <br/>
                <button onClick={() => setTab('solicitar')} className="mt-2 text-[#004a99] font-medium hover:underline">Solicitar una muestra →</button>
              </div>
            : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {muestras.map(m => <CardMuestra key={m.id} muestra={m}/>)}
              </div>
      )}

      {/* ── TAB SOLICITUDES ── */}
      {tab === 'solicitar' && (
        <>
          {showForm && (
            <div className="bg-white rounded-[10px] shadow-card p-5 mb-5 max-w-lg">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Solicitar muestra</h2>
              <FormSolicitar onClose={() => setShowForm(false)}/>
            </div>
          )}

          {!showForm && solicitudes.length === 0 && !loadS && (
            <div className="bg-white rounded-[10px] shadow-card p-12 text-center text-sm text-gray-400">
              No realizaste solicitudes de muestras aún.
              <br/>
              <button onClick={() => setShowForm(true)} className="mt-2 text-[#004a99] font-medium hover:underline">Solicitar primera muestra →</button>
            </div>
          )}

          {!loadS && solicitudes.length > 0 && (
            <div className="space-y-3">
              {solicitudes.map(s => <CardSolicitud key={s.id} solicitud={s}/>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
