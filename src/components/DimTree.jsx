import { calcularDimensionamiento } from '../lib/dimensionamiento'

// ── Utilidades para notas de producción ──────────────────────────────────────

const PACKING_MARKER = 'DISTRIBUCIÓN DE PALLETS:'

export function splitNotas(notes) {
  if (!notes) return { packing: null, other: null }
  const idx = notes.indexOf(PACKING_MARKER)
  if (idx === -1) return { packing: null, other: notes }
  const before      = notes.slice(0, idx).trim()
  const fromMarker  = notes.slice(idx)
  const endIdx      = fromMarker.indexOf('\n\n')
  const packingText = endIdx === -1 ? fromMarker : fromMarker.slice(0, endIdx)
  const after       = endIdx === -1 ? '' : fromMarker.slice(endIdx + 2).trim()
  return { packing: packingText, other: [before, after].filter(Boolean).join('\n\n') || null }
}

export function PackingManual({ text }) {
  const palletLines = text.split('\n').filter(l => /^Pallet \d+:/.test(l))
  const rowCls = 'flex items-center gap-2 text-xs text-gray-600'
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold text-gray-800">
        {palletLines.length} pallet{palletLines.length !== 1 ? 's' : ''}
        <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">
          Distribución de Producción
        </span>
      </p>
      {palletLines.map((line, i) => {
        const colonIdx = line.indexOf(':')
        return (
          <div key={i}>
            <p className="text-xs font-semibold text-gray-500 mb-0.5">{line.slice(0, colonIdx)}</p>
            <div className="ml-4 space-y-0.5">
              {line.slice(colonIdx + 1).trim().split(', ').map((item, j) => (
                <div key={j} className={rowCls}>
                  <span className="text-gray-300">·</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Capacidades por pallet (null = base propia, no ocupa pallet)
const POR_PALLET = { bin: null, tambor: 4, bolsa: 20, bidon: 24 }

function fmtKg(n) {
  if (!n) return ''
  return parseFloat(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' kg'
}

function envaseLabel(tipo, cap) {
  if (tipo === 'bin')       return 'Bin IBC'
  if (tipo === 'tambor' || tipo === 'tambor_bin') return `Tambor ${cap ?? 200} kg`
  if (tipo === 'bolsa')     return 'Bolsa 25 kg'
  if (tipo === 'bidon')     return 'Bidón 25 L'
  if (tipo === 'bidon_bin') return 'Bin + Bidón'
  return tipo ?? '—'
}

// Descompone un item en partes simples { tipo, label, count, perPallet }
function descomponerItem(it) {
  const kg   = parseFloat(it.cantidad_kg) || 0
  const tipo = it.tipo_envase
  const cap  = it.capacidad_tambor ?? 200

  if (!tipo || !kg) return []

  if (tipo === 'bin') {
    const count = it.cantidad_envases ?? Math.ceil(kg / 1000)
    return [{ tipo: 'bin', label: 'Bin IBC', count, perPallet: null }]
  }
  if (tipo === 'bolsa') {
    const count = it.cantidad_envases ?? Math.ceil(kg / 25)
    return [{ tipo: 'bolsa', label: 'Bolsa 25 kg', count, perPallet: 20 }]
  }
  if (tipo === 'bidon') {
    const count = it.cantidad_envases ?? Math.ceil(kg / 25)
    return [{ tipo: 'bidon', label: 'Bidón 25 L', count, perPallet: 24 }]
  }
  if (tipo === 'tambor') {
    const count = it.cantidad_envases ?? Math.ceil(kg / cap)
    return [{ tipo: 'tambor', label: `Tambor ${cap} kg`, count, perPallet: 4 }]
  }
  if (tipo === 'tambor_bin') {
    const dim = calcularDimensionamiento({ tipoEnvase: 'tambor', capacidadTambor: cap, tipoPallet: 'madera', totalKg: kg, usarBin: true })
    const parts = []
    if (dim?.bines)    parts.push({ tipo: 'bin',    label: 'Bin IBC',          count: dim.bines,    perPallet: null })
    if (dim?.tambores) parts.push({ tipo: 'tambor', label: `Tambor ${cap} kg`, count: dim.tambores, perPallet: 4 })
    if (dim?.bidones)  parts.push({ tipo: 'bidon',  label: 'Bidón 25 L',       count: dim.bidones,  perPallet: 24 })
    return parts.length ? parts : [{ tipo: 'tambor_bin', label: `Bin + Tambor ${cap} kg`, count: it.cantidad_envases ?? 0, perPallet: null }]
  }
  if (tipo === 'bidon_bin') {
    const dim = calcularDimensionamiento({ tipoEnvase: 'bidon', tipoPallet: 'madera', totalKg: kg, usarBin: true })
    const parts = []
    if (dim?.bines)  parts.push({ tipo: 'bin',   label: 'Bin IBC',     count: dim.bines,  perPallet: null })
    if (dim?.bidones) parts.push({ tipo: 'bidon', label: 'Bidón 25 L', count: dim.bidones, perPallet: 24 })
    return parts.length ? parts : [{ tipo: 'bidon_bin', label: 'Bin + Bidón', count: it.cantidad_envases ?? 0, perPallet: null }]
  }
  return []
}

// Tambores: pallets dedicados (4/pallet). Bolsas + bidones: greedy compartido.
function computarPallets(partes) {
  // Tambores → pallets propios (son incompatibles físicamente con bolsas/bidones en altura)
  const tamborMap = new Map()
  for (const p of partes.filter(p => p.tipo === 'tambor' && p.count > 0)) {
    if (tamborMap.has(p.label)) tamborMap.get(p.label).count += p.count
    else tamborMap.set(p.label, { ...p })
  }
  const tamborPallets = [...tamborMap.values()].reduce((s, t) => s + Math.ceil(t.count / 4), 0)

  // Bolsas + bidones → greedy compartido (ascendente por perPallet: bolsa=20 primero, bidon=24 llena restos)
  const smallMap = new Map()
  for (const p of partes.filter(p => (p.tipo === 'bolsa' || p.tipo === 'bidon') && p.count > 0)) {
    const key = `${p.tipo}|${p.label}`
    if (smallMap.has(key)) smallMap.get(key).count += p.count
    else smallMap.set(key, { ...p })
  }
  if (!smallMap.size) return { tamborPallets, mixPallets: [] }

  const sorted = [...smallMap.values()].sort((a, b) => a.perPallet - b.perPallet)
  const rem    = sorted.map(r => ({ ...r, left: r.count }))

  const mixPallets = []
  while (rem.some(r => r.left > 0)) {
    const pallet = []
    let space = 1.0
    for (const r of rem) {
      if (r.left <= 0) continue
      const unit = 1 / r.perPallet
      const fit  = Math.min(r.left, Math.floor(space / unit + 1e-9))
      if (fit > 0) {
        pallet.push({ label: r.label, count: fit })
        space  -= fit * unit
        r.left -= fit
      }
    }
    if (!pallet.length) break
    mixPallets.push(pallet)
  }
  return { tamborPallets, mixPallets }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DimTree({ items }) {
  if (!items?.length) return null

  // 1. Agrupar por producto
  const prodMap = new Map()
  for (const it of items) {
    const key = it.producto_id ?? it.producto_nombre
    if (!prodMap.has(key)) prodMap.set(key, { nombre: it.producto_nombre, rows: [] })
    prodMap.get(key).rows.push(it)
  }

  // 2. Descomponer todos los items y agregar por tipo+label
  const allParts = items.flatMap(descomponerItem)
  const aggMap   = new Map()
  for (const p of allParts) {
    const key = `${p.tipo}|${p.label}`
    if (aggMap.has(key)) aggMap.get(key).count += p.count
    else aggMap.set(key, { ...p })
  }

  // 3. Composición de pallets
  const binesTotal = [...aggMap.values()].filter(p => p.tipo === 'bin').reduce((s, p) => s + p.count, 0)
  const { tamborPallets, mixPallets } = computarPallets([...aggMap.values()])
  const totalPallets = tamborPallets + mixPallets.length

  // 4. Totales de peso — usa los valores guardados, o recalcula si son nulos
  function pesoItem(it) {
    const neto  = parseFloat(it.peso_neto)
    const bruto = parseFloat(it.peso_bruto)
    if (neto > 0 && bruto > 0) return { neto, bruto }
    const tipo = it.tipo_envase ?? ''
    const dim = calcularDimensionamiento({
      tipoEnvase:      tipo.replace('_bin', '') || 'tambor',
      capacidadTambor: it.capacidad_tambor ?? 200,
      tipoPallet:      it.tipo_pallet ?? 'madera',
      totalKg:         parseFloat(it.cantidad_kg) || 0,
      usarBin:         tipo.includes('_bin') || tipo === 'bin',
    })
    return { neto: dim?.neto ?? 0, bruto: dim?.bruto ?? 0 }
  }
  const totalNeto  = items.reduce((s, it) => s + pesoItem(it).neto,  0)
  const totalBruto = items.reduce((s, it) => s + pesoItem(it).bruto, 0)

  const rowCls = 'flex items-center gap-2 text-xs text-gray-600'

  return (
    <div className="space-y-4 text-sm">

      {/* ── Por producto ── */}
      <div className="space-y-3">
        {[...prodMap.values()].map((prod, pi) => {
          const partes   = prod.rows.flatMap(descomponerItem)
          const prodNeto = prod.rows.reduce((s, it) => s + (parseFloat(it.cantidad_kg) || 0), 0)
          return (
            <div key={pi}>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-gray-800">{prod.nombre}</span>
                {prodNeto > 0 && <span className="text-xs text-gray-400">{fmtKg(prodNeto)}</span>}
              </div>
              <div className="ml-4 mt-0.5 space-y-0.5">
                {partes.map((p, i) => (
                  <div key={i} className={rowCls}>
                    <span className="text-gray-300">·</span>
                    <span>{p.label}</span>
                    <span className="font-semibold text-gray-800">× {p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Total envases ── */}
      {aggMap.size > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Total envases</p>
          <div className="space-y-0.5">
            {[...aggMap.values()].map((p, i) => (
              <div key={i} className={rowCls}>
                <span className="text-gray-300">·</span>
                <span>{p.label}</span>
                <span className="font-semibold text-gray-800">× {p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pedido total + composición pallets ── */}
      {(binesTotal > 0 || totalPallets > 0) && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pedido total</p>
          <p className="font-semibold text-gray-800 mb-2">
            {[
              binesTotal > 0 ? `${binesTotal} bin${binesTotal !== 1 ? 'es' : ''}` : null,
              totalPallets > 0 ? `${totalPallets} pallet${totalPallets !== 1 ? 's' : ''}` : null,
            ].filter(Boolean).join(' + ')}
          </p>
          {tamborPallets > 0 && (
            <p className="text-xs text-gray-600 mb-2">
              {tamborPallets} pallet{tamborPallets !== 1 ? 's' : ''} de tambores
            </p>
          )}
          {mixPallets.map((pallet, i) => (
            <div key={i} className="mb-2">
              <p className="text-xs font-semibold text-gray-500 mb-0.5">
                Composición Pallet {tamborPallets + i + 1}
              </p>
              <div className="ml-4 space-y-0.5">
                {pallet.map((row, j) => (
                  <div key={j} className={rowCls}>
                    <span className="text-gray-300">·</span>
                    <span>{row.label}</span>
                    <span className="font-semibold text-gray-800">× {row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Peso neto / bruto ── */}
      {(totalNeto > 0 || totalBruto > 0) && (
        <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">Peso neto</p>
            <p className="font-semibold text-gray-800">{fmtKg(totalNeto)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Peso bruto</p>
            <p className="font-semibold text-gray-800">{fmtKg(totalBruto)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
