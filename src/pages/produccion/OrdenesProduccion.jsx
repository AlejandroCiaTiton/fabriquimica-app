import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { fmtFecha } from '../../utils/calc'

const db = supabaseAdmin ?? supabase

function fmtFechaCorta(str) {
  if (!str) return null
  return new Date(str + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function estaVencido(fecha) {
  return fecha && new Date(fecha + 'T00:00:00') < new Date()
}

// ── Lotes disponibles con cantidad comprometida en OCs activas ────────────────

function useLotesProducto(productoId) {
  return useQuery({
    queryKey: ['produccion', 'lotes', productoId],
    enabled: !!productoId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const [{ data: rec }, { data: prod }] = await Promise.all([
        db.from('recepciones_mercaderia')
          .select('id, cantidad, numero_lote, fecha_recepcion, fecha_vencimiento')
          .eq('producto_id', productoId)
          .not('numero_lote', 'is', null)
          .order('fecha_recepcion', { ascending: false }),
        db.from('producciones')
          .select('id, cantidad, numero_lote, fecha_produccion, fecha_vencimiento')
          .eq('producto_id', productoId)
          .not('numero_lote', 'is', null)
          .order('fecha_produccion', { ascending: false }),
      ])

      const lotes = [
        ...(rec  ?? []).map(r => ({ ...r, tipo: 'recepcion',  fecha: r.fecha_recepcion })),
        ...(prod ?? []).map(p => ({ ...p, tipo: 'produccion', fecha: p.fecha_produccion })),
      ].sort((a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0))

      if (lotes.length === 0) return []

      // OCs activas → cotizacion_ids
      const { data: ocsActivas } = await db
        .from('ordenes_compra')
        .select('cotizacion_id')
        .in('estado', ['recibida', 'en-preparacion', 'listo-entrega', 'entregada'])

      const cotizacionIds = (ocsActivas ?? []).map(o => o.cotizacion_id).filter(Boolean)

      let comprometidoPorLote = {}
      if (cotizacionIds.length > 0) {
        // Ítem IDs de este producto en esas cotizaciones
        const { data: prodItems } = await db
          .from('cotizacion_items')
          .select('id')
          .eq('producto_id', productoId)
          .in('cotizacion_id', cotizacionIds)

        const prodItemIds = (prodItems ?? []).map(i => i.id)

        if (prodItemIds.length > 0) {
          // Cantidades comprometidas desde la tabla de lotes
          const { data: loteRows } = await db
            .from('cotizacion_item_lotes')
            .select('numero_lote, cantidad')
            .in('cotizacion_item_id', prodItemIds)

          for (const row of loteRows ?? []) {
            comprometidoPorLote[row.numero_lote] = (comprometidoPorLote[row.numero_lote] ?? 0) + row.cantidad
          }
        }
      }

      return lotes.map(l => ({
        ...l,
        comprometido: comprometidoPorLote[l.numero_lote] ?? 0,
        disponible:   Math.max(0, l.cantidad - (comprometidoPorLote[l.numero_lote] ?? 0)),
      }))
    },
  })
}

// ── Hooks de OC ───────────────────────────────────────────────────────────────

function useOCsProduccion() {
  return useQuery({
    queryKey: ['produccion', 'ordenes'],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await db
        .from('ordenes_compra')
        .select(`
          id, numero, estado, creado_en,
          cotizaciones(
            id, codigo,
            clientes(id, razon_social),
            cotizacion_items(
              id, cantidad, lote_aplicado,
              productos(id, nombre, codigo),
              cotizacion_item_lotes(id, numero_lote, cantidad)
            )
          )
        `)
        .in('estado', ['recibida', 'en-preparacion', 'listo-entrega'])
        .order('creado_en', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

function useGuardarLotes() {
  const qc = useQueryClient()
  return useMutation({
    // itemLotes: [{ itemId, filas: [{lote, cantidad}] }]
    mutationFn: async (itemLotes) => {
      const itemIds = itemLotes.map(il => il.itemId)

      // Borrar filas existentes
      const { error: delErr } = await db
        .from('cotizacion_item_lotes')
        .delete()
        .in('cotizacion_item_id', itemIds)
      if (delErr) throw delErr

      // Insertar nuevas
      const rows = itemLotes.flatMap(il =>
        (il.filas ?? [])
          .filter(l => l.lote?.trim() && parseFloat(l.cantidad) > 0)
          .map(l => ({ cotizacion_item_id: il.itemId, numero_lote: l.lote.trim(), cantidad: parseFloat(l.cantidad) }))
      )
      if (rows.length > 0) {
        const { error: insErr } = await db.from('cotizacion_item_lotes').insert(rows)
        if (insErr) throw insErr
      }

      // Actualizar lote_aplicado como resumen (para chofer, finanzas, etc.)
      await Promise.all(itemLotes.map(il => {
        const filas = (il.filas ?? []).filter(l => l.lote?.trim())
        const resumen = filas.length === 0 ? null
          : filas.length === 1 ? filas[0].lote
          : filas.map(l => `${l.lote} (${l.cantidad}kg)`).join(' + ')
        return db.from('cotizacion_items').update({ lote_aplicado: resumen }).eq('id', il.itemId)
      }))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produccion', 'ordenes'] })
      qc.invalidateQueries({ queryKey: ['produccion', 'lotes'] })
    },
  })
}

function useAvanzarEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, estado }) => {
      const { error } = await db.from('ordenes_compra').update({ estado }).eq('id', ocId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produccion', 'ordenes'] })
      qc.invalidateQueries({ queryKey: ['logistica'] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
      qc.invalidateQueries({ queryKey: ['chofer'] })
    },
  })
}

async function descontarStock(items, lotesMap) {
  const porProducto = {}
  for (const item of items) {
    const pid = item.productos?.id
    if (!pid) continue
    const total = (lotesMap[item.id] ?? []).reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)
    if (total > 0) porProducto[pid] = (porProducto[pid] ?? 0) + total
  }

  for (const [productoId, cantidad] of Object.entries(porProducto)) {
    const { data: sa, error: fetchErr } = await db
      .from('stock_actual').select('cantidad').eq('producto_id', productoId).maybeSingle()
    if (fetchErr) throw fetchErr
    if (!sa) continue
    const { error: updErr } = await db
      .from('stock_actual')
      .update({ cantidad: Math.max(0, (sa.cantidad ?? 0) - cantidad) })
      .eq('producto_id', productoId)
    if (updErr) throw updErr
  }
}

// ── Componente de múltiples lotes ─────────────────────────────────────────────

const MANUAL = '__manual__'

function LoteRow({ row, idx, lotes, isLoading, usados, onUpdate, onRemove }) {
  const [manual, setManual] = useState(() => !!(row.lote && !lotes.find(l => l.numero_lote === row.lote)))

  function handleSelect(e) {
    if (e.target.value === MANUAL) { setManual(true); onUpdate(idx, 'lote', '') }
    else { setManual(false); onUpdate(idx, 'lote', e.target.value) }
  }

  const loteInfo   = lotes.find(l => l.numero_lote === row.lote)
  const vencido    = loteInfo && estaVencido(loteInfo.fecha_vencimiento)
  const sinStock   = loteInfo && loteInfo.disponible <= 0
  const insuf      = loteInfo && loteInfo.disponible < (parseFloat(row.cantidad) || 0)

  return (
    <div className="flex items-start gap-1.5">
      <div className="flex-1 space-y-0.5">
        {!manual ? (
          <select
            value={row.lote || ''}
            onChange={handleSelect}
            disabled={isLoading}
            className={`w-full border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 disabled:opacity-60 ${
              insuf ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-[#004a99]'
            }`}
          >
            <option value="">{isLoading ? 'Cargando…' : '— Lote —'}</option>
            {lotes.map(l => {
              const yaUsado = usados.includes(l.numero_lote) && l.numero_lote !== row.lote
              const vto     = l.fecha_vencimiento ? ` · vto ${fmtFechaCorta(l.fecha_vencimiento)}${estaVencido(l.fecha_vencimiento) ? ' ⚠' : ''}` : ''
              const tipo    = l.tipo === 'recepcion' ? '[R]' : '[P]'
              const disp    = l.comprometido > 0 ? ` (${l.disponible} disp.)` : ` · ${l.cantidad}kg`
              return (
                <option key={`${l.tipo}-${l.id}`} value={l.numero_lote} disabled={l.disponible <= 0}>
                  {l.disponible <= 0 ? '✗ ' : yaUsado ? '↑ ' : ''}{tipo} {l.numero_lote}{disp}{vto}
                </option>
              )
            })}
            <option value={MANUAL}>✏ Manual…</option>
          </select>
        ) : (
          <input
            type="text" autoFocus
            value={row.lote}
            onChange={e => onUpdate(idx, 'lote', e.target.value)}
            onBlur={() => { if (!row.lote) setManual(false) }}
            placeholder="Ej: L2025-042"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          />
        )}
        {insuf && !sinStock && (
          <p className="text-[10px] text-red-600">⚠ Solo {loteInfo.disponible} kg/lt disponibles</p>
        )}
        {vencido && !insuf && (
          <p className="text-[10px] text-orange-600">⚠ Lote vencido</p>
        )}
      </div>
      <input
        type="number" min="0.001" step="any"
        value={row.cantidad}
        onChange={e => onUpdate(idx, 'cantidad', e.target.value)}
        placeholder="kg/lt"
        className="w-20 text-right border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#004a99]"
      />
      <button
        onClick={() => onRemove(idx)}
        className="mt-0.5 p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
        title="Quitar fila"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

function LotesMultiples({ productoId, itemCantidad, value, onChange }) {
  const { data: lotes = [], isLoading } = useLotesProducto(productoId)

  const totalAsignado = value.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)
  const restante      = parseFloat((itemCantidad - totalAsignado).toFixed(3))
  const completo      = Math.abs(restante) < 0.001
  const excedido      = totalAsignado > itemCantidad + 0.001
  const usados        = value.map(l => l.lote).filter(Boolean)

  function addRow() {
    onChange([...value, { lote: '', cantidad: restante > 0 ? parseFloat(restante.toFixed(3)) : '' }])
  }

  function removeRow(idx) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function updateRow(idx, field, val) {
    onChange(value.map((row, i) => i === idx ? { ...row, [field]: val } : row))
  }

  return (
    <div className="space-y-1.5">
      {value.length === 0 && (
        <p className="text-xs text-gray-400 italic">Sin lotes asignados</p>
      )}

      {value.map((row, idx) => (
        <LoteRow
          key={idx}
          row={row}
          idx={idx}
          lotes={lotes}
          isLoading={isLoading}
          usados={usados.filter((_, i) => i !== idx)}
          onUpdate={updateRow}
          onRemove={removeRow}
        />
      ))}

      <div className="flex items-center justify-between pt-0.5">
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-[#004a99] hover:underline font-medium"
        >
          + Agregar lote
        </button>
        {value.length > 0 && (
          <span className={`text-xs font-semibold ${
            completo ? 'text-green-600' : excedido ? 'text-red-600' : 'text-orange-600'
          }`}>
            {totalAsignado.toFixed(1)} / {itemCantidad} kg/lt
            {completo ? ' ✓' : excedido ? ' (excedido)' : ` (faltan ${restante.toFixed(1)})`}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────

const ESTADO_BADGE = {
  'recibida':       { label: 'Recibida',           cls: 'bg-blue-100 text-blue-700'     },
  'en-preparacion': { label: 'En preparación',     cls: 'bg-yellow-100 text-yellow-700' },
  'listo-entrega':  { label: 'Listo para entrega', cls: 'bg-green-100 text-green-700'   },
}

// ── Tarjeta "listo para entrega" (solo lectura) ───────────────────────────────

function TarjetaListoEntrega({ oc }) {
  const items   = oc.cotizaciones?.cotizacion_items ?? []
  const cliente = oc.cotizaciones?.clientes?.razon_social ?? '—'
  const [expandido, setExpandido] = useState(false)

  return (
    <div className="bg-white rounded-[10px] shadow-card overflow-hidden border-l-4 border-l-green-400">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setExpandido(v => !v)}
      >
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandido ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">Orden #{oc.numero}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
              Listo para entrega
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{cliente} · {fmtFecha(oc.creado_en)}</p>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {items.length} producto{items.length !== 1 ? 's' : ''} · en cola del chofer
        </span>
      </div>

      {expandido && (
        <div className="border-t border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium text-gray-500">Producto</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500 w-24">Pedido</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Lotes aplicados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => {
                const filasLote = item.cotizacion_item_lotes ?? []
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{item.productos?.nombre ?? '—'}</p>
                      {item.productos?.codigo && <p className="font-mono text-[10px] text-gray-400">{item.productos.codigo}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-700">{item.cantidad} kg/lt</td>
                    <td className="px-4 py-2.5">
                      {filasLote.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {filasLote.map(l => (
                            <span key={l.id} className="inline-flex items-center gap-1 font-mono text-xs bg-green-50 text-green-800 px-2 py-0.5 rounded">
                              {l.numero_lote}
                              {filasLote.length > 1 && <span className="text-green-600 font-normal">·{l.cantidad}kg</span>}
                            </span>
                          ))}
                        </div>
                      ) : item.lote_aplicado ? (
                        <span className="font-mono text-xs bg-green-50 text-green-800 px-2 py-0.5 rounded">{item.lote_aplicado}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-green-50 border-t border-green-100">
            <p className="text-xs text-green-700">
              ✓ Preparación completa — el chofer verá esta orden en su panel de entregas.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta editable (recibida / en-preparacion) ──────────────────────────────

function TarjetaOC({ oc }) {
  const items   = oc.cotizaciones?.cotizacion_items ?? []
  const cliente = oc.cotizaciones?.clientes?.razon_social ?? '—'
  const cfg     = ESTADO_BADGE[oc.estado] ?? { label: oc.estado, cls: 'bg-gray-100 text-gray-500' }

  // { [itemId]: [{lote: string, cantidad: number|string}] }
  const [lotes,     setLotes]     = useState(() =>
    Object.fromEntries(items.map(i => [
      i.id,
      (i.cotizacion_item_lotes ?? []).map(l => ({ lote: l.numero_lote, cantidad: l.cantidad })),
    ]))
  )
  const [expandido, setExpandido] = useState(false)
  const [guardado,  setGuardado]  = useState(false)
  const [errMsg,    setErrMsg]    = useState('')

  const guardarLotes = useGuardarLotes()
  const avanzar      = useAvanzarEstado()

  // Un ítem está completo cuando la suma de sus lotes iguala la cantidad pedida
  const todosConLote = items.length > 0 && items.every(i => {
    const filas = lotes[i.id] ?? []
    const total = filas.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)
    return filas.length > 0 && filas.every(l => l.lote?.trim()) && Math.abs(total - i.cantidad) < 0.01
  })

  function buildPayload() {
    return items.map(i => ({ itemId: i.id, filas: lotes[i.id] ?? [] }))
  }

  async function handleGuardar() {
    setErrMsg(''); setGuardado(false)
    try {
      await guardarLotes.mutateAsync(buildPayload())
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    } catch (e) {
      setErrMsg(e.message)
    }
  }

  async function handleMarcarListo() {
    setErrMsg('')
    try {
      await guardarLotes.mutateAsync(buildPayload())
      await descontarStock(items, lotes)
      await avanzar.mutateAsync({ ocId: oc.id, estado: 'listo-entrega' })
    } catch (e) {
      setErrMsg(e.message)
    }
  }

  const totalLotesAsignados = items.filter(i => (lotes[i.id] ?? []).length > 0).length

  return (
    <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setExpandido(v => !v)}
      >
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandido ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">Orden #{oc.numero}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{cliente} · {fmtFecha(oc.creado_en)}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-xs text-gray-400">
            {items.length} producto{items.length !== 1 ? 's' : ''}
            {todosConLote && <span className="ml-2 text-green-600 font-medium">✓ lotes completos</span>}
            {!todosConLote && totalLotesAsignados > 0 && (
              <span className="ml-2 text-orange-600 font-medium">{totalLotesAsignados}/{items.length} con lote</span>
            )}
          </span>
          {oc.estado === 'recibida' && (
            <button
              onClick={() => avanzar.mutateAsync({ ocId: oc.id, estado: 'en-preparacion' })}
              disabled={avanzar.isPending}
              className="text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
              {avanzar.isPending ? '…' : 'Iniciar preparación →'}
            </button>
          )}
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-100">
          {items.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400 italic">Sin productos en esta orden</p>
          )}

          {items.length > 0 && (
            <>
              <div className="divide-y divide-gray-50">
                {items.map(item => {
                  const filas        = lotes[item.id] ?? []
                  const totalAsig    = filas.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)
                  const completo     = Math.abs(totalAsig - item.cantidad) < 0.01 && filas.length > 0
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.productos?.nombre ?? '—'}</p>
                          <p className="text-xs text-gray-400">
                            {item.productos?.codigo && <span className="font-mono">{item.productos.codigo} · </span>}
                            Pedido: <span className="font-semibold text-gray-700">{item.cantidad} kg/lt</span>
                          </p>
                        </div>
                        {completo && (
                          <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                            ✓ completo
                          </span>
                        )}
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <LotesMultiples
                          productoId={item.productos?.id}
                          itemCantidad={item.cantidad}
                          value={filas}
                          onChange={v => setLotes(prev => ({ ...prev, [item.id]: v }))}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {errMsg && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 font-mono">
                  {errMsg}
                </div>
              )}

              <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={handleGuardar}
                  disabled={guardarLotes.isPending || avanzar.isPending}
                  className="px-4 py-1.5 text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50">
                  {guardarLotes.isPending ? 'Guardando…' : guardado ? '✓ Guardado' : 'Guardar lotes'}
                </button>
                <button
                  onClick={handleMarcarListo}
                  disabled={!todosConLote || guardarLotes.isPending || avanzar.isPending}
                  title={!todosConLote ? 'Completá la asignación de lotes de todos los productos' : ''}
                  className="px-4 py-1.5 text-sm font-medium bg-[#004a99] hover:bg-[#003d80] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {avanzar.isPending ? 'Procesando…' : 'Marcar como listo para entrega →'}
                </button>
                {!todosConLote && (
                  <span className="text-xs text-gray-400 ml-1">
                    La suma de cada lote debe coincidir con la cantidad pedida
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function OrdenesProduccion() {
  const { data: ocs = [], isLoading } = useOCsProduccion()

  const enPreparacion = ocs.filter(o => o.estado !== 'listo-entrega')
  const listos        = ocs.filter(o => o.estado === 'listo-entrega')

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Órdenes de producción</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Asigná uno o varios lotes por producto — la suma debe igualar la cantidad pedida
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
        </div>
      )}

      {!isLoading && ocs.length === 0 && (
        <div className="bg-white rounded-[10px] shadow-card p-12 text-center text-sm text-gray-400">
          No hay órdenes pendientes de preparación
        </div>
      )}

      {!isLoading && enPreparacion.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            En preparación ({enPreparacion.length})
          </p>
          <div className="space-y-3">
            {enPreparacion.map(oc => <TarjetaOC key={oc.id} oc={oc}/>)}
          </div>
        </div>
      )}

      {!isLoading && listos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Listos para entrega — en cola del chofer ({listos.length})
          </p>
          <div className="space-y-3">
            {listos.map(oc => <TarjetaListoEntrega key={oc.id} oc={oc}/>)}
          </div>
        </div>
      )}
    </div>
  )
}
