import { useState } from 'react'
import {
  useMuestrasVendedor, useEnviarMuestra,
  useSolicitudesVendedor, useResponderSolicitud,
  useClientesVendedor, useLotesProducto, useProductosActivos,
  useConfigurarSeguimiento, useMarcarContactado,
} from '../../hooks/useMuestras'
import { fmtFecha } from '../../utils/calc'

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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]">
            <option value="">Seleccionar cliente…</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Producto *</label>
          <select value={productoId} onChange={e => { setProductoId(e.target.value); setLote('') }} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]">
            <option value="">Seleccionar producto…</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.codigo ? `(${p.codigo})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Cantidad (unidades) *</label>
          <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
            placeholder="Ej: 3"/>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Lote</label>
          {lotes.length > 0 ? (
            <select value={lote} onChange={e => setLote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]">
              <option value="">Sin especificar</option>
              {lotes.map(l => <option key={l.id} value={l.numero_lote}>{l.numero_lote} · {fmtFecha(l.fecha_produccion)}</option>)}
            </select>
          ) : (
            <input type="text" value={lote} onChange={e => setLote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              placeholder="Nro. de lote"/>
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Notas (opcional)</label>
          <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332] resize-none"
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
          className="flex-1 bg-[#1b4332] hover:bg-[#152e24] text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
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
  const [accion,    setAccion]    = useState('aceptar')
  const [respuesta, setRespuesta] = useState('')
  const [prodAlt,   setProdAlt]   = useState('')
  const [prodSelec, setProdSelec] = useState('')
  const [cantidad,  setCantidad]  = useState('1')
  const [err, setErr] = useState('')

  const necesitaSelector = accion === 'aceptar' && !solicitud.producto_id

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (accion === 'aceptar' && necesitaSelector && !prodSelec) { setErr('Seleccioná el producto a enviar.'); return }
    if (accion === 'alternativa' && !prodAlt) { setErr('Seleccioná el producto alternativo.'); return }
    if (accion !== 'rechazar' && !cantidad) { setErr('Indicá la cantidad.'); return }
    try {
      await responder.mutateAsync({
        solicitudId:            solicitud.id,
        accion,
        respuesta,
        productoAlternativoId:  accion === 'alternativa' ? prodAlt : undefined,
        clienteId:              solicitud.cliente_id,
        productoId:             accion === 'aceptar'
                                  ? (solicitud.producto_id || prodSelec || null)
                                  : (accion === 'alternativa' ? prodAlt : undefined),
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

      {necesitaSelector && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Producto a enviar *</label>
          <select value={prodSelec} onChange={e => setProdSelec(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]">
            <option value="">Seleccionar…</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}

      {accion === 'alternativa' && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Producto alternativo *</label>
          <select value={prodAlt} onChange={e => setProdAlt(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]">
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
            className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"/>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">
          {accion === 'rechazar' ? 'Motivo (recomendado)' : 'Mensaje al cliente (opcional)'}
        </label>
        <textarea rows={2} value={respuesta} onChange={e => setRespuesta(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332] resize-none"
          placeholder={accion === 'rechazar' ? 'Explicá el motivo…' : 'Instrucciones o comentarios…'}/>
      </div>

      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={responder.isPending}
          className="flex-1 bg-[#1b4332] hover:bg-[#152e24] text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {responder.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
          Confirmar
        </button>
      </div>
    </form>
  )
}

// ── Panel de seguimiento ──────────────────────────────────────────────────────
function SeguimientoPanel({ envio }) {
  const configurar       = useConfigurarSeguimiento()
  const marcarContactado = useMarcarContactado()
  const tieneSeg = !!envio.seguimiento_tipo
  const [editing, setEditing] = useState(!tieneSeg)
  const [tipo,    setTipo]    = useState(envio.seguimiento_tipo ?? 'manual')
  const [dias,    setDias]    = useState(envio.seguimiento_dias?.toString() ?? '7')
  const [nota,    setNota]    = useState(envio.seguimiento_nota ?? '')
  const [err,     setErr]     = useState('')

  const fechaConsulta = envio.seguimiento_dias && envio.creado_en
    ? new Date(new Date(envio.creado_en).getTime() + envio.seguimiento_dias * 86400000)
    : null
  const vencido = fechaConsulta && new Date() > fechaConsulta && !envio.seguimiento_contactado

  async function handleGuardar() {
    setErr('')
    try {
      await configurar.mutateAsync({ envioId: envio.id, tipo, dias, nota })
      setEditing(false)
    } catch (e) { setErr(e.message) }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[['manual','Manual'],['automatico','Automático'],['ambos','Ambos']].map(([v,l]) => (
            <button key={v} type="button" onClick={() => setTipo(v)}
              className={`flex-1 py-1.5 rounded text-xs font-semibold border-2 transition-all ${tipo === v ? 'border-[#1b4332] bg-blue-50 text-[#1b4332]' : 'border-gray-200 text-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>
        {(tipo === 'automatico' || tipo === 'ambos') && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Consultar en</span>
            <input type="number" min="1" max="365" value={dias} onChange={e => setDias(e.target.value)}
              className="w-14 border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-[#1b4332]"/>
            <span>días desde el envío</span>
          </div>
        )}
        <textarea rows={2} value={nota} onChange={e => setNota(e.target.value)}
          placeholder="Nota interna (opcional)…"
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1b4332] resize-none"/>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          {tieneSeg && (
            <button type="button" onClick={() => setEditing(false)}
              className="flex-1 border border-gray-200 text-gray-500 text-xs py-1.5 rounded hover:bg-gray-50">
              Cancelar
            </button>
          )}
          <button type="button" onClick={handleGuardar} disabled={configurar.isPending}
            className="flex-1 bg-[#1b4332] text-white text-xs font-semibold py-1.5 rounded disabled:opacity-60 flex items-center justify-center gap-1.5">
            {configurar.isPending && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            envio.seguimiento_tipo === 'manual' ? 'bg-gray-100 text-gray-600'
            : envio.seguimiento_tipo === 'automatico' ? 'bg-blue-100 text-blue-700'
            : 'bg-purple-100 text-purple-700'
          }`}>
            {envio.seguimiento_tipo === 'manual' ? 'Manual' : envio.seguimiento_tipo === 'automatico' ? 'Automático' : 'Manual + Automático'}
          </span>
          {fechaConsulta && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              envio.seguimiento_contactado ? 'bg-green-100 text-green-700'
              : vencido ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-500'
            }`}>
              {envio.seguimiento_contactado ? `✓ Contactado ${fmtFecha(envio.seguimiento_contactado_en)}`
               : vencido ? `⚠ Vencido — ${fmtFecha(fechaConsulta)}`
               : `Consultar: ${fmtFecha(fechaConsulta)}`}
            </span>
          )}
        </div>
        <button onClick={() => setEditing(true)} className="text-[10px] text-gray-400 hover:text-[#1b4332]">Editar</button>
      </div>
      {envio.seguimiento_nota && <p className="text-xs text-gray-500 italic">"{envio.seguimiento_nota}"</p>}
      {vencido && !envio.seguimiento_contactado && (
        <button onClick={() => marcarContactado.mutate({ envioId: envio.id })} disabled={marcarContactado.isPending}
          className="w-full bg-[#1b4332] text-white text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
          {marcarContactado.isPending && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
          Marcar como contactado
        </button>
      )}
    </div>
  )
}

