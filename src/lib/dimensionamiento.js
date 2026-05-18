// ── Constantes de empaque ─────────────────────────────────────────────────────

export const PESOS_PALLET = { madera: 25, plastico: 15 }

export const DIMS_PALLET = { madera: '1,10 × 1,10 m', plastico: '1,10 × 1,20 m' }

export const INCOTERMS = [
  { code: 'EXW', label: 'EXW — Ex Works',                      desc: 'En fábrica, sin carga' },
  { code: 'FCA', label: 'FCA — Free Carrier',                   desc: 'Entregado al transportista' },
  { code: 'FAS', label: 'FAS — Free Alongside Ship',            desc: 'Franco al costado del buque' },
  { code: 'FOB', label: 'FOB — Free on Board',                  desc: 'Franco a bordo' },
  { code: 'CFR', label: 'CFR — Cost and Freight',               desc: 'Costo y flete hasta destino' },
  { code: 'CIF', label: 'CIF — Cost, Insurance & Freight',      desc: 'Costo, seguro y flete' },
  { code: 'CPT', label: 'CPT — Carriage Paid To',               desc: 'Porte pagado hasta destino' },
  { code: 'CIP', label: 'CIP — Carriage & Insurance Paid',      desc: 'Porte y seguro pagados' },
  { code: 'DAP', label: 'DAP — Delivered at Place',             desc: 'Entregado en lugar convenido' },
  { code: 'DPU', label: 'DPU — Delivered at Place Unloaded',    desc: 'Entregado y descargado' },
  { code: 'DDP', label: 'DDP — Delivered Duty Paid',            desc: 'Entregado derechos pagados' },
]

export const TIPOS_ENVASE = [
  { value: 'bin',    label: 'Bin (IBC)',       sub: 'Base metálica, ~1.000 kg' },
  { value: 'tambor', label: 'Tambor',          sub: '170 / 200 / 230 kg — 4 por pallet' },
  { value: 'bolsa',  label: 'Bolsa 25 kg',     sub: '20 por pallet (4 × 5 pisos)' },
  { value: 'bidon',  label: 'Bidón 25 L',      sub: '24 por pallet (12 × 2 pisos)' },
]

export const CAPS_TAMBOR = [170, 200, 230]

export const ENVASE_LABELS = {
  bin:        'Bin IBC',
  tambor:     'Tambor',
  bolsa:      'Bolsa 25 kg',
  bidon:      'Bidón 25 L',
  bidon_bin:  'Bin + Bidón',
  tambor_bin: 'Bin + Tambor',
  mixto:      'Mixto',
}

// ── Cálculo de dimensionamiento ───────────────────────────────────────────────

/**
 * Calcula envases, pallets, neto y bruto a partir de los parámetros de empaque.
 *
 * @param {object} p
 * @param {'bin'|'tambor'|'bolsa'|'bidon'} p.tipoEnvase
 * @param {number}  [p.capacidadTambor]  - sólo tambores: 170 | 200 | 230
 * @param {'madera'|'plastico'} p.tipoPallet
 * @param {number}   p.totalKg           - kg netos totales del producto
 * @param {number}  [p.densidadBidon]    - kg/L, default 1.0 (sólo bidones)
 * @param {boolean} [p.usarBin]          - para bidon: usar bins para el grueso + bidones para el resto
 * @returns {{ envases, pallets, neto, bruto, apilable, nota, bines?, bidones? } | null}
 */
