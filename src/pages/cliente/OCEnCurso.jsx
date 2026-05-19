import { useState } from 'react'
import { useOrdenesCliente, useSubirComprobantePago } from '../../hooks/useOrdenes'
import { useMarcarItemRecepcion, useConfirmarRecepcion } from '../../hooks/useRecepciones'
import { supabase } from '../../lib/supabase'

const PIPELINE = ['recibida', 'en-preparacion', 'listo-entrega', 'entregada']
const LABELS   = { recibida: 'Recibida', 'en-preparacion': 'En preparación', 'listo-entrega': 'Listo p/entrega', entregada: 'Entregada' }

const PAGO_BADGE = {
  pendiente: { label: 'Pago pendiente', cls: 'bg-red-100 text-red-700' },
  parcial:   { label: 'Pago parcial',   cls: 'bg-yellow-100 text-yellow-800' },
  pagado:    { label: 'Pagado',         cls: 'bg-green-100 text-green-700' },
}

function fmtUSD(v) {
  if (v == null) return '—'
  return 'USD ' + Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PipelineBar({ estado }) {
  const idx = PIPELINE.indexOf(estado)
  return (
    <div className="flex items-center gap-1 my-3 flex-wrap">
      {PIPELINE.map((e, i) => (
        <div key={e} className="flex items-center gap-1">
          <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
            i < idx ? 'bg-green-100 text-green-700' :
            i === idx ? 'bg-[#004a99] text-white' : 'bg-gray-100 text-gray-400'
          }`}>
            {i < idx && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            {LABELS[e]}
          </div>
          {i < PIPELINE.length - 1 && <div className={`w-3 h-0.5 ${i < idx ? 'bg-green-300' : 'bg-gray-200'}`}/>}
        </div>
      ))}
    </div>
  )
}

function BtnSubirComprobante({ ocId }) {
  const subir = useSubirComprobantePago()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try { await subir.mutateAsync({ ocId, file }) }
    finally { setUploading(false); e.target.value = '' }
  }

  return (
    <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
      uploading ? 'border-gray-200 text-gray-400' : 'border-[#004a99] text-[#004a99] hover:bg-blue-50'
    }`}>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading} onChange={handleFile}/>
      {uploading
        ? <><div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> Subiendo…</>
        : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Subir comprobante</>
      }
    </label>
  )
}

function PanelDespacho({ oc }) {
  const tieneInfo = oc.numero_factura || oc.fecha_estimada_entrega || oc.estado_pago
  if (!tieneInfo) return null
  const pago       = PAGO_BADGE[oc.estado_pago ?? 'pendiente']
  const factura    = Array.isArray(oc.facturas) ? oc.facturas[0] : oc.facturas
  const comprobante = Array.isArray(oc.comprobantes_pago) ? oc.comprobantes_pago[0] : oc.comprobantes_pago

  return (
    <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
      <p className="text-[10px] font-semibold text-[#004a99] uppercase tracking-wide">Información de despacho</p>
      <div className="flex flex-wrap gap-3 text-xs text-gray-700 items-center">
        {oc.numero_factura && (
          <span className="flex items-center gap-1">
            Factura: <span className="font-semibold">{oc.numero_factura}</span>
            {factura?.pdf_url && (
              <a href={factura.pdf_url} target="_blank" rel="noopener noreferrer"
                className="ml-1 text-[#004a99] hover:underline flex items-center gap-0.5 font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                PDF
              </a>
            )}
          </span>
        )}
        {oc.fecha_estimada_entrega && (
          <span>Entrega estimada: <span className="font-semibold">
            {new Date(oc.fecha_estimada_entrega + 'T00:00:00').toLocaleDateString('es-AR')}
          </span></span>
        )}
        {oc.estado_pago && (
          <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold text-xs ${pago.cls}`}>
            {pago.label}
          </span>
        )}
      </div>
      <div className="pt-1 border-t border-blue-100 flex items-center gap-3 flex-wrap">
        {comprobante
          ? <a href={comprobante.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-green-700 font-medium flex items-center gap-1 hover:underline">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Comprobante de pago cargado
            </a>
          : <BtnSubirComprobante ocId={oc.id}/>
        }
      </div>
    </div>
  )
}

const RECEP_OPTS = [
  { key: 'ok',   label: 'Recibido OK',    cls: 'border-[#28a745] bg-green-50 text-green-800'  },
  { key: 'prob', label: 'Hubo problemas', cls: 'border-[#ffc107] bg-yellow-50 text-yellow-800' },
  { key: 'rech', label: 'Rechazado',      cls: 'border-[#dc3545] bg-red-50 text-red-800'       },
]

function RecepcionForm({ oc }) {
  const marcar    = useMarcarItemRecepcion()
  const confirmar = useConfirmarRecepcion()

  const items      = oc.cotizaciones?.cotizacion_items ?? []
  const recepciones = oc.recepciones ?? []
  const [comentarios, setComentarios] = useState({})
  const [fotos,       setFotos]       = useState({})

  function getRecepcion(itemId) {
    return recepciones.find(r => r.cot_item_id === itemId)
  }

  const todosMarcados = items.every(it => getRecepcion(it.id)?.estado)

  async function handleFoto(e, itemId) {
    const file = e.target.files[0]
    if (!file) return
    setFotos(f => ({ ...f, [itemId]: { uploading: true } }))
    try {
      const ext  = file.name.split('.').pop()
      const path = `${oc.id}/${itemId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('reclamos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('reclamos').getPublicUrl(path)
      setFotos(f => ({ ...f, [itemId]: { url: publicUrl } }))
      const rec = getRecepcion(itemId)
      marcar.mutate({ ocId: oc.id, cotizacionItemId: itemId, estado: rec?.estado ?? 'prob', comentario: comentarios[itemId] ?? rec?.comentario, fotoUrl: publicUrl })
    } catch {
      setFotos(f => ({ ...f, [itemId]: null }))
    }
  }

  if (oc.recepcion_confirmada) {
    const hayProb      = recepciones.some(r => r.estado === 'prob' || r.estado === 'rech')
    const itemsConProb = items.filter(it => {
      const r = recepciones.find(r => r.cot_item_id === it.id)
      return r && (r.estado === 'prob' || r.estado === 'rech')
    })
    const GESTION_BADGE = {
      pendiente:  { label: 'Sin respuesta', cls: 'bg-red-100 text-red-700' },
      en_gestion: { label: 'En gestión',   cls: 'bg-yellow-100 text-yellow-800' },
      resuelto:   { label: 'Resuelto',     cls: 'bg-green-100 text-green-700' },
    }
    return (
      <div className={`mt-3 rounded-lg border overflow-hidden ${hayProb ? 'border-yellow-200' : 'border-green-200'}`}>
        <div className={`px-3 py-2 text-sm font-medium ${hayProb ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-800'}`}>
          {hayProb ? '⚠ Recepción con observaciones' : '✓ Recepción confirmada — sin problemas'}
        </div>
        {itemsConProb.map(it => {
          const rec    = recepciones.find(r => r.cot_item_id === it.id)
          const badge  = GESTION_BADGE[rec?.estado_gestion ?? 'pendiente']
          return (
            <div key={it.id} className="p-3 border-t border-yellow-100">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rec.estado === 'rech' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                  {rec.estado === 'rech' ? 'Rechazado' : 'Con problemas'}
                </span>
                <span className="text-sm font-medium text-gray-800">{it.productos?.nombre}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
              </div>
              {rec?.comentario && <p className="text-xs text-gray-500 italic">Tu reporte: "{rec.comentario}"</p>}
              {rec?.foto_url && (
                <a href={rec.foto_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5">
                  <img src={rec.foto_url} alt="Foto adjunta" className="h-16 w-16 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"/>
                </a>
              )}
              {rec?.accion_correctiva && (
                <p className="text-xs text-gray-700 mt-1.5 bg-white border border-gray-100 rounded px-2 py-1.5">
                  <span className="font-semibold text-[#004a99]">Respuesta del vendedor: </span>
                  {rec.accion_correctiva}
                </p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mt-3 border border-blue-100 rounded-lg overflow-hidden">
      <div className="bg-blue-50 px-3 py-2 text-xs font-semibold text-[#004a99]">
        Confirmá la recepción de cada producto
      </div>
      {items.map(item => {
        const rec    = getRecepcion(item.id)
        const estado = rec?.estado
        const foto   = fotos[item.id]
        const fotoUrl = foto?.url ?? rec?.foto_url
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
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${estado === opt.key ? opt.cls + ' font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {(estado === 'prob' || estado === 'rech') && (
              <div className="space-y-1.5">
                <input type="text" placeholder="Detalle el problema…"
                  value={comentarios[item.id] ?? rec?.comentario ?? ''}
                  onChange={e => setComentarios(c => ({...c, [item.id]: e.target.value}))}
                  onBlur={() => marcar.mutate({ ocId: oc.id, cotizacionItemId: item.id, estado, comentario: comentarios[item.id] })}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
                />
                {fotoUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={fotoUrl} target="_blank" rel="noopener noreferrer">
                      <img src={fotoUrl} alt="Foto adjunta" className="h-14 w-14 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"/>
                    </a>
                    <span className="text-[10px] text-gray-400">Foto adjunta</span>
                  </div>
                ) : (
                  <label className="flex items-center gap-1.5 cursor-pointer w-fit">
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFoto(e, item.id)}/>
                    <span className={`text-xs border border-dashed rounded px-2.5 py-1 transition-colors ${foto?.uploading ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-500 hover:border-[#004a99] hover:text-[#004a99]'}`}>
                      {foto?.uploading ? 'Subiendo…' : '📷 Adjuntar foto'}
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>
        )
      })}
      <div className="px-3 py-3 border-t border-gray-100 bg-gray-50">
        {!todosMarcados && <p className="text-xs text-gray-400 mb-2">Faltan confirmar {items.filter(it => !getRecepcion(it.id)?.estado).length} producto(s)</p>}
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

function OCCard({ oc }) {
  const [expandido, setExpandido] = useState(false)
  const items = oc.cotizaciones?.cotizacion_items ?? []

  return (
    <div className="bg-white rounded-[10px] shadow-card p-4">
      <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpandido(e => !e)}>
        <div>
          <p className="font-mono font-bold text-[#004a99]">{oc.numero}</p>
          {oc.referencia_cliente && <p className="text-xs text-gray-400">Ref: {oc.referencia_cliente}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{new Date(oc.creado_en).toLocaleDateString('es-AR')} · {items.length} ítems</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className="font-bold text-[#004a99]">{fmtUSD(oc.cotizaciones?.total)}</p>
          <button
            onClick={e => { e.stopPropagation(); import('../../utils/pdfGenerator').then(m => m.generateOCPDF(oc)) }}
            title="Descargar PDF"
            className="p-1.5 text-gray-300 hover:text-[#004a99] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
          </button>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandido ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      <PipelineBar estado={oc.estado} />
      <PanelDespacho oc={oc} />

      {expandido && (
        <>
          <div className="text-xs text-gray-500 space-y-0.5 mb-2">
            {items.map(it => (
              <div key={it.id} className="flex justify-between py-0.5">
                <span>{it.productos?.nombre}</span>
                <span className="font-medium">{it.cantidad} kg · {fmtUSD(it.subtotal)}</span>
              </div>
            ))}
          </div>
          {oc.estado === 'entregada' && <RecepcionForm oc={oc} />}
        </>
      )}
    </div>
  )
}

export default function OCEnCurso() {
  const { data: ordenes = [], isLoading } = useOrdenesCliente()
  const enCurso = ordenes.filter(o => !o.recepcion_confirmada)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">OC en Curso</h1>
        <p className="text-sm text-gray-400 mt-0.5">{isLoading ? 'Cargando…' : `${enCurso.length} órdenes en proceso`}</p>
      </div>
      {isLoading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>}
      {!isLoading && enCurso.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No hay órdenes en curso.</div>}
      {!isLoading && <div className="space-y-3 max-w-2xl">{enCurso.map(oc => <OCCard key={oc.id} oc={oc}/>)}</div>}
    </div>
  )
}
