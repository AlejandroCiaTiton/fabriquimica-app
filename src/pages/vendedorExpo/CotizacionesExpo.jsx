import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  usePedidosExpo, useEnviarAProduccion,
  useCancelarPedidoExpo,
  useClientesExpo, useCrearClienteExterior, useConvertirACotizacion,
  useRecotizarExpo, useSincronizarLineas, usePreciosExpo,
} from '../../hooks/useExpo'
import {
  labelApilable, ENVASE_LABELS, INCOTERMS, CAPS_TAMBOR,
  calcularDimensionamiento,
} from '../../lib/dimensionamiento'
import DimTree, { splitNotas, PackingManual } from '../../components/DimTree'

const ESTADO_BADGE = {
  borrador:             { text: 'Borrador',           color: 'bg-gray-100 text-gray-600' },
  pendiente_produccion: { text: 'En Producción',      color: 'bg-purple-50 text-purple-700' },
  pendiente_comex:      { text: 'En COMEX',           color: 'bg-amber-50 text-amber-700' },
  cotizado:             { text: 'Revisar precios',    color: 'bg-blue-50 text-blue-700' },
  aprobado:             { text: 'Enviado al cliente', color: 'bg-green-50 text-green-700' },
  cancelado:            { text: 'Cancelado',          color: 'bg-red-50 text-red-600' },
}

const INPUT_SM = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white'

function fmt(n, dec = 2) {
  if (n == null) return '—'
  return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: dec })
}

function Row({ label, val }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{val}</span>
    </>
  )
}

// ── Tree read-only view ───────────────────────────────────────────────────────

// ── Selector de cliente ───────────────────────────────────────────────────────

function SelectorCliente({ clienteId, onChange }) {
  const { data: clientes = [] } = useClientesExpo()
  const crearExterior = useCrearClienteExterior()

  const [modo, setModo]               = useState(clienteId ? 'existente' : 'ninguno')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPais, setNuevoPais]     = useState('')
  const [errCliente, setErrCliente]   = useState('')

  async function handleCrear() {
    setErrCliente('')
    if (!nuevoNombre.trim()) return setErrCliente('Ingresá la razón social.')
    if (!nuevoPais.trim())   return setErrCliente('Ingresá el país.')
    try {
      const nuevo = await crearExterior.mutateAsync({ razonSocial: nuevoNombre.trim(), pais: nuevoPais.trim() })
      onChange(nuevo.id)
      setModo('existente')
    } catch (e) { setErrCliente(e.message) }
  }

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={clienteId ?? ''}
          onChange={e => {
            const v = e.target.value
            if (v === '__nuevo__') { setModo('nuevo'); onChange(null) }
            else { onChange(v ? parseInt(v) : null); setModo('existente') }
          }}
          className={INPUT_SM}
        >
          <option value="">— Seleccioná un cliente —</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.razon_social}{c.es_exterior ? ` (${c.pais ?? 'Exterior'})` : ''}
            </option>
          ))}
          <option value="__nuevo__">+ Registrar nuevo cliente del exterior…</option>
        </select>
      </div>

      {clienteSeleccionado && (
        <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">
          Cliente: <strong>{clienteSeleccionado.razon_social}</strong>
          {clienteSeleccionado.es_exterior && ` · ${clienteSeleccionado.pais ?? 'Exterior'}`}
        </p>
      )}

      {modo === 'nuevo' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600">Nuevo cliente del exterior</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Razón social *" className={INPUT_SM}/>
            <input value={nuevoPais}   onChange={e => setNuevoPais(e.target.value)}   placeholder="País *"          className={INPUT_SM}/>
          </div>
          {errCliente && <p className="text-xs text-red-600">{errCliente}</p>}
          <button type="button" onClick={handleCrear} disabled={crearExterior.isPending}
            className="text-sm font-medium text-[#004a99] hover:underline disabled:opacity-50">
            {crearExterior.isPending ? 'Registrando…' : 'Registrar y seleccionar'}
          </button>
        </div>
      )}
    </div>
  )
}

const LISTAS = [
  { key: 'lista1_may', label: 'L1', title: 'Lista 1 · Mayorista' },
  { key: 'lista4_std', label: 'L4', title: 'Lista 4 · Estándar' },
  { key: 'lista3_min', label: 'L3', title: 'Lista 3 · Minorista' },
]