export function calcularDimensionamiento({ tipoEnvase, capacidadTambor, tipoPallet, totalKg, densidadBidon = 1.0, usarBin = false }) {
  if (!totalKg || totalKg <= 0) return null

  const pesoPallet = PESOS_PALLET[tipoPallet] ?? PESOS_PALLET.madera

  switch (tipoEnvase) {
    case 'bin': {
      const TARA_BIN = 65       // IBC 1000 L con base metálica
      const envases  = Math.ceil(totalKg / 1000)
      const neto     = totalKg
      const bruto    = neto + envases * TARA_BIN
      return { envases, pallets: 0, neto, bruto, apilable: 'si',
        nota: `Bines IBC (cap. ~1.000 kg c/u) con base metálica integrada` }
    }

    case 'tambor': {
      const cap      = capacidadTambor ?? 200
      const TARA     = 25       // tambor metálico vacío
      const TARA_BIN = 65
      const POR_PAL  = 4

      if (usarBin) {
        const bines     = Math.floor(totalKg / 1000)
        const resto1    = totalKg - bines * 1000
        const tambores  = Math.floor(resto1 / cap)          // floor: el sobrante va en bidones
        const resto2    = resto1 - tambores * cap
        const bidones   = resto2 > 0 ? Math.ceil(resto2 / 25) : 0
        const palsTamb  = Math.ceil(tambores / POR_PAL)
        const palsBid   = Math.ceil(bidones / 24)
        const pallets   = palsTamb + palsBid
        const neto      = totalKg
        const bruto     = neto + bines * TARA_BIN + tambores * TARA + bidones * 2 + pallets * pesoPallet
        const partes    = [
          bines   > 0 ? `${bines} Bin${bines !== 1 ? 's' : ''} IBC` : null,
          tambores > 0 ? `${tambores} Tambor${tambores !== 1 ? 'es' : ''} ${cap} kg` : null,
          bidones > 0 ? `${bidones} Bidón${bidones !== 1 ? 'es' : ''} 25 kg` : null,
        ].filter(Boolean)
        return { envases: bines + tambores + bidones, pallets, neto, bruto, apilable: 'si',
          nota: partes.join(' + '),
          bines, tambores, bidones: bidones > 0 ? bidones : undefined }
      }

      const envases = Math.ceil(totalKg / cap)
      const pallets = Math.ceil(envases / POR_PAL)
      const neto    = totalKg
      const bruto   = neto + envases * TARA + pallets * pesoPallet
      return { envases, pallets, neto, bruto, apilable: 'si',
        nota: `Tambores de ${cap} kg — 4 por pallet de ${DIMS_PALLET[tipoPallet]}` }
    }

    case 'bolsa': {
      const KG_BOLSA = 25
      const POR_PAL  = 20       // 4 bolsas × 5 pisos
      const TARA     = 0.3
      const envases  = Math.ceil(totalKg / KG_BOLSA)
      const pallets  = Math.ceil(envases / POR_PAL)
      const neto     = totalKg
      const bruto    = neto + envases * TARA + pallets * pesoPallet
      return { envases, pallets, neto, bruto, apilable: 'consultar_produccion',
        nota: `Bolsas 25 kg — 20 por pallet (4 × 5 pisos), ${DIMS_PALLET[tipoPallet]}` }
    }

    case 'bidon': {
      const d        = densidadBidon || 1.0
      const KG_BIDON = 25 * d            // kg por bidón lleno
      const POR_PAL  = 24                // 12 bidones × 2 pisos
      const TARA_BID = 2
      const TARA_BIN = 65

      if (usarBin) {
        // Bins para el grueso (floor de múltiplos de 1.000 kg) + bidones para el resto
        const bines    = Math.floor(totalKg / 1000)
        const restante = totalKg - bines * 1000
        const bidones  = restante > 0 ? Math.ceil(restante / KG_BIDON) : 0
        const palsBid  = Math.ceil(bidones / POR_PAL)
        const neto     = totalKg
        const bruto    = neto
          + bines   * TARA_BIN
          + bidones * TARA_BID
          + palsBid * PESOS_PALLET.madera                 // bidones siempre madera
        return {
          envases: bines + bidones,
          pallets: palsBid,                               // bins tienen base integrada
          neto, bruto,
          apilable: 'consultar_produccion',
          nota: `${bines} Bin${bines !== 1 ? 's' : ''} IBC + ${bidones} Bidón${bidones !== 1 ? 'es' : ''} 25 L`,
          bines, bidones,
        }
      }

      // Sólo bidones
      const envases = Math.ceil(totalKg / KG_BIDON)
      const pallets = Math.ceil(envases / POR_PAL)
      const neto    = totalKg
      const bruto   = neto + envases * TARA_BID + pallets * PESOS_PALLET.madera
      return { envases, pallets, neto, bruto, apilable: 'consultar_produccion',
        nota: `Bidones 25 L — 24 por pallet de madera (12 × 2 pisos)` }
    }

    default:
      return null
  }
}

