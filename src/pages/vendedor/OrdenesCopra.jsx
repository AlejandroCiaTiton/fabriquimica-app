import { useState } from 'react'
import { useOrdenesVendedor, useAvanzarEstadoOC, useActualizarDatosOC, useActualizarEstadoPago } from '../../hooks/useOrdenes'
import { useGuardarAccionCorrectiva, useMarcarItemRecepcion, useConfirmarRecepcion } from '../../hooks/useRecepciones'
import { useSolicitarNota } from '../../hooks/useFinanzas'

const PIPELINE = ['recibida', 'en-preparacion', 'listo-entrega', 'entregada']
const LABELS    = { recibida: 'Recibida', 'en-preparacion': 'En preparación', 'listo-entrega': 'Listo p/entrega', entregada: 'Entregada' }

function fmtUSD(v) {
  if (v == null) return '—'
  return 'USD ' + Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PipelineBar({ estado }) {
  const idx = PIPELINE.indexOf(estado)
  return (
    <div className="flex items-center gap-1 my-3">
      {PIPELINE.map((e, i) => (
        <div key={e} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            i < idx  ? 'bg-green-100 text-green-700' :
            i === idx ? 'bg-[#004a99] text-white' :
                        'bg-gray-100 text-gray-400'
          }`}>
            {i < idx && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            {LABELS[e]}
          </div>
          {i < PIPELINE.length - 1 && <div className={`w-4 h-0.5 ${i < idx ? 'bg-green-300' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

const GESTION_OPTS = [
  { key: 'pendiente',   label: 'Pendiente',   cls: 'bg-red-100 text-red-700 border-red-200'       },
  { key: 'en_gestion',  label: 'En gestión',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { key: 'resuelto',    label: 'Resuelto',    cls: 'bg-green-100 text-green-700 border-green-200'  },
]

function FilaAccionCorrectiva({ oc, item, rec }) {
  const guardar      = useGuardarAccionCorrectiva()
  const solicitarNC  = useSolicitarNota()
  const [accion,     setAccion]     = useState(rec.accion_correctiva ?? '')
  const [estado,     setEstado]     = useState(rec.estado_gestion    ?? 'pendiente')
  const [saved,      setSaved]      = useState(false)
  const [showNC,     setShowNC]     = useState(false)
  const [ncMonto,    setNcMonto]    = useState('')
  const [ncMotivo,   setNcMotivo]   = useState('')
  const [ncEnviada,  setNcEnviada]  = useState(false)

  async function save(nuevoEstado = estado) {
    await guardar.mutateAsync({ ocId: oc.id, cotizacionItemId: rec.cot_item_id, accionCorrectiva: accion, estadoGestion: nuevoEstado })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSolicitarNC() {
    if (!ncMonto || !ncMotivo.trim()) return
    await solicitarNC.mutateAsync({ tipo: 'credito', ocId: oc.id, monto: ncMonto, motivo: ncMotivo.trim() })
    setNcEnviada(true)
    setShowNC(false)
    setNcMonto(''); setNcMotivo('')
  }

  return (
    <div className="p-3 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rec.estado === 'rech' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
          {rec.estado === 'rech' ? 'Rechazado' : 'Con problemas'}
        </span>
        <span className="text-sm font-medium text-gray-800">{item.productos?.nombre}</span>
      </div>
      {rec.comentario && (
        <p className="text-xs text-gray-500 italic mb-1.5">Cliente: "{rec.comentario}"</p>
      )}
      {rec.foto_url && (
        <a href={rec.foto_url} target="_blank" rel="noopener noreferrer" className="inline-block mb-3">
          <img src={rec.foto_url} alt="Foto del reclamo" className="h-16 w-16 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"/>
        </a>
      )}
      {!rec.foto_url && rec.comentario && <div className="mb-3"/>}

      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Estado de gestión</p>
      <div className="flex gap-1 mb-3 flex-wrap">
        {GESTION_OPTS.map(opt => (
          <button
            key={opt.key}
            onClick={() => { setEstado(opt.key); save(opt.key) }}
            disabled={guardar.isPending}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50 ${
              estado === opt.key ? opt.cls + ' font-bold' : 'border-gray-200 text-gray-400 bg-white hover:border-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Acción correctiva</p>
      <div className="flex gap-2 mb-3">
        <textarea
          value={accion}
          onChange={e => setAccion(e.target.value)}
          placeholder="Describí la acción correctiva o solución propuesta…"
          rows={2}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
        />
        <button
          onClick={() => save()}
          disabled={guardar.isPending}
          className={`self-end text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
            saved ? 'bg-green-100 text-green-700' : 'bg-[#004a99] text-white hover:bg-[#003d80]'
          }`}
        >
          {saved
            ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            : guardar.isPending ? '…' : 'Guardar'
          }
        </button>
      </div>

      {/* Nota de crédito */}
      {ncEnviada ? (
        <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 font-medium">
          ✓ Solicitud de NC enviada a Finanzas
        </p>
      ) : !showNC ? (
        <button
          onClick={() => { setNcMotivo(rec.comentario ? `Reclamo de calidad: ${rec.comentario}` : ''); setShowNC(true) }}
          className="text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          Solicitar nota de crédito →
        </button>
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Solicitud de nota de crédito</p>
          <div className="flex gap-2">
            <div className="w-28">
              <label className="text-[10px] text-gray-500 mb-0.5 block">Monto (USD)</label>
              <input
                type="number" min="0" step="0.01"
                value={ncMonto}
                onChange={e => setNcMonto(e.target.value)}
                placeholder="0.00"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 mb-0.5 block">Motivo</label>
              <input
                type="text"
                value={ncMotivo}
                onChange={e => setNcMotivo(e.target.value)}
                placeholder="Ej: problema de calidad en lote…"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSolicitarNC}
              disabled={!ncMonto || !ncMotivo.trim() || solicitarNC.isPending}
              className="text-xs font-semibold px-3 py-1.5 bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors"
            >
              {solicitarNC.isPending ? '…' : 'Enviar solicitud'}
            </button>
            <button
              onClick={() => setShowNC(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const RECEP_OPTS = [
  { key: 'ok',   label: 'Recibido OK',    cls: 'border-[#28a745] bg-green-50 text-green-800'   },
  { key: 'prob', label: 'Hubo problemas', cls: 'border-[#ffc107] bg-yellow-50 text-yellow-800' },
  { key: 'rech', label: 'Rechazado',      cls: 'border-[#dc3545] bg-red-50 text-red-800'        },
]

function PanelRecepcion({ oc }) {
  const marcar    = useMarcarItemRecepcion()
  const confirmar = useConfirmarRecepcion()
  const [comentarios, setComentarios] = useState({})

  const recepciones = oc.recepciones ?? []
  const items       = oc.cotizaciones?.cotizacion_items ?? []

  function getRec(itemId) { return recepciones.find(r => r.cot_item_id === itemId) }
  const todosMarcados = items.every(it => getRec(it.id)?.estado)

  if (oc.recepcion_confirmada) {
    const itemsProb = items.filter(it => {
      const r = getRec(it.id)
      return r && (r.estado === 'prob' || r.estado === 'rech')
    })
    return (
      <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Recepción confirmada
        </div>
        {itemsProb.map(item => {
          const rec = getRec(item.id)
          return <FilaAccionCorrectiva key={item.id} oc={oc} item={item} rec={rec} />
        })}
        {itemsProb.length === 0 && (
          <div className="px-3 py-3 text-xs text-[#28a745] font-medium">
            ✓ Recepción conforme — sin problemas reportados
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 border border-blue-100 rounded-lg overflow-hidden">
      <div className="bg-blue-50 px-3 py-2 text-xs font-semibold text-[#004a99]">
        Confirmá la recepción de mercadería
      </div>
      {items.map(item => {
        const rec    = getRec(item.id)
        const estado = rec?.estado
        return (
          <div key={item.id} className="p-3 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-900 mb-2">
              {item.productos?.nombre}
              <span className="text-xs text-gray-400 ml-2">{item.cantidad} kg/lt</span>
            </p>
            <div className="flex gap-2 flex-wrap mb-2">
              {RECEP_OPTS.map(opt => (
                <button key={opt.key}
                  onClick={() => marcar.mutate({ ocId: oc.id, cotizacionItemId: item.id, estado: opt.key, comentario: comentarios[item.id] })}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${estado === opt.key ? opt.cls + ' font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(estado === 'prob' || estado === 'rech') && (
              <input type="text" placeholder="Detalle el problema…"
                value={comentarios[item.id] ?? rec?.comentario ?? ''}
                onChange={e => setComentarios(c => ({ ...c, [item.id]: e.target.value }))}
                onBlur={() => marcar.mutate({ ocId: oc.id, cotizacionItemId: item.id, estado, comentario: comentarios[item.id] })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99] mt-1"
              />
            )}
          </div>
        )
      })}
      <div className="px-3 py-3 border-t border-gray-100 bg-gray-50">
        {!todosMarcados && (
          <p className="text-xs text-gray-400 mb-2">
            Faltan confirmar {items.filter(it => !getRec(it.id)?.estado).length} producto(s)
          </p>
        )}
        <button
          onClick={() => confirmar.mutate({ ocId: oc.id })}
          disabled={!todosMarcados || confirmar.isPending}
          className="w-full bg-[#28a745] hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {confirmar.isPending ? 'Confirmando…' : 'Confirmar recepción'}
        </button>
      </div>
    </div>
  )
}

const PAGO_CONFIG = {
  pendiente: { label: 'Pago pendiente', cls: 'bg-red-100 text-red-700 border-red-200'         },
  parcial:   { label: 'Pago parcial',   cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  pagado:    { label: 'Pagado',         cls: 'bg-green-100 text-green-700 border-green-200'    },
}
const PAGO_OPTS = ['pendiente', 'parcial', 'pagado']

function EstadoPago({ oc }) {
  const actualizar = useActualizarEstadoPago()
  const actual = oc.estado_pago ?? 'pendiente'

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Estado de pago</p>
      <div className="flex gap-2 flex-wrap">
        {PAGO_OPTS.map(opt => {
          const cfg = PAGO_CONFIG[opt]
          const isActive = actual === opt
          return (
            <button key={opt}
              onClick={() => !isActive && actualizar.mutate({ ocId: oc.id, estadoPago: opt })}
              disabled={actualizar.isPending}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                isActive ? cfg.cls + ' font-bold' : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 bg-white'
              }`}>
              {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CamposEntrega({ oc }) {
  const actualizar = useActualizarDatosOC()
  const [fecha,    setFecha]    = useState(oc.fecha_estimada_entrega ?? '')
  const [guardado, setGuardado] = useState(false)

  const dirty = fecha !== (oc.fecha_estimada_entrega ?? '')

  async function guardar() {
    await actualizar.mutateAsync({ ocId: oc.id, numeroFactura: oc.numero_factura ?? null, fechaEstimadaEntrega: fecha })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Entrega estimada</p>
      <div className="flex gap-2 items-end">
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white"
        />
        <button
          onClick={guardar}
          disabled={!dirty || actualizar.isPending}
          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            guardado
              ? 'bg-green-100 text-green-700'
              : dirty
              ? 'bg-[#004a99] text-white hover:bg-[#003d80]'
              : 'bg-gray-100 text-gray-400 cursor-default'
          } disabled:opacity-50`}
        >
          {guardado ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              Guardado
            </>
          ) : actualizar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function OCCard({ oc, isNew }) {
  const avanzar = useAvanzarEstadoOC()
  const idx     = PIPELINE.indexOf(oc.estado)
  const items   = oc.cotizaciones?.cotizacion_items ?? []

  return (
    <div className={`bg-white rounded-[10px] shadow-card p-4 ${isNew ? 'border-l-4 border-l-[#dc3545]' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-[#004a99]">{oc.numero}</span>
            {oc.referencia_cliente && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Ref: {oc.referencia_cliente}</span>
            )}
            {oc.tipo_entrega === 'retiro'
              ? <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">Retiro en fábrica</span>
              : <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Entrega a domicilio</span>
            }
            {isNew && <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">Nueva</span>}
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{oc.cotizaciones?.clientes?.razon_social}</p>
          <p className="text-xs text-gray-400">{new Date(oc.creado_en).toLocaleDateString('es-AR')}</p>
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
          <p className="font-bold text-[#004a99]">{fmtUSD(oc.cotizaciones?.total)}</p>
          <p className="text-xs text-gray-400">{items.length} ítem{items.length !== 1 ? 's' : ''}</p>
          <button
            onClick={async () => { const { generateOCPDF } = await import('../../utils/pdfGenerator'); generateOCPDF(oc) }}
            title="Descargar PDF"
            className="text-gray-400 hover:text-[#004a99] transition-colors mt-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
          </button>
        </div>
      </div>

      <PipelineBar estado={oc.estado} />

      <div className="text-xs text-gray-500 space-y-0.5 mb-3">
        {items.slice(0, 3).map(it => (
          <span key={it.id} className="inline-block bg-gray-50 px-2 py-0.5 rounded mr-1 mb-1">
            {it.productos?.nombre} · {it.cantidad} kg
          </span>
        ))}
        {items.length > 3 && <span className="text-gray-400">+{items.length - 3} más</span>}
      </div>

      {oc.numero_factura && (
        <div className="mt-3 flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span className="text-xs text-gray-400">Factura</span>
          <span className="font-mono text-xs font-semibold text-gray-800">{oc.numero_factura}</span>
        </div>
      )}

      <EstadoPago oc={oc} />
      <CamposEntrega oc={oc} />

      {idx < PIPELINE.length - 1 ? (
        idx === 0 ? (
          <button
            onClick={() => avanzar.mutate({ ocId: oc.id, estadoActual: oc.estado })}
            disabled={avanzar.isPending}
            className="flex items-center gap-1.5 mt-3 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 w-full justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            Confirmar recepción de OC
          </button>
        ) : (
          <button
            onClick={() => avanzar.mutate({ ocId: oc.id, estadoActual: oc.estado })}
            disabled={avanzar.isPending}
            className="flex items-center gap-1.5 mt-3 bg-[#004a99] hover:bg-[#003d80] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
            Pasar a: {LABELS[PIPELINE[idx + 1]]}
          </button>
        )
      ) : (
        <span className="text-xs font-semibold text-[#28a745] mt-3 block">✓ Proceso completo</span>
      )}

      {oc.estado === 'entregada' && <PanelRecepcion oc={oc} />}
    </div>
  )
}

const FILTROS_OC = ['todas', 'recibida', 'en-preparacion', 'listo-entrega', 'entregada']

export default function OrdenesCopra() {
  const { data: ordenes = [], isLoading, error } = useOrdenesVendedor()
  const [filtro, setFiltro] = useState('todas')

  const filtradas = filtro === 'todas' ? ordenes : ordenes.filter(o => o.estado === filtro)
  const nuevas    = ordenes.filter(o => o.estado === 'recibida')

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
              {filtradas.map(oc => <OCCard key={oc.id} oc={oc} isNew={oc.estado === 'recibida'} />)}
            </div>
      )}
    </div>
  )
}
