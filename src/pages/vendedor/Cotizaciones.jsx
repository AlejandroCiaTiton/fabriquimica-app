import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCotizaciones, useCotizacion, useAceptarCotizacion, useAprobarCotizacion, useCancelarCotizacion, useCerrarCotizacionPerdida } from '../../hooks/useCotizaciones'
import { supabase } from '../../lib/supabase'

const ESTADOS = {
  espera:    { label: 'En espera',  bg: 'bg-yellow-100',  text: 'text-yellow-800' },
  revision:  { label: 'Revisión',   bg: 'bg-orange-100',  text: 'text-orange-800' },
  ganada:    { label: 'Ganada',     bg: 'bg-green-100',   text: 'text-green-800'  },
  parcial:   { label: 'Parcial',    bg: 'bg-blue-100',    text: 'text-blue-800'   },
  perdida:   { label: 'Perdida',    bg: 'bg-red-100',     text: 'text-red-700'    },
  borrador:  { label: 'Borrador',   bg: 'bg-gray-100',    text: 'text-gray-600'   },
  cancelada: { label: 'Cancelada',  bg: 'bg-gray-100',    text: 'text-gray-400'   },
}

function Badge({ estado }) {
  const e = ESTADOS[estado] ?? { label: estado, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.bg} ${e.text}`}>
      {e.label}
    </span>
  )
}

const FILTROS = ['todos', 'borrador', 'espera', 'revision', 'ganada', 'perdida', 'cancelada']

function fmtUSD(v) {
  if (v == null) return '—'
  return 'USD ' + Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Modal gestión de cotización ─────────────────────────────────────────────

function ModalGestion({ cotId, onClose }) {
  const { data: cot, isLoading } = useCotizacion(cotId)
  const aceptar = useAceptarCotizacion()
  const cerrar  = useCerrarCotizacionPerdida()

  const [refCliente,  setRefCliente]  = useState('')
  const [tipoEntrega, setTipoEntrega] = useState('entrega')
  const [ocGenerada,  setOcGenerada]  = useState(null)
  const [err,         setErr]         = useState('')

  async function handleAceptar() {
    setErr('')
    try {
      const oc = await aceptar.mutateAsync({ cotizacionId: cotId, referenciaCliente: refCliente, tipoEntrega })
      setOcGenerada(oc)
    } catch (e) {
      setErr(e.message)
    }
  }

  async function handleRechazar() {
    if (!confirm('¿Rechazar esta cotización?')) return
    await cerrar.mutateAsync({ cotizacionId: cotId })
    onClose()
  }

  const items    = cot?.cotizacion_items ?? []
  const subtotal = cot?.subtotal ?? items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0)
  const iva      = cot?.iva      ?? subtotal * 0.21
  const total    = cot?.total    ?? subtotal + iva

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-mono font-bold text-[#004a99]">{cot?.codigo ?? '…'}</p>
            <p className="text-sm text-gray-500">{cot?.clientes?.razon_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : ocGenerada ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p className="font-semibold text-gray-900">OC generada</p>
              <p className="font-mono font-bold text-[#004a99] text-lg">{ocGenerada.numero}</p>
              <p className="text-sm text-gray-500">Ya aparece en Órdenes de Compra para su seguimiento.</p>
              <button onClick={onClose}
                className="mt-2 px-5 py-2 bg-[#004a99] text-white rounded-lg text-sm hover:bg-[#003d80]">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {/* Tabla de ítems */}
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">Producto</th>
                    <th className="text-right py-2 font-medium text-gray-500 w-20">Cant.</th>
                    <th className="text-right py-2 font-medium text-gray-500 w-28">P. unitario</th>
                    <th className="text-right py-2 font-medium text-gray-500 w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(it => (
                    <tr key={it.id}>
                      <td className="py-2.5">
                        <p className="font-medium text-gray-900 leading-snug">{it.productos?.nombre}</p>
                        <p className="text-xs text-gray-400">{it.productos?.presentacion} · {it.productos?.codigo}</p>
                      </td>
                      <td className="py-2.5 text-right text-gray-700">{it.cantidad} kg</td>
                      <td className="py-2.5 text-right text-gray-700">{fmtUSD(it.precio_unitario)}</td>
                      <td className="py-2.5 text-right font-medium text-gray-800">{fmtUSD(it.precio_unitario * it.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totales */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 mb-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>{fmtUSD(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>IVA 21%</span><span>{fmtUSD(iva)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total</span><span className="text-[#004a99]">{fmtUSD(total)}</span>
                </div>
              </div>

              {/* Tipo de entrega */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de entrega</label>
                <div className="flex gap-2">
                  {[['entrega', 'Entrega a domicilio'], ['retiro', 'Retiro en fábrica']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setTipoEntrega(v)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        tipoEntrega === v
                          ? 'bg-[#004a99] text-white border-[#004a99]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Referencia cliente (opcional) */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Referencia / N° de OC del cliente (opcional)
                </label>
                <input
                  type="text"
                  value={refCliente}
                  onChange={e => setRefCliente(e.target.value)}
                  placeholder="Ej: OC-2024-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
                />
              </div>

              {err && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{err}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!ocGenerada && !isLoading && (
          <div className="px-5 py-4 border-t border-gray-100 flex justify-between gap-3">
            <button
              onClick={handleRechazar}
              disabled={cerrar.isPending}
              className="text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Rechazar cotización
            </button>
            <button
              onClick={handleAceptar}
              disabled={aceptar.isPending}
              className="flex items-center gap-2 bg-[#28a745] hover:bg-[#218838] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {aceptar.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              Generar OC
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

async function descargarCotPDF(cotId) {
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('id, codigo, estado, subtotal, iva, total, moneda, validez_dias, observaciones, creado_en, clientes(razon_social, cuit), vendedores(perfiles(nombre)), cotizacion_items(id, cantidad, precio_unitario, subtotal, productos(codigo, nombre, presentacion))')
    .eq('id', cotId)
    .single()
  if (error || !data) return
  const { generateCotizacionPDF } = await import('../../utils/pdfGenerator')
  generateCotizacionPDF(data)
}

export default function Cotizaciones() {
  const { data: cotizaciones = [], isLoading, error } = useCotizaciones()
  const aprobar   = useAprobarCotizacion()
  const cancelar  = useCancelarCotizacion()
  const cerrar    = useCerrarCotizacionPerdida()
  const [filtro, setFiltro] = useState('todos')
  const [selectedCotId, setSelectedCotId] = useState(null)
  const navigate = useNavigate()

  function handleAprobar(cot) {
    aprobar.mutate({ cotizacionId: cot.id, solicitudId: cot.solicitud_id })
  }

  function handleCancelar(cot) {
    if (!confirm(`¿Cancelar la cotización ${cot.codigo}? La solicitud volverá a estado pendiente.`)) return
    cancelar.mutate({ cotizacionId: cot.id, solicitudId: cot.solicitud_id })
  }

  function handleCerrarPerdida(cot) {
    if (!confirm(`¿Cerrar la cotización ${cot.codigo} como perdida?`)) return
    cerrar.mutate({ cotizacionId: cot.id })
  }

  const filtradas = filtro === 'todos'
    ? cotizaciones
    : cotizaciones.filter(c => c.estado === filtro)

  const pendientes = cotizaciones.filter(c => c.estado === 'espera' || c.estado === 'revision').length
  const borradores = cotizaciones.filter(c => c.estado === 'borrador').length

  return (
    <div className="p-6">
      {selectedCotId && (
        <ModalGestion cotId={selectedCotId} onClose={() => setSelectedCotId(null)} />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? 'Cargando…' : `${cotizaciones.length} cotizaciones`}
            {borradores > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· {borradores} para revisar</span>
            )}
            {pendientes > 0 && (
              <span className="ml-2 text-[#ffc107] font-medium">· {pendientes} en espera</span>
            )}
          </p>
        </div>
        <Link
          to="/vendedor/nueva-cotizacion"
          className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva cotización
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              filtro === f
                ? 'bg-[#004a99] text-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {f === 'todos' ? 'Todos' : ESTADOS[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {error && (
          <p className="p-6 text-center text-[#dc3545] text-sm">Error: {error.message}</p>
        )}
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
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Vence</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Total</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-32">Estado</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {filtro === 'todos' ? 'No hay cotizaciones aún.' : `No hay cotizaciones en estado "${ESTADOS[filtro]?.label}".`}
                  </td>
                </tr>
              ) : (
                filtradas.map(cot => (
                  <tr key={cot.id} className={`hover:bg-blue-50/40 transition-colors ${cot.estado === 'revision' ? 'border-l-4 border-l-orange-400' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#004a99]">
                      {cot.codigo}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cot.clientes?.razon_social ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {cot.creado_en
                        ? new Date(cot.creado_en).toLocaleDateString('es-AR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {cot.vencimiento
                        ? new Date(cot.vencimiento + 'T00:00:00').toLocaleDateString('es-AR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {cot.total != null
                        ? `USD ${Number(cot.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge estado={cot.estado} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-end gap-2">
                        {cot.estado === 'borrador' && (
                          <>
                            <button
                              onClick={() => handleAprobar(cot)}
                              disabled={aprobar.isPending}
                              title="Enviar al cliente"
                              className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-full transition-colors disabled:opacity-50"
                            >
                              Enviar al cliente
                            </button>
                            <button
                              onClick={() => navigate(`/vendedor/nueva-cotizacion?recotizar=${cot.id}`)}
                              title="Modificar precios"
                              className="text-xs font-semibold text-[#004a99] bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
                            >
                              Modificar
                            </button>
                            <button
                              onClick={() => handleCancelar(cot)}
                              title="Rechazar"
                              className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-full transition-colors"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {cot.estado === 'espera' && (
                          <>
                            <button
                              onClick={() => setSelectedCotId(cot.id)}
                              title="Gestionar cotización"
                              className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-full transition-colors"
                            >
                              Gestionar
                            </button>
                            <button
                              onClick={() => navigate(`/vendedor/nueva-cotizacion?recotizar=${cot.id}`)}
                              title="Modificar"
                              className="text-xs font-semibold text-[#004a99] bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
                            >
                              Modificar
                            </button>
                            <button
                              onClick={() => handleCancelar(cot)}
                              title="Cancelar"
                              className="text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full transition-colors"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {cot.estado === 'revision' && (
                          <>
                            <button
                              onClick={() => navigate(`/vendedor/nueva-cotizacion?recotizar=${cot.id}`)}
                              title="Re-cotizar"
                              className="text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-full transition-colors"
                            >
                              Re-cotizar
                            </button>
                            <button
                              onClick={() => handleCerrarPerdida(cot)}
                              title="Cerrar como perdida"
                              className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-full transition-colors"
                            >
                              Cerrar
                            </button>
                          </>
                        )}
                        <button onClick={() => descargarCotPDF(cot.id)} title="Descargar PDF"
                          className="text-gray-400 hover:text-[#004a99] transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