/**
 * Calcula el total de pallets para un pedido con múltiples productos,
 * agrupando envases compatibles en pallets compartidos.
 *
 * Cada item debe tener: { tipoEnvase, usarBin, capacidadTambor, tipoPallet, dim }
 */
export function calcularPalletsAgrupados(items) {
  if (!items?.length) return 0

  let total = 0
  const grupos = {}

  for (const it of items) {
    const d = it.dim
    if (!d) continue

    if (it.tipoEnvase === 'bin') {
      // bins tienen base metálica integrada — no suman pallets
    } else if (it.tipoEnvase === 'bidon' && it.usarBin) {
      // parte bins: base propia, no suma pallets
      grupos['bidon'] = (grupos['bidon'] ?? 0) + (d.bidones ?? 0)
    } else if (it.tipoEnvase === 'bidon') {
      grupos['bidon'] = (grupos['bidon'] ?? 0) + d.envases
    } else if (it.tipoEnvase === 'tambor' && it.usarBin) {
      // parte bins: base propia; parte tambores: agrupada en pallet
      const key = `tambor|${it.capacidadTambor ?? 200}|${it.tipoPallet ?? 'madera'}`
      grupos[key] = (grupos[key] ?? 0) + (d.tambores ?? 0)
    } else if (it.tipoEnvase === 'tambor') {
      const key = `tambor|${it.capacidadTambor ?? 200}|${it.tipoPallet ?? 'madera'}`
      grupos[key] = (grupos[key] ?? 0) + d.envases
    } else if (it.tipoEnvase === 'bolsa') {
      const key = `bolsa|${it.tipoPallet ?? 'madera'}`
      grupos[key] = (grupos[key] ?? 0) + d.envases
    }
  }

  for (const [key, n] of Object.entries(grupos)) {
    if (key === 'bidon')              total += Math.ceil(n / 24)
    else if (key.startsWith('tambor')) total += Math.ceil(n / 4)
    else if (key.startsWith('bolsa'))  total += Math.ceil(n / 20)
  }

  return total
}

/**
 * Detecta el tipo de envase a partir del campo presentacion del producto.
 * Devuelve tipoEnvase y capacidadTambor por defecto.
 */
export function detectarEnvase(presentacion = '') {
  const p = (presentacion ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')    // elimina tildes
  if (p.includes('BIN'))                                       return { tipoEnvase: 'bin',    capacidadTambor: null }
  if (p.includes('BOLSA') || p.includes('POLVO') || p.includes('PELLET')) return { tipoEnvase: 'bolsa',  capacidadTambor: null }
  if ((p.includes('BIDON') || p.includes('BALDE')) && !p.includes('TAMBOR')) return { tipoEnvase: 'bidon',  capacidadTambor: null }
  return { tipoEnvase: 'tambor', capacidadTambor: 200 }
}

export function labelApilable(apilable) {
  if (apilable === 'si')                  return { text: 'Apilable',                  color: 'bg-green-50 text-green-700' }
  if (apilable === 'no')                  return { text: 'No apilable',               color: 'bg-red-50 text-red-700' }
  if (apilable === 'consultar_produccion') return { text: 'Consultar a Producción',   color: 'bg-amber-50 text-amber-700' }
  return { text: '—', color: 'bg-gray-100 text-gray-500' }
}
