import { useState } from 'react'
import {
  useMuestrasVendedor, useEnviarMuestra,
  useSolicitudesVendedor, useResponderSolicitud,
  useClientesVendedor, useLotesProducto, useProductosActivos,
} from '../../hooks/useMuestras'

const ESTADO_CFG = {
  enviada:   { label: 'Enviada',   cls: 'bg-blue-100 text-blue-700'   },
  recibida:  { label: 'Recibida',  cls: 'bg-yellow-100 text-yellow-800' },
  evaluada:  { label: 'Evaluada',  cls: 'bg-green-100 text-green-700'  },
}

const SOLIC_CFG = {
  pendiente:             { label: 'Pendiente',         cls: 'bg-amber-100 text-amber-700'  },
  aceptada:              { label: 'Aceptada',          cls: 'bg-green-100 text-green-700'  },
  alternativa_sugerida:  { label: 'Alternativa suger.', cls: 'bg-blue-100 text-blue-700'   },
  rechazada:             { label: 'Rechazada',         cls: 'bg-red-100 text-red-700'      },
}

function fmtFecha(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-AR')
}

// ── Formulario nuevo envío ────────────────────────────────────────────────────
function FormNuevoEnvio({ onClose }) {
  const { data: clientes  = [] } = useClientesVendedor()
  const { data: productos = [] } = useProductosActivos()
  const [clienteId,   setClienteId]   = useState('')
  const [productoId,  setProductoId]  = useState('')
  const [cantidad,    setCantidad]    = useState('')
  const [lote,        setLote]        = useState('')
  const [notas,       setNotas]       = useState('')
  const [err,         setErr]         = useState('')

  const { data: lotes = [] } = useLotesProducto(productoId || null)
  const enviar = useEnviarMuestra()

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!clienteId || !productoId || !cantidad) { setErr('Completá cliente, producto y cantidad.'); return }
    try {
      await enviar.mutateAsync({ clienteId, productoId, cantidad: parseInt(cantidad), lote, notas })
      onClose()
    } catch (ex) { setErr(ex.message) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Cliente *</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]">
            <option value="">Seleccionar cliente…</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Producto *</label>
          <select value={productoId} onChange={e => { setProductoId(e.target.value); setLote('') }} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]">
            <option value="">Seleccionar producto…</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.codigo ? `(${p.codigo})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Cantidad (unidades) *</label>
          <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            placeholder="Ej: 3"/>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Lote</label>
          {lotes.length > 0 ? (
            <select value={lote} onChange={e => setLote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]">
              <option value="">Sin especificar</option>
              {lotes.map(l => <option key={l.id} value={l.numero_lote}>{l.numero_lote} · {fmtFecha(l.fecha_produccion)}</option>)}
            </select>
          ) : (
            <input type="text" value={lote} onChange={e => setLote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              placeholder="Nro. de lote"/>
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Notas (opcional)</label>
          <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
            placeholder="Instrucciones de uso, condiciones de almacenamiento…"/>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={enviar.isPending}
          className="flex-1 bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {enviar.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
          Registrar envío
        </button>
      </div>
    </form>
  )
}

// ── Panel de respuesta a solicitud ────────────────────────────────────────────
function PanelResponder({ solicitud, onClose }) {
  const { data: productos = [] } = useProductosActivos()
  const responder = useResponderSolicitud()
  const [accion,  setAccion]  = useState('aceptar')
  const [respuesta, setRespuesta] = useState('')
  const [prodAlt, setProdAlt] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (accion === 'alternativa' && !prodAlt) { setErr('Seleccioná el producto alternativo.'); return }
    if (accion !== 'rechazar' && !cantidad) { setErr('Indicá la cantidad.'); return }
    try {
      await responder.mutateAsync({
        solicitudId:            solicitud.id,
        accion,
        respuesta,
        productoAlternativoId:  accion === 'alternativa' ? prodAlt : undefined,
        clienteId:              solicitud.cliente_id,
        productoId:             accion === 'aceptar' ? solicitud.producto_id : (accion === 'alternativa' ? prodAlt : undefined),
        cantidad:               accion !== 'rechazar' ? parseInt(cantidad) : undefined,
      })
      onClose()
    } catch (ex) { setErr(ex.message) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
        <p className="font-semibold text-gray-900">{solicitud.clientes?.razon_social}</p>
        {solicitud.productos && <p className="text-gray-600">Producto solicitado: <span className="font-medium">{solicitud.productos.nombre}</span></p>}
        <p className="text-gray-600">Uso previsto: <span className="italic">"{solicitud.uso_previsto}"</span></p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">Acción</label>
        <div className="flex gap-2">
          {[
            ['aceptar',     'Aceptar',             'border-green-500 bg-green-50 text-green-800'],
            ['alternativa', 'Sugerir alternativa',  'border-blue-500 bg-blue-50 text-blue-800'  ],
            ['rechazar',    'Rechazar',              'border-red-500 bg-red-50 text-red-800'     ],
          ].map(([v, l, cls]) => (
            <button key={v} type="button" onClick={() => setAccion(v)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${accion === v ? cls : 'border-gray-200 text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {accion === 'alternativa' && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Producto alternativo *</label>
          <select value={prodAlt} onChange={e => setProdAlt(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]">
            <option value="">Seleccionar…</option>
            {productos.filter(p => p.id !== solicitud.producto_id).map(p =>
              <option key={p.id} value={p.id}>{p.nombre}</option>
            )}
          </select>
        </div>
      )}

      {accion !== 'rechazar' && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Cantidad de unidades a enviar</label>
          <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
            className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">
          {accion === 'rechazar' ? 'Motivo (recomendado)' : 'Mensaje al cliente (opcional)'}
        </label>
        <textarea rows={2} value={respuesta} onChange={e => setRespuesta(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
          placeholder={accion === 'rechazar' ? 'Explicá el motivo…' : 'Instrucciones o comentarios…'}/>
      </div>

      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={responder.isPending}
          className="flex-1 bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {responder.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
          Confirmar
        </button>
      </div>
    </form>
  )
}

// ── Tarjeta de envío ──────────────────────────────────────────────────────────
function CardEnvio({ envio }) {
  const cfg = ESTADO_CFG[envio.estado] ?? { label: envio.estado, cls: 'bg-gray-100 text-gray-500' }
  return (
    <div className="bg-white rounded-[10px] shadow-card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{envio.clientes?.razon_social}</p>
          <p className="text-xs text-gray-500">{envio.productos?.nombre}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
        <span>{envio.cantidad} unidad{envio.cantidad !== 1 ? 'es' : ''}</span>
        {envio.lote && <span>Lote: <span className="font-mono font-medium text-gray-700">{envio.lote}</span></span>}
        <span>Enviado: {fmtFecha(envio.creado_en)}</span>
      </div>
      {envio.notas && <p className="text-xs text-gray-500 italic mb-2">Nota: {envio.notas}</p>}
      {envio.estado === 'recibida' && envio.recibida_en && (
        <p className="text-xs text-yellow-700">Recibida el {fmtFecha(envio.recibida_en)}</p>
      )}
      {envio.estado === 'evaluada' && (
        <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 space-y-1">
          {envio.uso      && <p className="text-xs text-gray-700"><span className="font-semibold">Uso:</span> {envio.uso}</p>}
          {envio.resultado && <p className="text-xs text-gray-700"><span className="font-semibold">Resultado:</span> {envio.resultado}</p>}
          {envio.evaluada_en && <p className="text-[10px] text-gray-400">Evaluada: {fmtFecha(envio.evaluada_en)}</p>}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MuestrasVendedor() {
  const [tab,         setTab]         = useState('envios')
  const [showForm,    setShowForm]    = useState(false)
  const [solicSelec,  setSolicSelec]  = useState(null)

  const { data: envios      = [], isLoading: loadEnvios  } = useMuestrasVendedor()
  const { data: solicitudes = [], isLoading: loadSolic   } = useSolicitudesVendedor()

  const pendientesSolic = solicitudes.filter(s => s.estado === 'pendiente').length

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Muestras</h1>
          <p className="text-sm text-gray-400 mt-0.5">Envíos y seguimiento de muestras a clientes</p>
        </div>
        {tab === 'envios' && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Nuevo envío
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          ['envios',      'Envíos',                envios.length],
          ['solicitudes', 'Solicitudes de clientes', pendientesSolic > 0 ? pendientesSolic : null],
        ].map(([v, l, count]) => (
          <button key={v} onClick={() => { setTab(v); setShowForm(false); setSolicSelec(null) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === v ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
            {count != null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${v === 'solicitudes' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB ENVÍOS ── */}
      {tab === 'envios' && (
        <>
          {showForm && (
            <div className="bg-white rounded-[10px] shadow-card p-5 mb-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Registrar envío de muestra</h2>
              <FormNuevoEnvio onClose={() => setShowForm(false)}/>
            </div>
          )}

          {loadEnvios
            ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
            : envios.length === 0
              ? <div className="bg-white rounded-[10px] shadow-card p-12 text-center text-sm text-gray-400">
                  No hay envíos registrados aún.<br/>
                  <button onClick={() => setShowForm(true)} className="mt-2 text-[#004a99] font-medium hover:underline">Registrar primer envío →</button>
                </div>
              : (
                <>
                  {/* Filtro rápido por estado */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {envios.map(e => <CardEnvio key={e.id} envio={e}/>)}
                  </div>
                </>
              )
          }
        </>
      )}

      {/* ── TAB SOLICITUDES ── */}
      {tab === 'solicitudes' && (
        <>
          {solicSelec ? (
            <div className="bg-white rounded-[10px] shadow-card p-5 mb-5 max-w-lg">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Responder solicitud</h2>
              <PanelResponder solicitud={solicSelec} onClose={() => setSolicSelec(null)}/>
            </div>
          ) : null}

          {loadSolic
            ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
            : solicitudes.length === 0
              ? <div className="bg-white rounded-[10px] shadow-card p-12 text-center text-sm text-gray-400">No hay solicitudes de muestras.</div>
              : (
                <div className="space-y-3">
                  {solicitudes.map(s => {
                    const cfg = SOLIC_CFG[s.estado] ?? { label: s.estado, cls: 'bg-gray-100 text-gray-500' }
                    return (
                      <div key={s.id} className={`bg-white rounded-[10px] shadow-card p-4 border-l-4 ${s.estado === 'pendiente' ? 'border-amber-400' : 'border-gray-100'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold text-gray-900">{s.clientes?.razon_social}</p>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                            </div>
                            {s.productos && <p className="text-xs text-gray-500 mb-1">Producto pedido: <span className="font-medium">{s.productos.nombre}</span></p>}
                            <p className="text-xs text-gray-600 italic">"{s.uso_previsto}"</p>
                            <p className="text-[10px] text-gray-400 mt-1">{fmtFecha(s.creado_en)}</p>
                            {s.respuesta_vendedor && (
                              <p className="text-xs text-gray-500 mt-1.5">Tu respuesta: {s.respuesta_vendedor}</p>
                            )}
                            {s.producto_alternativo && (
                              <p className="text-xs text-blue-700 mt-0.5">Alternativa sugerida: <span className="font-medium">{s.producto_alternativo.nombre}</span></p>
                            )}
                          </div>
                          {s.estado === 'pendiente' && (
                            <button onClick={() => setSolicSelec(solicSelec?.id === s.id ? null : s)}
                              className="flex-shrink-0 text-xs font-medium text-[#004a99] hover:underline border border-[#004a99] px-3 py-1.5 rounded-lg">
                              Responder
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
          }
        </>
      )}
    </div>
  )
}
