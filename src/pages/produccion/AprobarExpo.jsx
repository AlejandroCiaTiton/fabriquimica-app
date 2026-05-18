import { useState, useMemo } from 'react'
import {
  usePedidosExpoProduccion,
  useAprobarDimensionamiento,
  useRechazarDimensionamiento,
} from '../../hooks/useExpo'
import { CAPS_TAMBOR } from '../../lib/dimensionamiento'
import DimTree from '../../components/DimTree'

function fmt(n, dec = 0) {
  if (n == null) return '—'
  return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: dec })
}

const INPUT_S  = 'text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#004a99]'
const SELECT_S = 'text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#004a99] bg-white'

// kg neto por unidad de cada tipo de envase
const TIPO_META = {
  bin:    { kgUnit: 1000, tara: 65  },
  tambor: { kgUnit: null, tara: 25  },  // kgUnit varía según capacidad
  bolsa:  { kgUnit: 25,   tara: 0.3 },
  bidon:  { kgUnit: 25,   tara: 2   },
}

const TIPOS_PACKING = [
  { value: 'bin',    label: 'Bin IBC'    },
  { value: 'tambor', label: 'Tambor'     },
  { value: 'bolsa',  label: 'Bolsa 25 kg' },
  { value: 'bidon',  label: 'Bidón 25 L' },
]

function kgNetoRow(row) {
  if (row.tipoEnvase === 'tambor') return (row.capacidadTambor ?? 200) * (row.cantidad || 0)
  return (TIPO_META[row.tipoEnvase]?.kgUnit ?? 0) * (row.cantidad || 0)
}

function kgBrutoRow(row) {
  const neto = kgNetoRow(row)
  const tara = TIPO_META[row.tipoEnvase]?.tara ?? 0
  return neto + tara * (row.cantidad || 0)
}

function buildPackingText(pallets) {
  if (!pallets?.length) return ''
  return 'DISTRIBUCIÓN DE PALLETS:\n' + pallets.map((rows, i) => {
    const contenido = rows
      .filter(r => r.cantidad > 0)
      .map(r => {
        const label = TIPOS_PACKING.find(t => t.value === r.tipoEnvase)?.label ?? r.tipoEnvase
        const cap   = r.tipoEnvase === 'tambor' ? ` ${r.capacidadTambor ?? 200} kg` : ''
        return `${r.productoNombre} — ${r.cantidad}×${label}${cap}`
      })
      .join(', ')
    return `Pallet ${i + 1}: ${contenido}`
  }).join('\n')
}

// ── Resumen de distribución manual ────────────────────────────────────────────

