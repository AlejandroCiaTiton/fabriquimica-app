import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAPS_TAMBOR, INCOTERMS, ENVASE_LABELS,
  calcularDimensionamiento, calcularPalletsAgrupados, labelApilable, detectarEnvase,
} from '../../lib/dimensionamiento'
import { useCatalogoExpo, useCrearPedidoExpo, useEnviarAProduccion } from '../../hooks/useExpo'

// ── Constantes ────────────────────────────────────────────────────────────────

const INPUT = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white'

const ITEM_VACIO = () => ({
  productoId: null, productoNombre: '', presentacion: '',
  cantidadKg: '', precioUsd: '', subtotalUsd: '',
  tipoEnvase: 'tambor', capacidadTambor: 200, tipoPallet: 'madera',
  usarBin: false, densidadBidon: '1.0',
})

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-[10px] shadow-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Fila de producto ──────────────────────────────────────────────────────────

function FilaItem({ item, dim, productos, onChange, onRemove }) {
  const match = productos.find(p => `${p.nombre} (${p.codigo})` === item.productoNombre)
  const precios = match?.precios_actuales?.[0] ?? match?.precios_actuales ?? null

  const LISTAS = precios ? [
    { label: 'Mayorista', val: precios.lista1_may },
    { label: 'Estándar',  val: precios.lista4_std },
    { label: 'Minorista', val: precios.lista3_min },
  ].filter(l => l.val != null) : []

  function aplicarPrecio(precio) {
    const p = String(precio)
    const sub = p && item.cantidadKg
      ? (parseFloat(p) * parseFloat(item.cantidadKg)).toFixed(2) : ''
    onChange({ ...item, precioUsd: p, subtotalUsd: sub })
  }

  const kg = parseFloat(item.cantidadKg) || 0
  const canUseBin = (item.tipoEnvase === 'bidon' || item.tipoEnvase === 'tambor') && kg >= 1000

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 space-y-2.5">
      {/* Fila principal */}
      <div className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <input
            list="expo-productos"
            value={item.productoNombre}
            onChange={e => {
              const m = productos.find(p => `${p.nombre} (${p.codigo})` === e.target.value)
              const det = m ? detectarEnvase(m.presentacion) : null
              onChange({
                ...item,
                productoNombre: e.target.value,
                productoId: m?.id ?? null,
                presentacion: m?.presentacion ?? '',
                ...(det ? {
                  tipoEnvase: det.tipoEnvase,
                  capacidadTambor: det.capacidadTambor ?? 200,
                  usarBin: false,
                } : {}),
              })
            }}
            placeholder="Producto…"
            className={INPUT}
          />
        </div>
        <input
          type="number" min="0" step="0.01"
          value={item.cantidadKg}
          onChange={e => {
            const kg = e.target.value
            const sub = kg && item.precioUsd
              ? (parseFloat(kg) * parseFloat(item.precioUsd)).toFixed(2) : ''
            onChange({ ...item, cantidadKg: kg, subtotalUsd: sub })
          }}
          placeholder="Cant. (kg)"
          className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
        />
        <div className="relative w-32">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">USD</span>
          <input
            type="number" min="0" step="0.0001"
            value={item.precioUsd}
            onChange={e => onChange({ ...item, precioUsd: e.target.value,
              subtotalUsd: e.target.value && item.cantidadKg
                ? (parseFloat(e.target.value) * parseFloat(item.cantidadKg)).toFixed(2) : '' })}
            placeholder="Precio"
            className="w-full text-sm border border-gray-200 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          />
        </div>
        <div className="w-28 text-sm text-gray-500 px-2 py-2 text-right">
          {item.subtotalUsd
            ? `USD ${parseFloat(item.subtotalUsd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
            : '—'}
        </div>
        <button onClick={onRemove} className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Listas de precio */}
      {LISTAS.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Listas:</span>
          {LISTAS.map(l => (
            <button key={l.label} type="button" onClick={() => aplicarPrecio(l.val)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                parseFloat(item.precioUsd) === parseFloat(l.val)
                  ? 'border-[#004a99] bg-blue-50 text-[#004a99] font-semibold'
                  : 'border-gray-200 text-gray-500 hover:border-[#004a99] hover:text-[#004a99]'
              }`}>
              {l.label} · USD {parseFloat(l.val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </button>
          ))}
        </div>
      )}

      {/* Envase + dimensionamiento */}
      {kg > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tipo envase — excluye bidon_bin y mixto del selector manual */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-1">Envase:</span>
            {['bin', 'tambor', 'bolsa', 'bidon'].map(v => (
              <button key={v} type="button"
                onClick={() => onChange({ ...item, tipoEnvase: v, usarBin: false,
                  tipoPallet: v === 'bidon' ? 'madera' : item.tipoPallet })}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  item.tipoEnvase === v
                    ? 'border-[#004a99] bg-blue-50 text-[#004a99] font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                {ENVASE_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Densidad bidón */}
          {item.tipoEnvase === 'bidon' && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Densidad:</span>
              <input
                type="number" min="0.5" max="3" step="0.01"
                value={item.densidadBidon}
                onChange={e => onChange({ ...item, densidadBidon: e.target.value })}
                className="w-16 text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#004a99]"
              />
              <span className="text-xs text-gray-400">kg/L</span>
            </div>
          )}

          {/* Capacidad tambor */}
          {item.tipoEnvase === 'tambor' && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-1">Cap.:</span>
              {CAPS_TAMBOR.map(c => (
                <button key={c} type="button" onClick={() => onChange({ ...item, capacidadTambor: c })}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    item.capacidadTambor === c
                      ? 'border-[#004a99] bg-blue-50 text-[#004a99] font-medium'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {c} kg
                </button>
              ))}
            </div>
          )}

          {/* Tipo pallet (tambor y bolsa) */}
          {(item.tipoEnvase === 'tambor' || item.tipoEnvase === 'bolsa') && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-1">Pallet:</span>
              {[['madera', 'Madera'], ['plastico', 'Plástico']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => onChange({ ...item, tipoPallet: v })}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    item.tipoPallet === v
                      ? 'border-[#004a99] bg-blue-50 text-[#004a99] font-medium'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Upgrade a Bin + Bidones para el resto */}
          {canUseBin && (
            <button type="button"
              onClick={() => onChange({ ...item, usarBin: !item.usarBin })}
              className={`text-xs px-2.5 py-0.5 rounded border transition-colors ${
                item.usarBin
                  ? 'border-amber-400 bg-amber-50 text-amber-700 font-medium'
                  : 'border-amber-200 text-amber-600 hover:bg-amber-50'
              }`}>
              {item.usarBin
                ? `↓ Solo ${item.tipoEnvase === 'tambor' ? 'Tambores' : 'Bidones'}`
                : `↑ Bins para el grueso + ${item.tipoEnvase === 'tambor' ? 'Tambores' : 'Bidones'} para el resto`}
            </button>
          )}

          {/* Resultado compacto */}
          {dim && (
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-600 bg-white border border-gray-100 rounded px-3 py-1.5">
              {dim.bines != null && dim.tambores != null ? (
                // Modo mixto bin + tambor
                <>
                  <span><strong>{dim.bines}</strong> bin{dim.bines !== 1 ? 's' : ''}</span>
                  <span className="text-gray-300">+</span>
                  <span><strong>{dim.tambores}</strong> tambor{dim.tambores !== 1 ? 'es' : ''}</span>
                </>
              ) : dim.bines != null ? (
                // Modo mixto bin + bidón
                <>
                  <span><strong>{dim.bines}</strong> bin{dim.bines !== 1 ? 's' : ''}</span>
                  <span className="text-gray-300">+</span>
                  <span><strong>{dim.bidones}</strong> bidón{dim.bidones !== 1 ? 'es' : ''}</span>
                </>
              ) : (
                <span><strong>{dim.envases}</strong> env.</span>
              )}
              <span className="text-gray-300">·</span>
              <span><strong>{dim.bruto.toLocaleString('es-AR')}</strong> kg bruto</span>
              <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${labelApilable(dim.apilable).color}`}>
                {labelApilable(dim.apilable).text}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel de totales ──────────────────────────────────────────────────────────

function PanelTotales({ dimsItems, items }) {
  const itemsConDim  = items.map((it, i) => ({ ...it, dim: dimsItems[i] }))
  const totalEnvases = dimsItems.reduce((s, d) => s + (d?.envases ?? 0), 0)
  const totalPallets = calcularPalletsAgrupados(itemsConDim)
  const totalNeto    = dimsItems.reduce((s, d) => s + (d?.neto    ?? 0), 0)
  const totalBruto   = dimsItems.reduce((s, d) => s + (d?.bruto   ?? 0), 0)

  if (!totalPallets && !totalEnvases) return null

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-3">
      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
        Dimensionamiento total del embarque
      </p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
        <span className="text-gray-500">Total envases</span>
        <span className="font-semibold text-gray-800">{totalEnvases.toLocaleString('es-AR')}</span>
        <span className="text-gray-500">Total pallets</span>
        <span className="font-semibold text-gray-800">{totalPallets.toLocaleString('es-AR')}</span>
        <span className="text-gray-500">Peso neto total</span>
        <span className="font-semibold text-gray-800">{totalNeto.toLocaleString('es-AR')} kg</span>
        <span className="text-gray-500">Peso bruto total</span>
        <span className="font-semibold text-gray-800">{totalBruto.toLocaleString('es-AR')} kg</span>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function NuevaCotizacionExpo() {
  const navigate = useNavigate()
  const { data: productos = [] } = useCatalogoExpo()
  const crear   = useCrearPedidoExpo()
  const enviarProd = useEnviarAProduccion()

  const [clienteNombre, setClienteNombre]   = useState('')
  const [paisDestino, setPaisDestino]       = useState('')
  const [puertoDescarga, setPuertoDescarga] = useState('')
  const [items, setItems]                   = useState([ITEM_VACIO()])
  const [incoterm, setIncoterm]             = useState('FOB')
  const [notasVendedor, setNotasVendedor]   = useState('')
  const [error, setError]                   = useState('')

  const dimsItems = useMemo(() =>
    items.map(it => {
      const tp = it.tipoEnvase === 'bidon' ? 'madera' : it.tipoPallet
      return calcularDimensionamiento({
        tipoEnvase: it.tipoEnvase,
        capacidadTambor: it.capacidadTambor,
        tipoPallet: tp,
        totalKg: parseFloat(it.cantidadKg) || 0,
        densidadBidon: parseFloat(it.densidadBidon) || 1.0,
        usarBin: it.usarBin,
      })
    }), [items])

  const totalKg  = useMemo(() => items.reduce((s, it) => s + (parseFloat(it.cantidadKg) || 0), 0), [items])
  const totalUsd = useMemo(() => items.reduce((s, it) => s + (parseFloat(it.subtotalUsd) || 0), 0), [items])

  function addItem()           { setItems(prev => [...prev, ITEM_VACIO()]) }
  function updateItem(i, data) { setItems(prev => prev.map((it, idx) => idx === i ? data : it)) }
  function removeItem(i)       { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit(enviarAProduccion) {
    setError('')
    if (!clienteNombre.trim())  return setError('El nombre del cliente es obligatorio.')
    if (!incoterm)              return setError('Seleccioná un Incoterm.')
    const itemsValidos = items.filter(it => it.productoNombre.trim() && parseFloat(it.cantidadKg) > 0)
    if (itemsValidos.length === 0) return setError('Agregá al menos un producto con cantidad.')

    const itemsConDim = itemsValidos.map(it => {
      const te = it.usarBin && it.tipoEnvase === 'bidon'   ? 'bidon_bin'
               : it.usarBin && it.tipoEnvase === 'tambor' ? 'tambor_bin'
               : it.tipoEnvase
      const tp = (it.tipoEnvase === 'bidon') ? 'madera' : it.tipoPallet
      return {
        ...it,
        tipoEfectivo:   te,
        palletEfectivo: tp,
        dim: calcularDimensionamiento({
          tipoEnvase: it.tipoEnvase,
          capacidadTambor: it.capacidadTambor,
          tipoPallet: tp,
          totalKg: parseFloat(it.cantidadKg),
          densidadBidon: parseFloat(it.densidadBidon) || 1.0,
          usarBin: it.usarBin,
        }),
      }
    })

    const cantEnvases = itemsConDim.reduce((s, it) => s + (it.dim?.envases ?? 0), 0)
    const cantPallets = calcularPalletsAgrupados(itemsConDim)
    const pesoNeto    = itemsConDim.reduce((s, it) => s + (it.dim?.neto    ?? 0), 0)
    const pesoBruto   = itemsConDim.reduce((s, it) => s + (it.dim?.bruto   ?? 0), 0)
    const apilables   = itemsConDim.map(it => it.dim?.apilable).filter(Boolean)
    const apilable    = apilables.includes('consultar_produccion') ? 'consultar_produccion'
      : apilables.includes('no') ? 'no' : 'si'
    const tipos       = [...new Set(itemsConDim.map(it => it.tipoEfectivo))]
    const tipoHeader  = tipos.length === 1 ? tipos[0] : 'mixto'

    try {
      const pedido = await crear.mutateAsync({
        clienteNombre:   clienteNombre.trim(),
        paisDestino:     paisDestino.trim(),
        puertoDescarga:  puertoDescarga.trim(),
        tipoEnvase:      tipoHeader,
        incoterm,
        cantidadTotalKg: totalKg,
        cantidadEnvases: cantEnvases,
        cantidadPallets: cantPallets,
        pesoNeto, pesoBruto, apilable,
        notasVendedor: notasVendedor.trim(),
        items: itemsConDim,
      })
      if (enviarAProduccion) await enviarProd.mutateAsync({ pedidoId: pedido.id })
      navigate('/vendedor/expo-cotizaciones')
    } catch (e) {
      setError(e.message)
    }
  }

  const loading = crear.isPending || enviarProd.isPending

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/vendedor/expo-cotizaciones')}
          className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva cotización EXPO</h1>
          <p className="text-sm text-gray-400 mt-0.5">Completá los datos del pedido internacional</p>
        </div>
      </div>

      {/* Cliente */}
      <SectionCard title="Cliente internacional">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre / Razón social" required>
            <input className={INPUT} value={clienteNombre}
              onChange={e => setClienteNombre(e.target.value)} placeholder="Empresa o cliente…"/>
          </Field>
          <Field label="País de destino">
            <input className={INPUT} value={paisDestino}
              onChange={e => setPaisDestino(e.target.value)} placeholder="Ej: Brasil, Chile…"/>
          </Field>
        </div>
      </SectionCard>

      {/* Productos */}
      <SectionCard title="Productos y dimensionamiento">
        <p className="text-xs text-gray-400 -mt-1">
          Podés agregar el mismo producto varias veces con distintos envases para dividir la cantidad entre presentaciones (ej: 2.000 kg en Bin IBC + 400 kg en Tambores + 50 kg en Bidones).
        </p>
        <datalist id="expo-productos">
          {productos.map(p => <option key={p.id} value={`${p.nombre} (${p.codigo})`}/>)}
        </datalist>

        <div className="flex gap-2 text-xs font-medium text-gray-500 px-1">
          <div className="flex-1">Producto</div>
          <div className="w-28">Cant. (kg)</div>
          <div className="w-32">Precio USD/kg</div>
          <div className="w-28 text-right">Subtotal</div>
          <div className="w-8"/>
        </div>

        <div className="space-y-2">
          {items.map((it, i) => (
            <FilaItem key={i} item={it} dim={dimsItems[i]} productos={productos}
              onChange={data => updateItem(i, data)}
              onRemove={() => removeItem(i)}/>
          ))}
        </div>

        <button onClick={addItem}
          className="flex items-center gap-2 text-sm text-[#004a99] hover:underline mt-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Agregar producto
        </button>

        {totalUsd > 0 && (
          <div className="flex justify-end pt-2 border-t border-gray-100 text-sm">
            <span className="text-gray-500 mr-3">Total USD</span>
            <span className="font-bold text-gray-900">
              USD {totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <PanelTotales dimsItems={dimsItems} items={items}/>
      </SectionCard>

      {/* Logística */}
      <SectionCard title="Logística">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Incoterm" required>
            <select value={incoterm} onChange={e => setIncoterm(e.target.value)} className={INPUT}>
              {INCOTERMS.map(t => (
                <option key={t.code} value={t.code}>{t.label} — {t.desc}</option>
              ))}
            </select>
          </Field>
          <Field label="Puerto / Localidad de descarga">
            <input className={INPUT} value={puertoDescarga}
              onChange={e => setPuertoDescarga(e.target.value)} placeholder="Puerto de Callao, Montevideo…"/>
          </Field>
        </div>
        <Field label="Observaciones del vendedor">
          <textarea rows={3} value={notasVendedor}
            onChange={e => setNotasVendedor(e.target.value)}
            placeholder="Instrucciones especiales, condiciones, aclaraciones…"
            className={INPUT + ' resize-none'}/>
        </Field>
      </SectionCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button onClick={() => navigate('/vendedor/expo-cotizaciones')}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
          Cancelar
        </button>
        <button onClick={() => handleSubmit(false)} disabled={loading}
          className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
          Guardar borrador
        </button>
        <button onClick={() => handleSubmit(true)} disabled={loading}
          className="px-6 py-2 text-sm font-semibold bg-[#004a99] text-white rounded-lg hover:bg-[#003d80] transition-colors disabled:opacity-50 flex items-center gap-2">
          {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
          Enviar a Producción
        </button>
      </div>
    </div>
  )
}