// ── Tarjeta de envío ──────────────────────────────────────────────────────────
function CardEnvio({ envio }) {
  const cfg      = ESTADO_CFG[envio.estado] ?? { label: envio.estado, cls: 'bg-gray-100 text-gray-500' }
  const tieneSeg = !!envio.seguimiento_tipo
  const [showSeg, setShowSeg] = useState(false)

  const fechaConsulta = envio.seguimiento_dias && envio.creado_en
    ? new Date(new Date(envio.creado_en).getTime() + envio.seguimiento_dias * 86400000)
    : null
  const vencido = fechaConsulta && new Date() > fechaConsulta && !envio.seguimiento_contactado

  return (
    <div className={`bg-white rounded-[10px] shadow-card p-4 ${vencido ? 'border border-red-200' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{envio.clientes?.razon_social}</p>
          <p className="text-xs text-gray-500">{envio.productos?.nombre}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {vencido && !envio.seguimiento_contactado && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Seguimiento</span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
        <span>{envio.cantidad} unidad{envio.cantidad !== 1 ? 'es' : ''}</span>
        {envio.lote && <span>Lote: <span className="font-mono font-medium text-gray-700">{envio.lote}</span></span>}
        <span>Enviado: {fmtFecha(envio.creado_en)}</span>
      </div>
      {envio.notas && <p className="text-xs text-gray-500 italic mb-2">Nota: {envio.notas}</p>}
      {envio.estado === 'recibida' && envio.recibida_en && (
        <p className="text-xs text-yellow-700 mb-1">Recibida el {fmtFecha(envio.recibida_en)}</p>
      )}
      {envio.estado === 'evaluada' && (
        <div className="mb-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 space-y-1">
          {envio.uso      && <p className="text-xs text-gray-700"><span className="font-semibold">Uso:</span> {envio.uso}</p>}
          {envio.resultado && <p className="text-xs text-gray-700"><span className="font-semibold">Resultado:</span> {envio.resultado}</p>}
          {envio.evaluada_en && <p className="text-[10px] text-gray-400">Evaluada: {fmtFecha(envio.evaluada_en)}</p>}
        </div>
      )}

      {/* Seguimiento */}
      <div className="pt-2 border-t border-gray-100">
        <button onClick={() => setShowSeg(s => !s)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1b4332] transition-colors">
          <svg className={`w-3 h-3 transition-transform ${showSeg ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
          {tieneSeg ? 'Seguimiento configurado' : 'Configurar seguimiento'}
        </button>
        {showSeg && (
          <div className="mt-2">
            <SeguimientoPanel envio={envio}/>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MuestrasVendedor() {
  const [tab,         setTab]         = useState('envios')
  const [showForm,    setShowForm]    = useState(false)
  const [solicSelec,  setSolicSelec]  = useState(null)

  const { data: envios      = [], isLoading: loadEnvios, error: errEnvios  } = useMuestrasVendedor()
  const { data: solicitudes = [], isLoading: loadSolic,  error: errSolic   } = useSolicitudesVendedor()

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
            className="flex items-center gap-2 bg-[#1b4332] hover:bg-[#152e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
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
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === v ? 'bg-white text-[#1b4332] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
            {count != null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${v === 'solicitudes' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {errEnvios  && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 font-mono">{errEnvios.message}</p>}
      {errSolic   && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 font-mono">{errSolic.message}</p>}

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
            ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/></div>
            : envios.length === 0
              ? <div className="bg-white rounded-[10px] shadow-card p-12 text-center text-sm text-gray-400">
                  No hay envíos registrados aún.<br/>
                  <button onClick={() => setShowForm(true)} className="mt-2 text-[#1b4332] font-medium hover:underline">Registrar primer envío →</button>
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
            ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/></div>
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
                              className="flex-shrink-0 text-xs font-medium text-[#1b4332] hover:underline border border-[#1b4332] px-3 py-1.5 rounded-lg">
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
