import { useState, useReducer, useEffect, useMemo } from 'react'
import {
  useCotizacionesCliente,
  useResponderCotizacion,
  useRechazarCotizacion,
} from '../../hooks/useCotizacionesCliente'
import { useEmitirOC } from '../../hooks/useOrdenes'
import { useProductos } from '../../hooks/useProductos'
import { useCrearSolicitud } from '../../hooks/useSolicitudes'

import { fmtUSD, fmtFecha } from '../../utils/calc'

const ESTADOS_BADGE = {
  espera:   { label: 'Pendiente respuesta', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  revision: { label: 'En revisión',         bg: 'bg-orange-100', text: 'text-orange-800' },
  ganada:   { label: 'Aceptada',            bg: 'bg-green-100',  text: 'text-green-800'  },
  parcial:  { label: 'Parcial',             bg: 'bg-blue-100',   text: 'text-blue-800'   },
  perdida:  { label: 'Rechazada',           bg: 'bg-red-100',    text: 'text-red-700'    },
  vencida:  { label: 'Vencida',             bg: 'bg-gray-100',   text: 'text-gray-500'   },
}

const ACCION_BADGE = {
  aceptado:  { label: 'Aceptado',  bg: 'bg-green-100', text: 'text-green-700'  },
  rechazado: { label: 'Rechazado', bg: 'bg-red-100',   text: 'text-red-700'    },
  recotizar: { label: 'A recotizar',bg: 'bg-yellow-100',text: 'text-yellow-800' },
}

function Badge({ estado, small }) {
  const e = ESTADOS_BADGE[estado] ?? { label: estado, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${
      small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
    } ${e.bg} ${e.text}`}>
      {e.label}
    </span>
  )
}

function AccionBadge({ accion }) {
  const e = ACCION_BADGE[accion] ?? { label: accion, bg: 'bg-gray-100', text: 'text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${e.bg} ${e.text}`}>
      {e.label}
    </span>
  )
}

// ─── reducer para las respuestas por ítem ─────────────────────────────────────

function respReducer(state, action) {
  const item = state[action.itemId] ?? {}
  switch (action.type) {
    case 'INIT':
      return action.items.reduce((acc, it) => ({
        ...acc,
        [it.id]: {
          accion:    it.respuesta     ?? null,
          tipo:      it.recotizar_tipo ?? 'solicitar mejora de precio',
          cantNueva: it.cantidad_nueva ?? it.cantidad,
          nota:      it.respuesta_nota ?? '',
        }
      }), {})
    case 'SET_ACCION':
      return { ...state, [action.itemId]: { ...item, accion: action.accion } }
    case 'SET_TIPO':
      return { ...state, [action.itemId]: { ...item, tipo: action.tipo } }
    case 'SET_CANT':
      return { ...state, [action.itemId]: { ...item, cantNueva: action.cant } }
    case 'SET_NOTA':
      return { ...state, [action.itemId]: { ...item, nota: action.nota } }
    default:
      return state
  }
}

// ─── fila de ítem interactivo ─────────────────────────────────────────────────