function ResumenCustom({ pallets }) {
  const allRows    = pallets.flat()
  const bines      = allRows.filter(r => r.tipoEnvase === 'bin').reduce((s, r) => s + (r.cantidad || 0), 0)
  const nPallets   = pallets.length
  const totalNeto  = allRows.reduce((s, r) => s + kgNetoRow(r),  0)
  const totalBruto = allRows.reduce((s, r) => s + kgBrutoRow(r), 0)

  const rowCls = 'flex items-center gap-2 text-xs text-gray-600'

  return (
    <div className="space-y-4 text-sm">
      <p className="font-semibold text-gray-800">
        {[
          bines     > 0 ? `${bines} bin${bines !== 1 ? 'es' : ''}`           : null,
          nPallets  > 0 ? `${nPallets} pallet${nPallets !== 1 ? 's' : ''}`   : null,
        ].filter(Boolean).join(' + ') || '—'}
      </p>

      {pallets.map((rows, pi) => (
        <div key={pi}>
          <p className="text-xs font-semibold text-gray-500 mb-0.5">Composición Pallet {pi + 1}</p>
          <div className="ml-4 space-y-0.5">
            {rows.map((row, ri) => {
              const label = TIPOS_PACKING.find(t => t.value === row.tipoEnvase)?.label ?? row.tipoEnvase
              const cap   = row.tipoEnvase === 'tambor' ? ` ${row.capacidadTambor ?? 200} kg` : ''
              return (
                <div key={ri} className={rowCls}>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500 truncate max-w-[140px]">{row.productoNombre}</span>
                  <span className="text-gray-300">—</span>
                  <span>{label}{cap}</span>
                  <span className="font-semibold text-gray-800">× {row.cantidad}</span>
                  <span className="text-gray-400">({fmt(kgNetoRow(row), 1)} kg)</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400">Peso neto</p>
          <p className="font-semibold text-gray-800">{fmt(totalNeto)} kg</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Peso bruto</p>
          <p className="font-semibold text-gray-800">{fmt(totalBruto)} kg</p>
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalDimensionamiento({ pedido, onClose }) {
  const aprobar  = useAprobarDimensionamiento()
  const rechazar = useRechazarDimensionamiento()

  const items = pedido.pedidos_expo_items ?? []

  const [notas,    setNotas]   = useState('')
  const [errMsg,   setErrMsg]  = useState('')
  const [kgLotes,  setKgLotes] = useState(() =>
    Object.fromEntries(items.map(it => [it.id, parseFloat(it.cantidad_kg) || 0]))
  )
  const [palletsCustom, setPalletsCustom] = useState(null)

  const loading = aprobar.isPending || rechazar.isPending

  // kg pedidos por nombre de producto
  const kgPedido = useMemo(() => {
    const map = {}
    for (const it of items)
      map[it.producto_nombre] = (map[it.producto_nombre] ?? 0) + (parseFloat(it.cantidad_kg) || 0)
    return map
  }, [items])

  // kg asignados en pallets custom por producto (reactivo)
  const kgAsignado = useMemo(() => {
    if (!palletsCustom) return {}
    const map = {}
    for (const rows of palletsCustom)
      for (const row of rows)
        map[row.productoNombre] = (map[row.productoNombre] ?? 0) + kgNetoRow(row)
    return map
  }, [palletsCustom])

  const productosDisp = useMemo(() => {
    const seen = new Set()
    return items.reduce((arr, it) => {
      if (!seen.has(it.producto_nombre)) { seen.add(it.producto_nombre); arr.push(it.producto_nombre) }
      return arr
    }, [])
  }, [items])

  const notasLote = items
    .filter(it => {
      const lote  = parseFloat(kgLotes[it.id])
      const total = parseFloat(it.cantidad_kg) || 0
      return !isNaN(lote) && lote < total && lote > 0
    })
    .map(it => {
      const lote  = parseFloat(kgLotes[it.id])
      const resto = (parseFloat(it.cantidad_kg) || 0) - lote
      return `${it.producto_nombre}: entrega inmediata ${fmt(lote, 1)} kg / nuevo lote ${fmt(resto, 1)} kg`
    })
    .join('\n')

  // ── pallet editor helpers ──────────────────────────────────────────────────

  function newRow() {
    return { productoNombre: productosDisp[0] ?? '', tipoEnvase: 'tambor', capacidadTambor: 200, cantidad: 1 }
  }

  function addPallet() {
    setPalletsCustom(prev => [...(prev ?? []), [newRow()]])
  }

  function removePallet(pi) {
    setPalletsCustom(prev => {
      const next = prev.filter((_, i) => i !== pi)
      return next.length ? next : null
    })
  }

  function addRow(pi) {
    setPalletsCustom(prev => prev.map((rows, i) => i === pi ? [...rows, newRow()] : rows))
  }

  function removeRow(pi, ri) {
    setPalletsCustom(prev => prev.map((rows, i) =>
      i === pi ? rows.filter((_, j) => j !== ri) : rows
    ))
  }

  function updateRow(pi, ri, patch) {
    setPalletsCustom(prev => prev.map((rows, i) =>
      i === pi ? rows.map((r, j) => j === ri ? { ...r, ...patch } : r) : rows
    ))
  }

  // ── submit handlers ────────────────────────────────────────────────────────

  async function handleAprobar() {
    setErrMsg('')
    try {
      const packingText = buildPackingText(palletsCustom)
      const notasFinal  = [notasLote, packingText, notas.trim()].filter(Boolean).join('\n\n')
      await aprobar.mutateAsync({ pedidoId: pedido.id, notasProduccion: notasFinal || null })
      onClose()
    } catch (e) { setErrMsg(e.message) }
  }

  async function handleRechazar() {
    setErrMsg('')
    if (!notas.trim()) { setErrMsg('Indicá el motivo del rechazo.'); return }
    try {
      await rechazar.mutateAsync({ pedidoId: pedido.id, notasProduccion: notas })
      onClose()
    } catch (e) { setErrMsg(e.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-[10px] shadow-lg w-full max-w-3xl my-8">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{pedido.numero}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {pedido.cliente_nombre}
              {pedido.pais_destino    ? ` — ${pedido.pais_destino}`    : ''}
              {pedido.puerto_descarga ? ` · ${pedido.puerto_descarga}` : ''}
              {' · '}Vendedor: {pedido.creado_por_perfil?.nombre ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Kg disponibles este lote */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Kg disponibles este lote
            </p>
            <div className="space-y-1.5">
              {items.map(it => {
                const kg      = parseFloat(it.cantidad_kg) || 0
                const lote    = kgLotes[it.id] ?? kg
                const parcial = lote < kg && lote > 0
                return (
                  <div key={it.id} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 flex-1 truncate">{it.producto_nombre}</span>
                    <input
                      type="number" min="0" max={kg} step="0.001"
                      value={lote}
                      onChange={e => setKgLotes(prev => ({ ...prev, [it.id]: parseFloat(e.target.value) || 0 }))}
                      className={`w-28 text-center ${INPUT_S} ${parcial ? 'border-amber-300 bg-amber-50' : ''}`}
                    />
                    <span className="text-xs text-gray-400 whitespace-nowrap">de {fmt(kg)} kg</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resumen del embarque — automático O distribución manual */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Resumen del embarque
              </p>
              {palletsCustom !== null && (
                <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                  Distribución manual
                </span>
              )}
            </div>
            {palletsCustom !== null
              ? <ResumenCustom pallets={palletsCustom}/>
              : <DimTree items={items}/>
            }
          </div>

          {/* Redefinir embarque */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Redefinir embarque
              </p>
              {palletsCustom !== null && (
                <button onClick={() => setPalletsCustom(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                  Restablecer automático
                </button>
              )}
            </div>

            {palletsCustom === null ? (
              <button onClick={addPallet}
                className="w-full text-xs text-[#004a99] border border-dashed border-[#004a99]/30 rounded-lg py-2.5 hover:bg-blue-50 transition-colors">
                + Definir composición de pallets manualmente
              </button>
            ) : (
              <div className="space-y-4">

                {/* Tracker de kg por producto */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
                  {productosDisp.map(nombre => {
                    const pedKg    = kgPedido[nombre]  ?? 0
                    const asig     = kgAsignado[nombre] ?? 0
                    const pct      = pedKg > 0 ? Math.min(asig / pedKg, 1) : 0
                    const completo = Math.abs(asig - pedKg) < 0.01
                    const exceso   = asig > pedKg + 0.01
                    return (
                      <div key={nombre}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-700 font-medium truncate mr-2">{nombre}</span>
                          <span className={`font-semibold whitespace-nowrap ${completo ? 'text-green-600' : exceso ? 'text-red-500' : 'text-gray-500'}`}>
                            {fmt(asig, 1)} / {fmt(pedKg, 1)} kg
                            {completo && ' ✓'}
                            {exceso   && ` (+${fmt(asig - pedKg, 1)} extra)`}
                            {!completo && !exceso && asig > 0 && ` — faltan ${fmt(pedKg - asig, 1)} kg`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${exceso ? 'bg-red-400' : completo ? 'bg-green-500' : 'bg-[#004a99]'}`}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Editor de pallets */}
                {palletsCustom.map((rows, pi) => (
                  <div key={pi} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-700">Pallet {pi + 1}</p>
                      <button onClick={() => removePallet(pi)} className="text-xs text-red-400 hover:text-red-600">
                        Eliminar
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      {rows.map((row, ri) => {
                        const kgRow = kgNetoRow(row)
                        return (
                          <div key={ri} className="flex items-center gap-2 flex-wrap">
                            {/* Producto */}
                            <select
                              value={row.productoNombre}
                              onChange={e => updateRow(pi, ri, { productoNombre: e.target.value })}
                              className={SELECT_S + ' flex-1 min-w-0'}
                            >
                              {productosDisp.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>

                            {/* Envase */}
                            <select
                              value={row.tipoEnvase}
                              onChange={e => updateRow(pi, ri, {
                                tipoEnvase: e.target.value,
                                capacidadTambor: e.target.value === 'tambor' ? (row.capacidadTambor ?? 200) : undefined,
                              })}
                              className={SELECT_S}
                            >
                              {TIPOS_PACKING.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>

                            {/* Capacidad tambor */}
                            {row.tipoEnvase === 'tambor' && (
                              <select
                                value={row.capacidadTambor ?? 200}
                                onChange={e => updateRow(pi, ri, { capacidadTambor: parseInt(e.target.value) })}
                                className={SELECT_S}
                              >
                                {CAPS_TAMBOR.map(c => <option key={c} value={c}>{c} kg</option>)}
                              </select>
                            )}

                            {/* Cantidad */}
                            <input
                              type="number" min="1"
                              value={row.cantidad}
                              onChange={e => updateRow(pi, ri, { cantidad: parseInt(e.target.value) || 1 })}
                              className={INPUT_S + ' w-14 text-center'}
                            />

                            {/* kg calculados */}
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              = {fmt(kgRow, 1)} kg
                            </span>

                            {/* Quitar */}
                            <button onClick={() => removeRow(pi, ri)}
                              className="p-0.5 text-gray-300 hover:text-red-400 rounded flex-shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            </button>
                          </div>
                        )
                      })}
                      <button onClick={() => addRow(pi)} className="text-xs text-[#004a99] hover:underline mt-0.5">
                        + Agregar ítem en este pallet
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={addPallet}
                  className="w-full text-xs text-[#004a99] border border-dashed border-[#004a99]/30 rounded-lg py-2 hover:bg-blue-50 transition-colors">
                  + Agregar pallet
                </button>
              </div>
            )}
          </div>

          {/* Notas del vendedor */}
          {pedido.notas_vendedor && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Notas del vendedor
              </p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{pedido.notas_vendedor}</p>
            </div>
          )}

          {/* Entregas parciales */}
          {notasLote && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                Entregas parciales — se enviará al vendedor
              </p>
              {notasLote.split('\n').map((línea, i) => (
                <p key={i} className="text-xs text-amber-800">{línea}</p>
              ))}
            </div>
          )}

          {/* Notas para el vendedor */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Notas para el vendedor
              <span className="text-gray-400 font-normal ml-1">(requeridas si rechazás)</span>
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Indicaciones o motivo del rechazo…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
            />
          </div>

          {errMsg && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errMsg}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={handleRechazar} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
            Rechazar — devolver al vendedor
          </button>
          <button onClick={handleAprobar} disabled={loading}
            className="px-5 py-2 text-sm font-semibold bg-[#004a99] text-white rounded-lg hover:bg-[#003d80] disabled:opacity-50 flex items-center gap-2 transition-colors">
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Aprobar y enviar a COMEX
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AprobarExpo() {
  const { data: pedidos = [], isLoading } = usePedidosExpoProduccion()
  const [seleccionado, setSeleccionado] = useState(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dimensionamiento EXPO</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {pedidos.length > 0
            ? `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} pendiente${pedidos.length !== 1 ? 's' : ''} de aprobación`
            : 'Sin pedidos pendientes'}
        </p>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No hay pedidos pendientes de aprobación
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nº</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Vendedor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente / País</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Puerto</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Kg neto</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">Pallets</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pedidos.map(p => (
                <tr key={p.id} onClick={() => setSeleccionado(p)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.numero}</td>
                  <td className="px-4 py-3 text-gray-700">{p.creado_por_perfil?.nombre ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{p.cliente_nombre}</p>
                    {p.pais_destino && <p className="text-xs text-gray-400">{p.pais_destino}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.puerto_descarga || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {p.peso_neto != null ? `${parseFloat(p.peso_neto).toLocaleString('es-AR')} kg` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {p.cantidad_pallets?.toLocaleString('es-AR') ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(p.creado_en).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {seleccionado && (
        <ModalDimensionamiento pedido={seleccionado} onClose={() => setSeleccionado(null)}/>
      )}
    </div>
  )
}