const TIPOS_SOLIDO  = ['bolsa']
const TIPOS_LIQUIDO = ['tambor', 'bidon', 'bin']

// ── Modal detalle ─────────────────────────────────────────────────────────────

function DetallePedido({ pedido, onClose }) {
  const enviar    = useEnviarAProduccion()
  const cancelar  = useCancelarPedidoExpo()
  const convertir = useConvertirACotizacion()
  const recotizar = useRecotizarExpo()
  const sincronizar = useSincronizarLineas()

  const [precios, setPrecios]       = useState(() =>
    Object.fromEntries((pedido.pedidos_expo_items ?? []).map(it => [it.id, it.precio_usd ?? '']))
  )
  const [clienteId, setClienteId]   = useState(pedido.cliente_id ?? null)
  const [incoterm, setIncoterm]     = useState(pedido.incoterm ?? '')
  const [puertoDescarga, setPuerto] = useState(pedido.puerto_descarga ?? '')
  const [errMsg, setErrMsg]         = useState('')

  // ── per-item dimension config state (used in borrador) ──────────────────────
  const [lineas, setLineas] = useState(() =>
    (pedido.pedidos_expo_items ?? []).map((it, idx) => {
      const kg      = parseFloat(it.cantidad_kg) || 0
      const tipoRaw = it.tipo_envase
      const tipoBase = tipoRaw === 'tambor_bin' ? 'tambor'
                     : tipoRaw === 'bidon_bin'  ? 'bidon'
                     : tipoRaw ?? 'tambor'
      const usarBin = tipoRaw === 'tambor_bin' || tipoRaw === 'bidon_bin'
                   || (kg >= 1000 && (tipoBase === 'tambor' || tipoBase === 'bidon'))
      return {
        lineKey:        String(it.id ?? `new-${idx}`),
        itemId:         it.id ?? null,
        productoId:     it.producto_id,
        productoNombre: it.producto_nombre,
        kgLinea:        kg,
        tipoEnvase:     tipoBase,
        capacidadTambor: it.capacidad_tambor ?? 200,
        tipoPallet:     it.tipo_pallet ?? 'madera',
        usarBin,
      }
    })
  )
  const [idsEliminar, setIdsEliminar] = useState([])

  const dimsLineas = useMemo(() =>
    lineas.map(l =>
      calcularDimensionamiento({
        tipoEnvase:      l.tipoEnvase,
        capacidadTambor: l.capacidadTambor,
        tipoPallet:      l.tipoPallet,
        totalKg:         l.kgLinea,
        densidadBidon:   1.0,
        usarBin:         l.usarBin,
      })
    ), [lineas]
  )

  // Productos únicos para el editor de líneas
  const productosUnicos = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const l of lineas) {
      const pid = l.productoId ?? l.productoNombre
      if (!seen.has(pid)) { seen.add(pid); result.push({ productoId: l.productoId, productoNombre: l.productoNombre }) }
    }
    return result
  }, [lineas])

  function updateLinea(lineKey, patch) {
    setLineas(prev => prev.map(l => l.lineKey === lineKey ? { ...l, ...patch } : l))
  }

  function addLinea(productoId, productoNombre) {
    const pid = productoId ?? productoNombre
    const existentes = lineas.filter(l => (l.productoId ?? l.productoNombre) === pid)
    const usaSolido  = existentes.some(l => TIPOS_SOLIDO.includes(l.tipoEnvase))
    setLineas(prev => [...prev, {
      lineKey:        `new-${Date.now()}`,
      itemId:         null,
      productoId,
      productoNombre,
      kgLinea:        0,
      tipoEnvase:     usaSolido ? 'bolsa' : 'tambor',
      capacidadTambor: 200,
      tipoPallet:     'madera',
      usarBin:        false,
    }])
  }

  function removeLinea(lineKey) {
    const l = lineas.find(x => x.lineKey === lineKey)
    if (l?.itemId != null) setIdsEliminar(prev => [...prev, l.itemId])
    setLineas(prev => prev.filter(x => x.lineKey !== lineKey))
  }

  const productoIds = useMemo(() =>
    [...new Set((pedido.pedidos_expo_items ?? []).map(it => it.producto_id).filter(Boolean))],
    [pedido]
  )
  const { data: preciosLista = {} } = usePreciosExpo(productoIds)

  const enRevision     = pedido.estado === 'cotizado'
  const enRecotizacion = pedido.estado === 'aprobado' && pedido.cotizacion?.estado === 'revision'

  function getPrecio(it)   { return parseFloat(precios[it.id]) || 0 }
  function getSubtotal(it) {
    const p  = getPrecio(it)
    const kg = parseFloat(it.cantidad_kg) || 0
    return p && kg ? p * kg : parseFloat(it.subtotal_usd) || 0
  }

  const totalProducto = (pedido.pedidos_expo_items ?? []).reduce((s, it) => s + getSubtotal(it), 0)

  async function handleEnviarAlCliente() {
    setErrMsg('')
    if (!clienteId) return setErrMsg('Seleccioná o registrá el cliente antes de enviar.')
    try {
      const items = (pedido.pedidos_expo_items ?? []).map(it => ({
        id: it.id, producto_id: it.producto_id,
        cantidad_kg:  it.cantidad_kg,
        precio_usd:   getPrecio(it)    || null,
        subtotal_usd: getSubtotal(it)  || null,
      }))
      await convertir.mutateAsync({ pedidoId: pedido.id, clienteId, items, observaciones: pedido.notas_vendedor || null })
      onClose()
    } catch (e) { setErrMsg(e.message) }
  }

  async function handleRecotizar() {
    setErrMsg('')
    if (!clienteId) return setErrMsg('Seleccioná el cliente antes de recotizar.')
    try {
      const items = (pedido.pedidos_expo_items ?? []).map(it => ({
        id: it.id, producto_id: it.producto_id,
        cantidad_kg:  it.cantidad_kg,
        precio_usd:   getPrecio(it)    || null,
        subtotal_usd: getSubtotal(it)  || null,
      }))
      await recotizar.mutateAsync({ pedidoId: pedido.id, clienteId, items, observaciones: pedido.notas_vendedor || null })
      onClose()
    } catch (e) { setErrMsg(e.message) }
  }

  async function handleEnviarAProduccion() {
    setErrMsg('')
    if (!incoterm.trim()) return setErrMsg('Ingresá el Incoterm antes de enviar a producción.')
    try {
      const lineasData = lineas.map((l, i) => {
        const dim = dimsLineas[i]
        const te  = l.usarBin && l.tipoEnvase === 'bidon'  ? 'bidon_bin'
                  : l.usarBin && l.tipoEnvase === 'tambor' ? 'tambor_bin'
                  : l.tipoEnvase
        return {
          itemId:          l.itemId,
          productoId:      l.productoId,
          productoNombre:  l.productoNombre,
          cantidad_kg:     l.kgLinea,
          tipo_envase:     te,
          capacidad_tambor: (te === 'tambor' || te === 'tambor_bin') ? l.capacidadTambor : null,
          tipo_pallet:     l.tipoPallet,
          cantidad_envases: dim?.envases ?? null,
          cantidad_pallets: dim?.pallets ?? null,
          peso_neto:       dim?.neto    ?? null,
          peso_bruto:      dim?.bruto   ?? null,
          apilable:        dim?.apilable ?? null,
          precio_usd:      l.itemId != null && precios[l.itemId] !== '' ? parseFloat(precios[l.itemId]) || null : null,
        }
      })
      await sincronizar.mutateAsync({ pedidoId: pedido.id, lineas: lineasData, idsEliminar })
      await enviar.mutateAsync({ pedidoId: pedido.id, incoterm: incoterm.trim() })
      onClose()
    } catch (e) { setErrMsg(e.message) }
  }

  async function handle(fn, arg) {
    setErrMsg('')
    try { await fn(arg); onClose() } catch (e) { setErrMsg(e.message) }
  }

  const loading = enviar.isPending || cancelar.isPending || convertir.isPending || recotizar.isPending || sincronizar.isPending

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-[10px] shadow-lg w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{pedido.numero}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {pedido.cliente_nombre}{pedido.pais_destino ? ` — ${pedido.pais_destino}` : ''}
              {pedido.puerto_descarga && pedido.estado !== 'borrador' ? ` · ${pedido.puerto_descarga}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {enRecotizacion ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700">
                Cliente pide recotizar
              </span>
            ) : (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADO_BADGE[pedido.estado]?.color}`}>
                {ESTADO_BADGE[pedido.estado]?.text}
              </span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* Alerta recotización */}
          {enRecotizacion && (
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-4 space-y-3">
              <p className="text-sm text-orange-800 font-medium">
                El cliente solicitó recotizar. Revisá los precios y enviá una nueva cotización.
              </p>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">
                  Cliente <span className="text-red-500">*</span>
                </p>
                <SelectorCliente clienteId={clienteId} onChange={setClienteId}/>
              </div>
            </div>
          )}

          {/* Alerta + selector de cliente para revisión de precios */}
          {enRevision && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-3">
              <p className="text-sm text-blue-800">
                COMEX generó la cotización. Revisá los precios, vinculá el cliente y confirmá para continuar el proceso de venta.
              </p>
              {((pedido.flete_usd > 0) || (pedido.seguro_usd > 0) || (pedido.otros_gastos_usd > 0)) && (
                <div className="bg-white/70 rounded p-2.5 text-xs text-blue-700 space-y-1">
                  <p className="font-semibold">Costos incluidos por COMEX (ya prorrateados en los precios):</p>
                  <div className="flex gap-4 flex-wrap">
                    {pedido.flete_usd        > 0 && <span>Flete: USD {fmt(pedido.flete_usd)}</span>}
                    {pedido.seguro_usd       > 0 && <span>Seguro: USD {fmt(pedido.seguro_usd)}</span>}
                    {pedido.otros_gastos_usd > 0 && <span>Otros: USD {fmt(pedido.otros_gastos_usd)}</span>}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">
                  Cliente <span className="text-red-500">*</span>
                </p>
                <SelectorCliente clienteId={clienteId} onChange={setClienteId}/>
              </div>
            </div>
          )}

          {/* Cliente vinculado (lectura) en otros estados */}
          {!enRevision && !enRecotizacion && pedido.cliente && (
            <div className="text-sm text-gray-600">
              Cliente: <strong>{pedido.cliente.razon_social}</strong>
              {pedido.cliente.es_exterior && (
                <span className="ml-2 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Exterior · {pedido.cliente.pais ?? '—'}
                </span>
              )}
              {pedido.cotizacion && (
                <span className="ml-2 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {pedido.cotizacion.codigo}
                </span>
              )}
            </div>
          )}

          {/* Incoterm + Puerto — editables solo en borrador */}
          {pedido.estado === 'borrador' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Incoterm <span className="text-red-500">*</span>
                </label>
                <select value={incoterm} onChange={e => setIncoterm(e.target.value)} className={INPUT_SM}>
                  <option value="">— Seleccioná un Incoterm —</option>
                  {INCOTERMS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Puerto / Localidad de descarga</label>
                <input type="text" value={puertoDescarga} onChange={e => setPuerto(e.target.value)}
                  placeholder="Puerto de Callao, Montevideo…" className={INPUT_SM}/>
              </div>
            </div>
          )}

          {/* Info logística en otros estados */}
          {pedido.estado !== 'borrador' && (pedido.incoterm || pedido.puerto_descarga) && (
            <div className="flex gap-4 text-sm text-gray-600">
              {pedido.incoterm && (
                <span>Incoterm: <strong className="text-[#004a99]">{pedido.incoterm}</strong></span>
              )}
              {pedido.puerto_descarga && (
                <span>Puerto: <strong>{pedido.puerto_descarga}</strong></span>
              )}
            </div>
          )}

          {/* ── BORRADOR: editor de líneas de envase por producto ── */}
          {pedido.estado === 'borrador' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dimensionamiento por producto
              </p>
              <div className="space-y-3">
                {productosUnicos.map(({ productoId, productoNombre }) => {
                  const pid         = productoId ?? productoNombre
                  const lineasProd  = lineas.map((l, i) => ({ l, i })).filter(({ l }) => (l.productoId ?? l.productoNombre) === pid)
                  const kgTotal     = lineasProd.reduce((s, { l }) => s + (l.kgLinea || 0), 0)

                  return (
                    <div key={pid} className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {/* Encabezado producto */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">{productoNombre}</p>
                        <span className="text-xs text-gray-500 font-medium">{kgTotal.toLocaleString('es-AR')} kg total</span>
                      </div>

                      {/* Líneas de envase */}
                      {lineasProd.map(({ l, i }) => {
                        const dim = dimsLineas[i]
                        const otrasLineas   = lineasProd.filter(({ l: o }) => o.lineKey !== l.lineKey)
                        const tieneSolido   = otrasLineas.some(({ l: o }) => TIPOS_SOLIDO.includes(o.tipoEnvase))
                        const tieneLiquido  = otrasLineas.some(({ l: o }) => TIPOS_LIQUIDO.includes(o.tipoEnvase))
                        const deshabilitado = new Set([
                          ...(tieneSolido  ? TIPOS_LIQUIDO : []),
                          ...(tieneLiquido ? TIPOS_SOLIDO  : []),
                        ])
                        return (
                          <div key={l.lineKey} className="flex items-start gap-2 bg-white rounded border border-gray-100 p-2">
                            {/* Selector de tipo */}
                            <div className="flex flex-wrap gap-1 flex-1">
                              {['bin', 'tambor', 'bolsa', 'bidon'].map(v => {
                                const off = deshabilitado.has(v)
                                return (
                                  <button key={v} type="button"
                                    disabled={off}
                                    onClick={() => updateLinea(l.lineKey, { tipoEnvase: v, usarBin: false })}
                                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                      off
                                        ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                                        : l.tipoEnvase === v
                                        ? 'border-[#004a99] bg-blue-50 text-[#004a99] font-medium'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}>
                                    {ENVASE_LABELS[v]}
                                  </button>
                                )
                              })}

                              {l.tipoEnvase === 'tambor' && CAPS_TAMBOR.map(c => (
                                <button key={c} type="button"
                                  onClick={() => updateLinea(l.lineKey, { capacidadTambor: c })}
                                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                    l.capacidadTambor === c
                                      ? 'border-[#004a99] bg-blue-50 text-[#004a99] font-medium'
                                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}>
                                  {c} kg
                                </button>
                              ))}

                              {/* Kg de esta línea */}
                              <div className="flex items-center gap-1 ml-1">
                                <input
                                  type="number" min="0" step="1"
                                  value={l.kgLinea || ''}
                                  onChange={e => {
                                    const kg = parseFloat(e.target.value) || 0
                                    const usarBin = kg >= 1000 && (l.tipoEnvase === 'tambor' || l.tipoEnvase === 'bidon')
                                    updateLinea(l.lineKey, { kgLinea: kg, usarBin })
                                  }}
                                  placeholder="kg"
                                  className="w-20 text-xs text-center border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#004a99]"
                                />
                                <span className="text-xs text-gray-400">kg</span>
                              </div>

                              {/* Resultado calculado */}
                              {dim && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
                                  {dim.bines != null && dim.tambores != null && dim.bidones > 0
                                    ? <><strong>{dim.bines}</strong>bin + <strong>{dim.tambores}</strong>tamb. + <strong>{dim.bidones}</strong>bid.</>
                                    : dim.bines != null && dim.tambores != null
                                    ? <><strong>{dim.bines}</strong>bin + <strong>{dim.tambores}</strong>tamb.</>
                                    : dim.bines != null
                                    ? <><strong>{dim.bines}</strong>bin + <strong>{dim.bidones}</strong>bid.</>
                                    : <><strong>{dim.envases}</strong> env.</>
                                  }
                                  <span className="text-blue-300">·</span>
                                  <span>{dim.bruto?.toLocaleString('es-AR')} kg bruto</span>
                                </div>
                              )}
                            </div>

                            {/* Botón quitar línea */}
                            <button type="button" onClick={() => removeLinea(l.lineKey)}
                              className="p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition-colors flex-shrink-0 mt-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            </button>
                          </div>
                        )
                      })}

                      {/* Agregar tipo de envase */}
                      <button type="button"
                        onClick={() => addLinea(productoId, productoNombre)}
                        className="w-full text-xs text-[#004a99] border border-dashed border-[#004a99]/30 rounded py-1.5 hover:bg-blue-50 transition-colors">
                        + Agregar tipo de envase
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Total preview */}
              {dimsLineas.some(d => d != null) && (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 grid grid-cols-3 gap-x-6 text-sm">
                  <div>
                    <p className="text-xs text-blue-600">Total envases</p>
                    <p className="font-semibold text-gray-800">
                      {dimsLineas.reduce((s, d) => s + (d?.envases ?? 0), 0).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Peso neto</p>
                    <p className="font-semibold text-gray-800">
                      {dimsLineas.reduce((s, d) => s + (d?.neto ?? 0), 0).toLocaleString('es-AR')} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Peso bruto</p>
                    <p className="font-semibold text-gray-800">
                      {dimsLineas.reduce((s, d) => s + (d?.bruto ?? 0), 0).toLocaleString('es-AR')} kg
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Productos (prices — editable in cotizado/recotizar) */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Productos</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left pb-1.5 font-medium">Producto</th>
                  <th className="text-right pb-1.5 font-medium">Cant. (kg)</th>
                  <th className="text-right pb-1.5 font-medium">USD/kg</th>
                  <th className="text-right pb-1.5 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(pedido.pedidos_expo_items ?? []).map(it => {
                  const sub = getSubtotal(it)
                  const editable = enRevision || enRecotizacion || pedido.estado === 'borrador'
                  const listaProd = it.producto_id ? preciosLista[it.producto_id] : null
                  return (
                    <tr key={it.id}>
                      <td className="py-2 text-gray-800">{it.producto_nombre}</td>
                      <td className="py-2 text-right text-gray-600">{fmt(it.cantidad_kg)}</td>
                      <td className="py-2 text-right">
                        {editable ? (
                          <div className="flex flex-col items-end gap-1">
                            {pedido.estado === 'borrador' && listaProd && (
                              <div className="flex items-center gap-1">
                                {LISTAS.map(l => {
                                  const val = listaProd[l.key]
                                  if (!val) return null
                                  const active = parseFloat(precios[it.id]) === parseFloat(val)
                                  return (
                                    <button key={l.key} type="button"
                                      title={`${l.title}: USD ${val}`}
                                      onClick={() => setPrecios(p => ({ ...p, [it.id]: String(val) }))}
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                                        active
                                          ? 'bg-[#004a99] text-white'
                                          : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-[#004a99]'
                                      }`}>
                                      {l.label}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-400 text-xs">USD</span>
                              <input
                                type="number" min="0" step="0.0001"
                                value={precios[it.id]}
                                onChange={e => setPrecios(p => ({ ...p, [it.id]: e.target.value }))}
                                className="w-24 text-sm text-right border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600">{it.precio_usd ? `USD ${fmt(it.precio_usd, 4)}` : '—'}</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {sub > 0 ? `USD ${fmt(sub)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {totalProducto > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-2 text-xs text-gray-500">Total</td>
                    <td className="pt-2 text-right font-bold text-gray-900">USD {fmt(totalProducto)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Dimensionamiento (tree view — non-borrador) */}
          {pedido.estado !== 'borrador' && (() => {
            const { packing, other } = splitNotas(pedido.notas_produccion)
            return (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Dimensionamiento de carga
                </p>
                {packing
                  ? <PackingManual text={packing}/>
                  : <DimTree items={pedido.pedidos_expo_items ?? []}/>
                }
              </div>
            )
          })()}

          {pedido.notas_vendedor && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observaciones</p>
              <p className="text-sm text-gray-700">{pedido.notas_vendedor}</p>
            </div>
          )}

          {(() => {
            const esRechazado = pedido.estado === 'borrador'
            const { other } = splitNotas(pedido.notas_produccion)
            const texto = esRechazado ? pedido.notas_produccion : other
            if (!texto) return null
            return (
              <div className={`rounded-lg px-4 py-3 ${esRechazado ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${esRechazado ? 'text-red-600' : 'text-blue-600'}`}>
                  {esRechazado ? 'Rechazado por Producción' : 'Nota de Producción'}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{texto}</p>
              </div>
            )
          })()}

          {errMsg && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errMsg}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          {pedido.estado === 'borrador' && (
            <>
              <button onClick={() => handle(id => cancelar.mutateAsync(id), pedido.id)}
                disabled={loading}
                className="px-4 py-2 text-sm text-red-600 hover:underline disabled:opacity-50">
                Cancelar pedido
              </button>
              <button onClick={handleEnviarAProduccion}
                disabled={loading}
                className="px-5 py-2 text-sm font-semibold bg-[#004a99] text-white rounded-lg hover:bg-[#003d80] disabled:opacity-50 flex items-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Enviar a Producción
              </button>
            </>
          )}
          {enRevision && (
            <>
              <button onClick={() => handle(id => cancelar.mutateAsync(id), pedido.id)}
                disabled={loading}
                className="px-4 py-2 text-sm text-red-600 hover:underline disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleEnviarAlCliente} disabled={loading}
                className="px-5 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Confirmar y enviar al cliente
              </button>
            </>
          )}
          {enRecotizacion && (
            <>
              <button onClick={() => handle(id => cancelar.mutateAsync(id), pedido.id)}
                disabled={loading}
                className="px-4 py-2 text-sm text-red-600 hover:underline disabled:opacity-50">
                Cancelar pedido
              </button>
              <button onClick={handleRecotizar} disabled={loading}
                className="px-5 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Enviar nueva cotización al cliente
              </button>
            </>
          )}
          {(pedido.estado === 'aprobado' && !enRecotizacion) || pedido.estado === 'pendiente_comex' || pedido.estado === 'pendiente_produccion' || pedido.estado === 'cancelado' ? (
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cerrar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function CotizacionesExpo() {
  const navigate = useNavigate()
  const { data: pedidos = [], isLoading } = usePedidosExpo()
  const [detalle, setDetalle] = useState(null)

  const aRevisar   = pedidos.filter(p => p.estado === 'cotizado').length
  const aRecotizar = pedidos.filter(p => p.estado === 'aprobado' && p.cotizacion?.estado === 'revision').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cotizaciones EXPO</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
            {aRevisar   > 0 && <span className="ml-2 text-blue-600 font-semibold">· {aRevisar} para revisar</span>}
            {aRecotizar > 0 && <span className="ml-2 text-orange-600 font-semibold">· {aRecotizar} para recotizar</span>}
          </p>
        </div>
        <button onClick={() => navigate('/vendedor/expo-nueva')}
          className="flex items-center gap-2 px-4 py-2 bg-[#004a99] text-white text-sm font-semibold rounded-lg hover:bg-[#003d80] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Nueva cotización
        </button>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : pedidos.length === 0
          ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400 mb-4">Todavía no creaste ninguna cotización EXPO</p>
              <button onClick={() => navigate('/vendedor/expo-nueva')}
                className="px-4 py-2 bg-[#004a99] text-white text-sm font-semibold rounded-lg hover:bg-[#003d80]">
                Crear primera cotización
              </button>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nº</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">País</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Incoterm</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Kg netos</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total USD</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pedidos.map(p => {
                const necesitaRecotizar = p.estado === 'aprobado' && p.cotizacion?.estado === 'revision'
                const badge = necesitaRecotizar
                  ? { text: 'Recotizar', color: 'bg-orange-50 text-orange-700' }
                  : (ESTADO_BADGE[p.estado] ?? ESTADO_BADGE.borrador)
                const totalUsd = (p.pedidos_expo_items ?? []).reduce((s, it) => s + (parseFloat(it.subtotal_usd) || 0), 0)
                return (
                  <tr key={p.id} onClick={() => setDetalle(p)}
                    className={`hover:bg-gray-50 cursor-pointer ${p.estado === 'cotizado' ? 'bg-blue-50/40' : necesitaRecotizar ? 'bg-orange-50/40' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.numero}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{p.cliente_nombre}</p>
                      {p.cliente?.es_exterior && (
                        <p className="text-xs text-amber-600">{p.cliente.pais ?? 'Exterior'}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.pais_destino || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[#004a99]">{p.incoterm || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.peso_neto != null ? `${parseFloat(p.peso_neto).toLocaleString('es-AR')} kg` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{totalUsd > 0 ? `USD ${fmt(totalUsd)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>{badge.text}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.creado_en).toLocaleDateString('es-AR')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {detalle && <DetallePedido pedido={detalle} onClose={() => setDetalle(null)}/>}
    </div>
  )
}