function ItemRespuesta({ item, resp = {}, dispatch, readonly }) {
  const accion = resp.accion ?? null

  return (
    <div className={`p-4 border-b border-gray-100 last:border-0 transition-colors ${
      accion === 'recotizar' ? 'bg-yellow-50/60' :
      accion === 'rechazado' ? 'bg-red-50/40'    :
      accion === 'aceptado'  ? 'bg-green-50/40'  : ''
    }`}>
      <div className="flex items-start gap-3">
        {/* Info producto */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm leading-snug">{item.productos?.nombre}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {item.productos?.presentacion} · <strong className="text-gray-600">{item.cantidad} kg/lt</strong>
            {' · '}{fmtUSD(item.precio_unitario)}/kg
            {' · '}<span className="font-semibold text-gray-700">{fmtUSD(item.subtotal)}</span>
          </p>
        </div>

        {/* Botones o badge */}
        {readonly ? (
          <div className="flex-shrink-0 pt-0.5">
            {accion ? <AccionBadge accion={accion} /> : <span className="text-xs text-gray-300">—</span>}
          </div>
        ) : (
          <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {/* Acepto */}
            <button
              onClick={() => dispatch({ type: 'SET_ACCION', itemId: item.id, accion: accion === 'aceptado' ? null : 'aceptado' })}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                accion === 'aceptado'
                  ? 'bg-[#28a745] border-[#28a745] text-white'
                  : 'border-gray-200 text-gray-500 hover:border-[#28a745] hover:text-[#28a745]'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Acepto
            </button>

            {/* Recotizar */}
            <button
              onClick={() => dispatch({ type: 'SET_ACCION', itemId: item.id, accion: accion === 'recotizar' ? null : 'recotizar' })}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                accion === 'recotizar'
                  ? 'bg-[#ffc107] border-[#ffc107] text-yellow-900'
                  : 'border-gray-200 text-gray-500 hover:border-[#ffc107] hover:text-yellow-700'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Recotizar
            </button>

            {/* Rechazo */}
            <button
              onClick={() => dispatch({ type: 'SET_ACCION', itemId: item.id, accion: accion === 'rechazado' ? null : 'rechazado' })}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                accion === 'rechazado'
                  ? 'bg-[#dc3545] border-[#dc3545] text-white'
                  : 'border-gray-200 text-gray-500 hover:border-[#dc3545] hover:text-[#dc3545]'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Rechazo
            </button>
          </div>
        )}
      </div>

      {/* Sub-formulario recotización */}
      {!readonly && accion === 'recotizar' && (
        <div className="mt-3 ml-0 p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2.5">
          <p className="text-xs font-bold text-yellow-800">¿Qué querés cambiar?</p>

          {/* Tipo */}
          <div className="flex gap-2 flex-wrap">
            {['solicitar mejora de precio', 'cambiar cantidad'].map(op => (
              <label key={op} className={`flex items-center gap-1.5 text-xs cursor-pointer px-2.5 py-1 rounded-full border transition-colors ${
                resp.tipo === op
                  ? 'bg-yellow-400 border-yellow-400 text-yellow-900 font-semibold'
                  : 'bg-white border-yellow-300 text-yellow-800 hover:border-yellow-400'
              }`}>
                <input
                  type="radio"
                  name={`tipo-${item.id}`}
                  checked={resp.tipo === op}
                  onChange={() => dispatch({ type: 'SET_TIPO', itemId: item.id, tipo: op })}
                  className="sr-only"
                />
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </label>
            ))}
          </div>

          {/* Nueva cantidad */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-yellow-800 whitespace-nowrap">Nueva cantidad:</label>
            <input
              type="number"
              min="0.001"
              step="1"
              value={resp.cantNueva ?? item.cantidad}
              onChange={e => dispatch({ type: 'SET_CANT', itemId: item.id, cant: parseFloat(e.target.value) || item.cantidad })}
              className="w-24 text-center text-sm border border-yellow-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
            />
            <span className="text-xs text-yellow-700">kg/lt</span>
          </div>

          {/* Nota */}
          <input
            type="text"
            value={resp.nota ?? ''}
            onChange={e => dispatch({ type: 'SET_NOTA', itemId: item.id, nota: e.target.value })}
            placeholder="Detalle: precio esperado, producto alternativo…"
            className="w-full text-xs border border-yellow-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
          />
        </div>
      )}

      {/* Info recotización en modo readonly */}
      {readonly && accion === 'recotizar' && (item.respuesta_nota || item.cantidad_nueva || item.recotizar_tipo) && (
        <div className="mt-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 space-y-0.5">
          {item.recotizar_tipo && <p><span className="font-medium">Tipo:</span> {item.recotizar_tipo}</p>}
          {item.cantidad_nueva && item.cantidad_nueva !== item.cantidad && (
            <p><span className="font-medium">Nueva cantidad:</span> {item.cantidad_nueva} kg/lt</p>
          )}
          {item.respuesta_nota && <p><span className="font-medium">Nota:</span> {item.respuesta_nota}</p>}
        </div>
      )}
    </div>
  )
}

// ─── buscador de productos extra ─────────────────────────────────────────────

function BuscadorProductosExtra({ productos, idsExcluidos, onAgregar }) {
  const [busqueda, setBusqueda] = useState('')
  const [cantidad, setCantidad] = useState(100)

  const resultados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return []
    return productos
      .filter(p => !idsExcluidos.has(p.id) && (
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
      ))
      .slice(0, 6)
  }, [busqueda, productos, idsExcluidos])

  function agregar(prod) {
    onAgregar({ producto_id: prod.id, nombre: prod.nombre, presentacion: prod.presentacion ?? '', codigo: prod.codigo, cantidad })
    setBusqueda('')
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agregar productos a solicitar</p>
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
        </div>
        <input type="number" min="1" value={cantidad} onChange={e => setCantidad(Number(e.target.value) || 1)}
          className="w-20 text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          title="Cantidad kg/lt"/>
      </div>
      {resultados.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {resultados.map(p => (
            <button key={p.id} onClick={() => agregar(p)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                <p className="text-xs text-gray-400">{p.presentacion}</p>
              </div>
              <svg className="w-4 h-4 text-[#004a99] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── modal confirmación OC ────────────────────────────────────────────────────

function ModalConfirmarOC({ items, respuestas, cot, onConfirmar, onCancelar, isPending }) {
  const itemsAceptados = items.filter(it => respuestas[it.id]?.accion === 'aceptado')

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Confirmar Orden de Compra</h3>
          <p className="text-xs text-gray-400 mt-0.5">Revisá el resumen antes de enviar</p>
        </div>

        <div className="px-6 py-4 max-h-64 overflow-y-auto divide-y divide-gray-50">
          {itemsAceptados.map(it => (
            <div key={it.id} className="flex items-start justify-between py-2 first:pt-0 last:pb-0 text-sm gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 leading-snug">{it.productos?.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {it.productos?.presentacion} · <strong className="text-gray-600">{it.cantidad} kg/lt</strong>
                  {' · '}{fmtUSD(it.precio_unitario)}/kg
                </p>
              </div>
              <p className="font-semibold text-gray-800 flex-shrink-0">{fmtUSD(it.subtotal)}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>{fmtUSD(cot.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>IVA 21%</span><span>{fmtUSD(cot.iva)}</span>
          </div>
          <div className="flex justify-between font-bold text-base text-gray-900 pt-1.5 border-t border-gray-200">
            <span>Total</span>
            <span className="text-[#004a99]">{fmtUSD(cot.total)}</span>
          </div>
        </div>

        <div className="px-6 py-4 flex gap-2">
          <button
            onClick={onCancelar}
            disabled={isPending}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={isPending}
            className="flex-1 bg-[#004a99] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#003d80] disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando OC…
              </span>
            ) : 'Confirmar y generar OC'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── modal de detalle / respuesta ─────────────────────────────────────────────

function ModalEmitirOC({ cot, onClose }) {
  const emitir = useEmitirOC()
  const [refCliente,  setRefCliente]  = useState('')
  const [obs,         setObs]         = useState('')
  const [tipoEntrega, setTipoEntrega] = useState('entrega')
  const [exito,       setExito]       = useState(null)

  async function handleEmitir() {
    try {
      const result = await emitir.mutateAsync({
        cotizacionId: cot.id,
        referenciaCliente: refCliente,
        observaciones: obs,
        tipoEntrega,
      })
      setExito(result.numero)
    } catch (err) { alert('Error: ' + err.message) }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-sm p-6">
        {exito ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#28a745]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">OC emitida</h3>
            <p className="text-sm text-gray-500 mb-4">Código: <strong className="text-[#004a99]">{exito}</strong></p>
            <button onClick={onClose} className="w-full bg-[#004a99] text-white py-2 rounded-lg text-sm">Cerrar</button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-gray-900 mb-1">Emitir Orden de Compra</h3>
            <p className="text-sm text-gray-500 mb-4">Cotización: <strong>{cot.codigo}</strong> · {fmtUSD(cot.total)}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">Tipo de entrega</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['entrega','Envío a domicilio'],['retiro','Retiro en fábrica']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setTipoEntrega(v)}
                      className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                        tipoEntrega === v ? 'border-[#004a99] bg-blue-50 text-[#004a99]' : 'border-gray-200 text-gray-400'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">N° de OC interno (opcional)</label>
                <input type="text" value={refCliente} onChange={e => setRefCliente(e.target.value)}
                  placeholder="Tu referencia interna"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Observaciones (opcional)</label>
                <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleEmitir} disabled={emitir.isPending}
                className="flex-1 bg-[#004a99] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#003d80] disabled:opacity-50">
                {emitir.isPending ? 'Emitiendo…' : 'Emitir OC'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DetalleCotizacion({ cot, onClose }) {
  const responder      = useResponderCotizacion()
  const rechazar       = useRechazarCotizacion()
  const emitir         = useEmitirOC()
  const crearSolicitud = useCrearSolicitud()
  const { data: todosProductos = [] } = useProductos()

  const [respuestas, dispatch] = useReducer(respReducer, {})
  const [modalRechazo, setModalRechazo] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [exito, setExito] = useState(null)
  const [ocNumero, setOcNumero] = useState(null)
  const [productosExtra, setProductosExtra] = useState([])
  const [modalConfirmarOC, setModalConfirmarOC] = useState(false)
  const [pendingPayload, setPendingPayload] = useState([])

  const items    = cot.cotizacion_items ?? []
  const enEspera = cot.estado === 'espera'

  const idsEnCotizacion = useMemo(
    () => new Set(items.map(it => it.producto_id)),
    [items]
  )

  // Inicializar respuestas desde DB
  useEffect(() => {
    dispatch({ type: 'INIT', items })
  }, [cot.id])

  const sinResponder = enEspera
    ? items.filter(it => !respuestas[it.id]?.accion).length
    : 0

  function handleConfirmar() {
    if (sinResponder > 0) return
    const payload = items.map(it => ({
      itemId:    it.id,
      accion:    respuestas[it.id]?.accion,
      tipo:      respuestas[it.id]?.tipo,
      cantNueva: respuestas[it.id]?.cantNueva,
      nota:      respuestas[it.id]?.nota,
    }))
    const todosAceptados = payload.every(r => r.accion === 'aceptado')
    if (todosAceptados) {
      setPendingPayload(payload)
      setModalConfirmarOC(true)
      return
    }
    ejecutarConfirmacion(payload)
  }

  async function ejecutarConfirmacion(payload) {
    try {
      const result = await responder.mutateAsync({ cotizacionId: cot.id, respuestas: payload })
      if (productosExtra.length > 0) {
        await crearSolicitud.mutateAsync({ items: productosExtra, observaciones: '' })
      }
      if (result.nuevoEstado === 'ganada') {
        const oc = await emitir.mutateAsync({ cotizacionId: cot.id })
        setOcNumero(oc.numero)
      }
      setExito(result.nuevoEstado)
      setModalConfirmarOC(false)
    } catch (err) {
      setModalConfirmarOC(false)
      alert('Error: ' + err.message)
    }
  }

  async function handleRechazarTodo() {
    try {
      await rechazar.mutateAsync({ cotizacionId: cot.id, motivo: motivoRechazo })
      setExito('perdida')
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">{cot.codigo}</span>
              <Badge estado={exito ?? cot.estado} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtFecha(cot.creado_en)}
              {cot.vencimiento && <> · Vence {fmtFecha(cot.vencimiento + 'T00:00:00')}</>}
              {cot.validez_dias && <> · {cot.validez_dias} días hábiles</>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 ml-2 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pantalla de éxito */}
        {exito && (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              exito === 'ganada' ? 'bg-green-100' :
              exito === 'perdida' ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              {exito === 'ganada' ? (
                <svg className="w-7 h-7 text-[#28a745]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : exito === 'perdida' ? (
                <svg className="w-7 h-7 text-[#dc3545]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </div>
            <h3 className="font-bold text-gray-900 mb-1">
              {exito === 'ganada' ? '¡Orden de compra generada!' :
               exito === 'perdida' ? 'Cotización rechazada' :
               'Revisión enviada al vendedor'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {exito === 'ganada'
                ? <>OC <strong className="text-[#004a99]">{ocNumero}</strong> creada. El vendedor preparará tu pedido.</>
                : exito === 'perdida' ? 'Le avisamos al vendedor.'
                : 'Recibirás una cotización actualizada pronto.'}
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#004a99] text-white rounded-lg text-sm hover:bg-[#003d80]"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Contenido principal */}
        {!exito && (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Banner informativo para estado revisión */}
              {cot.estado === 'revision' && (
                <div className="mx-6 mt-4 mb-2 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                  <svg className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">En revisión por el vendedor</p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      Pediste recotizar algunos productos. El vendedor está revisando tu solicitud y te enviará una cotización actualizada en breve.
                    </p>
                    {items.filter(it => respuestas[it.id]?.accion === 'recotizar').length > 0 && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">
                        {items.filter(it => respuestas[it.id]?.accion === 'recotizar').length} producto{items.filter(it => respuestas[it.id]?.accion === 'recotizar').length !== 1 ? 's' : ''} en recotización
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                {items.map(item => (
                  <ItemRespuesta
                    key={item.id}
                    item={item}
                    resp={respuestas[item.id]}
                    dispatch={dispatch}
                    readonly={!enEspera}
                  />
                ))}
              </div>

              {/* Agregar productos extra */}
              {enEspera && (
                <div className="px-6 py-3 border-t border-gray-100">
                  <BuscadorProductosExtra
                    productos={todosProductos}
                    idsExcluidos={idsEnCotizacion}
                    onAgregar={p => setProductosExtra(prev => [...prev, p])}
                  />
                  {productosExtra.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {productosExtra.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                          <span className="font-medium text-gray-800">{p.nombre} · {p.cantidad} kg</span>
                          <button onClick={() => setProductosExtra(prev => prev.filter((_, j) => j !== i))}
                            className="text-gray-400 hover:text-[#dc3545] ml-2">✕</button>
                        </div>
                      ))}
                      <p className="text-xs text-blue-600 mt-1">Se creará una nueva solicitud con {productosExtra.length} producto{productosExtra.length !== 1 ? 's' : ''} al confirmar.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Totales */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 space-y-1.5">
                {cot.observaciones && (
                  <p className="text-xs text-gray-500 italic mb-3">
                    <span className="font-medium not-italic text-gray-600">Nota del vendedor:</span> {cot.observaciones}
                  </p>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>{fmtUSD(cot.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>IVA 21%</span><span>{fmtUSD(cot.iva)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-[#004a99]">{fmtUSD(cot.total)}</span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            {enEspera && (
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
                {sinResponder > 0 && (
                  <p className="text-xs text-gray-400 mb-3 text-center">
                    Faltan responder <strong>{sinResponder}</strong> producto{sinResponder !== 1 ? 's' : ''}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalRechazo(true)}
                    disabled={rechazar.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 border border-[#dc3545] text-[#dc3545] rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Rechazar todo
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={sinResponder > 0 || responder.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-[#004a99] hover:bg-[#003d80] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {responder.isPending ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando…</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Confirmar respuesta</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal confirmación OC */}
      {modalConfirmarOC && (
        <ModalConfirmarOC
          items={items}
          respuestas={respuestas}
          cot={cot}
          onConfirmar={() => ejecutarConfirmacion(pendingPayload)}
          onCancelar={() => setModalConfirmarOC(false)}
          isPending={responder.isPending || emitir.isPending}
        />
      )}

      {/* Modal de rechazo total */}
      {modalRechazo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-[10px] shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-1">Rechazar cotización</h3>
            <p className="text-sm text-gray-500 mb-4">¿Estás seguro? Indicá el motivo (opcional).</p>
            <textarea
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)}
              placeholder="Precio muy alto, conseguimos otra oferta…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#dc3545]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setModalRechazo(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazarTodo}
                disabled={rechazar.isPending}
                className="flex-1 bg-[#dc3545] hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {rechazar.isPending ? 'Rechazando…' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function MisCotizaciones() {
  const { data: cotizaciones = [], isLoading, error } = useCotizacionesCliente()
  const [detalle, setDetalle] = useState(null)

  const pendientes  = cotizaciones.filter(c => c.estado === 'espera').length
  const enRevision  = cotizaciones.filter(c => c.estado === 'revision').length

  // Orden: espera primero
  const ordenEstado = { espera: 0, revision: 1, ganada: 2, parcial: 3, perdida: 4, vencida: 5 }
  const ordenadas   = [...cotizaciones].sort((a, b) => (ordenEstado[a.estado] ?? 9) - (ordenEstado[b.estado] ?? 9))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mis Cotizaciones</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? 'Cargando…' : `${cotizaciones.length} cotizaciones`}
          {pendientes > 0 && (
            <span className="ml-2 text-[#ffc107] font-medium">
              · {pendientes} esperando tu respuesta
            </span>
          )}
          {enRevision > 0 && (
            <span className="ml-2 text-orange-500 font-medium">
              · {enRevision} en revisión
            </span>
          )}
        </p>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {error && <p className="p-6 text-center text-[#dc3545] text-sm">Error: {error.message}</p>}

        {isLoading && (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && !error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Vence</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Total</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-40">Estado</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ordenadas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <p className="mb-1">Aún no recibiste cotizaciones.</p>
                    <p className="text-xs">Enviá una solicitud para comenzar.</p>
                  </td>
                </tr>
              ) : (
                ordenadas.map(cot => {
                  const enEspera   = cot.estado === 'espera'
                  const enRevision = cot.estado === 'revision'
                  return (
                    <tr
                      key={cot.id}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        enEspera   ? 'border-l-4 border-l-[#ffc107]' :
                        enRevision ? 'border-l-4 border-l-orange-400' : ''
                      }`}
                      onClick={() => setDetalle(cot)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#004a99]">
                        {cot.codigo}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fmtFecha(cot.creado_en)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {cot.vencimiento ? fmtFecha(cot.vencimiento + 'T00:00:00') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtUSD(cot.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge estado={cot.estado} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {enEspera ? (
                          <span className="text-xs font-semibold text-[#004a99] bg-blue-50 px-2 py-1 rounded-full">
                            Responder
                          </span>
                        ) : enRevision ? (
                          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                            Ver estado
                          </span>
                        ) : (
                          <svg className="w-4 h-4 text-gray-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {detalle && (
        <DetalleCotizacion
          cot={detalle}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  )
}
