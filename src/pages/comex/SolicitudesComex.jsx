import { useState, useMemo } from 'react'
import { usePedidosComex, useGuardarCostosComex, usePreciosExpo } from '../../hooks/useExpo'
import { labelApilable, ENVASE_LABELS } from '../../lib/dimensionamiento'
import DimTree, { splitNotas, PackingManual } from '../../components/DimTree'

const ESTADO_BADGE = {
  pendiente_comex: { text: 'Pendiente',  color: 'bg-amber-50 text-amber-700' },
  cotizado:        { text: 'Enviado',    color: 'bg-blue-50 text-blue-700' },
  aprobado:        { text: 'Aprobado',   color: 'bg-green-50 text-green-700' },
  cancelado:       { text: 'Cancelado',  color: 'bg-red-50 text-red-600' },
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white'
const INPUT_SM = 'w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white text-right'


function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—'
  return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtKg(n) {
  if (n == null) return '—'
  return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Imprimir ──────────────────────────────────────────────────────────────────

function imprimirCotizacion(pedido) {
  const items    = pedido.pedidos_expo_items ?? []
  const totalUsd = items.reduce((s, it) => s + (parseFloat(it.subtotal_usd) || 0), 0)
  const flete    = parseFloat(pedido.flete_usd) || 0
  const seguro   = parseFloat(pedido.seguro_usd) || 0
  const otros    = parseFloat(pedido.otros_gastos_usd) || 0
  const extras   = flete + seguro + otros

  const filas = items.map(it => {
    const envLabel = it.tipo_envase ? (ENVASE_LABELS[it.tipo_envase] || it.tipo_envase) : '—'
    const cap = (it.tipo_envase === 'tambor' || it.tipo_envase === 'tambor_bin') && it.capacidad_tambor
      ? ` ${it.capacidad_tambor} kg` : ''
    return `<tr>
      <td>${it.producto_nombre ?? '—'}</td>
      <td>${envLabel}${cap}</td>
      <td style="text-align:right">${fmtKg(it.cantidad_kg)}</td>
      <td style="text-align:right">${it.precio_usd ? fmt(it.precio_usd, 4) : '—'}</td>
      <td style="text-align:right">${it.subtotal_usd ? fmt(it.subtotal_usd) : '—'}</td>
      <td style="text-align:right">${it.cantidad_envases ?? '—'}</td>
      <td style="text-align:right">${it.peso_bruto ? fmtKg(it.peso_bruto) : '—'}</td>
    </tr>`
  }).join('')

  const costos = extras > 0 ? `
    <div class="costos">
      <p class="costos-title">Costos de exportación</p>
      <div class="costos-row">
        ${flete  > 0 ? `<div class="costo-item"><span>Flete</span><strong>USD ${fmt(flete)}</strong></div>` : ''}
        ${seguro > 0 ? `<div class="costo-item"><span>Seguro</span><strong>USD ${fmt(seguro)}</strong></div>` : ''}
        ${otros  > 0 ? `<div class="costo-item"><span>Otros gastos</span><strong>USD ${fmt(otros)}</strong></div>` : ''}
        <div class="costo-item"><span>Total costos</span><strong>USD ${fmt(extras)}</strong></div>
      </div>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cotización EXPO ${pedido.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #222; font-size: 13px; }
    h1 { color: #004a99; margin-bottom: 4px; font-size: 20px; }
    .meta { color: #666; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #e8f0fa; color: #004a99; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
    td { border-bottom: 1px solid #eee; padding: 7px 10px; }
    tfoot td { border-top: 2px solid #ccc; font-weight: bold; }
    .dim { margin-top: 24px; background: #f7f9fc; border: 1px solid #dde; padding: 12px 16px; border-radius: 6px; font-size: 12px; }
    .dim-row { display: flex; gap: 32px; flex-wrap: wrap; }
    .dim-item { display: flex; flex-direction: column; }
    .dim-item span:first-child { color: #888; font-size: 11px; }
    .dim-item span:last-child { font-weight: bold; }
    .costos { margin-top: 16px; background: #fff8e1; border: 1px solid #ffe082; padding: 12px 16px; border-radius: 6px; font-size: 12px; }
    .costos-title { font-weight: bold; color: #b45309; margin-bottom: 8px; }
    .costos-row { display: flex; gap: 32px; flex-wrap: wrap; }
    .costo-item { display: flex; flex-direction: column; }
    .costo-item span { color: #888; font-size: 11px; }
    .costo-item strong { font-size: 13px; }
    .obs { margin-top: 20px; font-size: 12px; color: #555; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Cotización de Exportación</h1>
  <p class="meta"><strong>${pedido.numero}</strong> &nbsp;·&nbsp; ${new Date(pedido.creado_en).toLocaleDateString('es-AR')}</p>
  <p class="meta">Cliente: <strong>${pedido.cliente_nombre}</strong>${pedido.pais_destino ? ' &nbsp;—&nbsp; ' + pedido.pais_destino : ''}</p>
  <p class="meta">Incoterm: <strong>${pedido.incoterm ?? '—'}</strong>${pedido.puerto_descarga ? ' &nbsp;→&nbsp; Puerto: <strong>' + pedido.puerto_descarga + '</strong>' : ''} &nbsp;·&nbsp; Vendedor: ${pedido.creado_por_perfil?.nombre ?? '—'}</p>

  <table>
    <thead>
      <tr>
        <th>Producto</th><th>Presentación</th>
        <th style="text-align:right">Cant. (kg)</th>
        <th style="text-align:right">USD/kg</th>
        <th style="text-align:right">Subtotal USD</th>
        <th style="text-align:right">Envases</th>
        <th style="text-align:right">Kg bruto</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total</td>
        <td style="text-align:right">USD ${fmt(totalUsd)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  ${costos}

  <div class="dim">
    <div class="dim-row">
      <div class="dim-item"><span>Total pallets</span><span>${pedido.cantidad_pallets ?? '—'}</span></div>
      <div class="dim-item"><span>Peso neto total</span><span>${pedido.peso_neto ? fmtKg(pedido.peso_neto) + ' kg' : '—'}</span></div>
      <div class="dim-item"><span>Peso bruto total</span><span>${pedido.peso_bruto ? fmtKg(pedido.peso_bruto) + ' kg' : '—'}</span></div>
      <div class="dim-item"><span>Apilable</span><span>${pedido.apilable ?? '—'}</span></div>
    </div>
  </div>

  ${pedido.notas_vendedor   ? `<p class="obs"><strong>Observaciones:</strong> ${pedido.notas_vendedor}</p>` : ''}
  ${pedido.notas_produccion ? `<p class="obs"><strong>Nota de Producción:</strong> ${pedido.notas_produccion}</p>` : ''}
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const LISTAS = [
  { key: 'lista1_may', label: 'L1',  title: 'Lista 1 · Mayorista' },
  { key: 'lista4_std', label: 'L4',  title: 'Lista 4 · Estándar'  },
  { key: 'lista3_min', label: 'L3',  title: 'Lista 3 · Minorista' },
]

function fmtPrecio(n) {
  if (n == null) return null
  return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

function ModalPedido({ pedido, onClose }) {
  const guardar = useGuardarCostosComex()

  const items     = pedido.pedidos_expo_items ?? []
  const totalKg   = items.reduce((s, it) => s + (parseFloat(it.cantidad_kg) || 0), 0)
  const esPendiente = pedido.estado === 'pendiente_comex'

  // Precios del listado local
  const productoIds = useMemo(
    () => [...new Set(items.map(it => it.producto_id).filter(Boolean))],
    [items]
  )
  const { data: preciosLista = {} } = usePreciosExpo(productoIds)

  // Estado del formulario (solo para pendiente)
  const [precios, setPrecios] = useState(() =>
    Object.fromEntries(items.map(it => [it.id, it.precio_usd != null ? String(it.precio_usd) : '']))
  )
  const [flete,   setFlete]   = useState(pedido.flete_usd        != null ? String(pedido.flete_usd)        : '')
  const [seguro,  setSeguro]  = useState(pedido.seguro_usd       != null ? String(pedido.seguro_usd)       : '')
  const [otros,   setOtros]   = useState(pedido.otros_gastos_usd != null ? String(pedido.otros_gastos_usd) : '')
  const [err,     setErr]     = useState('')

  // Prorratio
  const totalExtras = (parseFloat(flete) || 0) + (parseFloat(seguro) || 0) + (parseFloat(otros) || 0)
  const extraPerKg  = totalKg > 0 ? totalExtras / totalKg : 0

  function getPrecioBase(id) { return parseFloat(precios[id]) || 0 }
  function getPrecioFinal(it) { return getPrecioBase(it.id) + extraPerKg }
  function getSubtotalFinal(it) { return getPrecioFinal(it) * (parseFloat(it.cantidad_kg) || 0) }

  const totalBase     = items.reduce((s, it) => s + getPrecioBase(it.id) * (parseFloat(it.cantidad_kg) || 0), 0)
  const totalCotizado = totalBase + totalExtras

  // Read-only: precios ya guardados
  const totalGuardado = items.reduce((s, it) => s + (parseFloat(it.subtotal_usd) || 0), 0)
  const extrasGuardados = (parseFloat(pedido.flete_usd) || 0) + (parseFloat(pedido.seguro_usd) || 0) + (parseFloat(pedido.otros_gastos_usd) || 0)

  async function handleEnviar() {
    setErr('')
    try {
      await guardar.mutateAsync({
        pedidoId:       pedido.id,
        fleteUsd:       flete,
        seguroUsd:      seguro,
        otrosGastosUsd: otros,
        items: items.map(it => ({
          id:          it.id,
          cantidad_kg: it.cantidad_kg,
          precio_base: parseFloat(precios[it.id]) || 0,
        })),
      })
      onClose()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-[10px] shadow-lg w-full max-w-3xl my-8">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{pedido.numero}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {pedido.cliente_nombre}{pedido.pais_destino ? ` — ${pedido.pais_destino}` : ''}
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="font-semibold text-[#004a99]">{pedido.incoterm ?? '—'}</span>
              {pedido.puerto_descarga && (
                <><span className="mx-1 text-gray-300">→</span>{pedido.puerto_descarga}</>
              )}
              <span className="mx-1.5 text-gray-300">·</span>
              {pedido.creado_por_perfil?.nombre ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* ── Precios base por producto ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {esPendiente ? 'Precio base por producto (USD/kg)' : 'Productos'}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left pb-2 font-medium">Producto</th>
                  <th className="text-left pb-2 font-medium w-24">Presentación</th>
                  <th className="text-right pb-2 font-medium w-24">Cant. (kg)</th>
                  <th className="text-right pb-2 font-medium w-28">
                    {esPendiente ? 'Precio base' : 'USD/kg'}
                  </th>
                  <th className="text-right pb-2 font-medium w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(it => {
                  const envLabel = it.tipo_envase ? (ENVASE_LABELS[it.tipo_envase] || it.tipo_envase) : '—'
                  const cap = (it.tipo_envase === 'tambor' || it.tipo_envase === 'tambor_bin') && it.capacidad_tambor
                    ? ` ${it.capacidad_tambor}kg` : ''
                  return (
                    <tr key={it.id}>
                      <td className="py-2 text-gray-800 font-medium">{it.producto_nombre}</td>
                      <td className="py-2 text-gray-400 text-xs">{envLabel}{cap}</td>
                      <td className="py-2 text-right text-gray-600">{fmtKg(it.cantidad_kg)}</td>
                      <td className="py-2 text-right">
                        {esPendiente ? (
                          <div className="flex flex-col items-end gap-1">
                            {/* Botones de lista de precios */}
                            {it.producto_id && preciosLista[it.producto_id] && (
                              <div className="flex gap-1">
                                {LISTAS.map(({ key, label, title }) => {
                                  const val = preciosLista[it.producto_id]?.[key]
                                  if (val == null) return null
                                  const activo = precios[it.id] === String(val)
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      title={`${title}: USD ${fmtPrecio(val)}`}
                                      onClick={() => setPrecios(p => ({ ...p, [it.id]: String(val) }))}
                                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${
                                        activo
                                          ? 'bg-[#004a99] text-white border-[#004a99]'
                                          : 'border-gray-200 text-gray-500 hover:border-[#004a99] hover:text-[#004a99]'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            <input
                              type="number" min="0" step="0.0001"
                              value={precios[it.id]}
                              onChange={e => setPrecios(p => ({ ...p, [it.id]: e.target.value }))}
                              placeholder="0.0000"
                              className={INPUT_SM + ' w-28'}
                            />
                          </div>
                        ) : (
                          <span className="text-gray-600">
                            {it.precio_usd ? `USD ${fmt(it.precio_usd, 4)}` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-medium text-gray-700">
                        {esPendiente
                          ? (getPrecioBase(it.id) > 0 ? `USD ${fmt(getPrecioBase(it.id) * (parseFloat(it.cantidad_kg) || 0))}` : '—')
                          : (it.subtotal_usd ? `USD ${fmt(it.subtotal_usd)}` : '—')
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Costos de exportación ── */}
          {esPendiente ? (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Costos de exportación (prorrateo por kg)
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Flete (USD)', flete, setFlete],
                  ['Seguro (USD)', seguro, setSeguro],
                  ['Otros gastos (USD)', otros, setOtros],
                ].map(([label, val, setter]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-600 mb-1">{label}</p>
                    <input
                      type="number" min="0" step="0.01"
                      value={val}
                      onChange={e => setter(e.target.value)}
                      placeholder="0.00"
                      className={INPUT}
                    />
                  </div>
                ))}
              </div>

              {/* Preview de prorrateo */}
              {totalExtras > 0 && (
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Precios finales con prorrateo
                    <span className="ml-2 font-normal text-amber-700 normal-case">
                      +USD {fmt(extraPerKg, 4)}/kg
                    </span>
                  </p>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-50">
                      {items.map(it => (
                        <tr key={it.id}>
                          <td className="py-1.5 text-gray-700">{it.producto_nombre}</td>
                          <td className="py-1.5 text-right text-gray-400">
                            {getPrecioBase(it.id) > 0
                              ? `${fmt(getPrecioBase(it.id), 4)} + ${fmt(extraPerKg, 4)}`
                              : `0 + ${fmt(extraPerKg, 4)}`}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-[#004a99] w-28">
                            = USD {fmt(getPrecioFinal(it), 4)}/kg
                          </td>
                          <td className="py-1.5 text-right font-medium text-gray-700 w-28">
                            USD {fmt(getSubtotalFinal(it))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Resumen total */}
              <div className="flex items-center justify-between pt-1 text-sm">
                <span className="text-gray-500">
                  Base: <strong>USD {fmt(totalBase)}</strong>
                  {totalExtras > 0 && <> + Extras: <strong>USD {fmt(totalExtras)}</strong></>}
                </span>
                <span className="font-bold text-gray-900 text-base">
                  Total: USD {fmt(totalCotizado)}
                </span>
              </div>
            </div>
          ) : extrasGuardados > 0 ? (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Costos de exportación incluidos</p>
              <div className="flex gap-6 text-sm text-amber-700">
                {pedido.flete_usd        > 0 && <span>Flete: <strong>USD {fmt(pedido.flete_usd)}</strong></span>}
                {pedido.seguro_usd       > 0 && <span>Seguro: <strong>USD {fmt(pedido.seguro_usd)}</strong></span>}
                {pedido.otros_gastos_usd > 0 && <span>Otros: <strong>USD {fmt(pedido.otros_gastos_usd)}</strong></span>}
              </div>
              <p className="text-xs text-amber-600 mt-1.5">
                Total cotizado: <strong>USD {fmt(totalGuardado)}</strong>
              </p>
            </div>
          ) : null}

          {/* ── Dimensionamiento ── */}
          {(() => {
            const { packing, other } = splitNotas(pedido.notas_produccion)
            return (
              <>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Dimensionamiento de carga
                  </p>
                  {packing
                    ? <PackingManual text={packing}/>
                    : <DimTree items={items}/>
                  }
                </div>

                {pedido.notas_vendedor && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observaciones del vendedor</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{pedido.notas_vendedor}</p>
                  </div>
                )}

                {other && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Nota de Producción</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{other}</p>
                  </div>
                )}
              </>
            )
          })()}

          {err && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
          <button onClick={() => imprimirCotizacion(pedido)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Imprimir / Exportar
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cerrar
            </button>
            {esPendiente && (
              <button onClick={handleEnviar} disabled={guardar.isPending}
                className="px-5 py-2 text-sm font-semibold bg-[#004a99] text-white rounded-lg hover:bg-[#003d80] disabled:opacity-50 flex items-center gap-2 transition-colors">
                {guardar.isPending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Enviar cotización al vendedor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function SolicitudesComex() {
  const { data: pedidos = [], isLoading, error } = usePedidosComex()
  const [tab, setTab]     = useState('pendiente')
  const [modal, setModal] = useState(null)

  const pendientes = pedidos.filter(p => p.estado === 'pendiente_comex')
  const historial  = pedidos.filter(p => p.estado !== 'pendiente_comex')
  const lista      = tab === 'pendiente' ? pendientes : historial

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Solicitudes COMEX</h1>
        <p className="text-sm text-gray-400 mt-0.5">Cotizaciones de exportación para revisar y enviar</p>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['pendiente', `Pendientes (${pendientes.length})`], ['historial', `Historial (${historial.length})`]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === v ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Error al cargar: {error.message}
        </div>
      )}

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : lista.length === 0
          ? <div className="p-12 text-center text-sm text-gray-400">
              {tab === 'pendiente' ? 'No hay solicitudes pendientes' : 'Sin historial aún'}
            </div>
          : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nº</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Vendedor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">País</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Incoterm</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Kg brutos</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total USD</th>
                {tab !== 'pendiente' && <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Estado</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Fecha</th>
                <th className="w-20"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lista.map(p => {
                const totalUsd = (p.pedidos_expo_items ?? []).reduce((s, it) => s + (parseFloat(it.subtotal_usd) || 0), 0)
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.numero}</td>
                    <td className="px-4 py-3 text-gray-700">{p.creado_por_perfil?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.cliente_nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{p.pais_destino || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[#004a99]">{p.incoterm}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.peso_bruto != null ? `${fmtKg(p.peso_bruto)} kg` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{totalUsd > 0 ? `USD ${fmt(totalUsd)}` : '—'}</td>
                    {tab !== 'pendiente' && (
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ESTADO_BADGE[p.estado]?.color}`}>
                          {ESTADO_BADGE[p.estado]?.text}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.creado_en).toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setModal(p)}
                        className="text-sm font-semibold text-[#004a99] hover:underline">
                        {tab === 'pendiente' ? 'Cotizar' : 'Ver'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && <ModalPedido pedido={modal} onClose={() => setModal(null)}/>}
    </div>
  )
}
