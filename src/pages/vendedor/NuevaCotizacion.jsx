import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProductos } from '../../hooks/useProductos'
import { useClientes } from '../../hooks/useClientes'
import { useCrearCotizacion, useActualizarCotizacion, useCotizacion } from '../../hooks/useCotizaciones'
import { useSolicitud } from '../../hooks/useSolicitudes'
import BuscadorContratipos from '../../components/BuscadorContratipos'
import { fmtUSD } from '../../utils/calc'

// ─── helpers ──────────────────────────────────────────────────────────────────

const LISTAS = [
  { key: 'lista1_may', label: 'May' },
  { key: 'lista4_std', label: 'Std' },
  { key: 'lista3_min', label: 'Min' },
]

function getPrecioLista(precios, listaKey) {
  const p = Array.isArray(precios) ? precios[0] : precios
  return p?.[listaKey] ?? null
}

function calcVencimiento(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── sub-componente: fila de ítem ─────────────────────────────────────────────

function ItemRow({ item, index, onChangeCantidad, onChangePrecio, onSetLista, onRemove }) {
  return (
    <div className={`py-3 border-b border-gray-100 last:border-0 ${item._recotizar ? 'bg-yellow-50/40' : ''}`}>
    {item._recotizar && (
      <div className="flex items-center gap-2 mb-2 text-xs text-yellow-800 bg-yellow-100 rounded px-2 py-1">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        <span>
          {item._recotizarTipo === 'cambiar cantidad'
            ? `Cliente pide cambiar cantidad a ${item.cantidad} kg`
            : 'Cliente pide mejora de precio'}
          {item._nota && <> · <em>"{item._nota}"</em></>}
        </span>
      </div>
    )}
    <div className="flex items-start gap-3">
      {/* Info producto */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm leading-snug">{item.nombre}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {item.presentacion} · <span className="font-medium text-gray-600">{item.codigo}</span>
        </p>
      </div>

      {/* Cantidad */}
      <div className="flex flex-col items-center gap-0.5 w-20">
        <label className="text-[10px] text-gray-400 uppercase tracking-wide">Cant.</label>
        <input
          type="number"
          min="0.001"
          step="1"
          value={item.cantidad}
          onChange={e => onChangeCantidad(index, e.target.value)}
          className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99] focus:border-transparent"
        />
      </div>

      {/* Precio + chips */}
      <div className="flex flex-col items-center gap-1 w-36">
        <label className="text-[10px] text-gray-400 uppercase tracking-wide">Precio/kg</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.precio_unitario}
          onChange={e => onChangePrecio(index, e.target.value)}
          className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99] focus:border-transparent"
        />
        <div className="flex gap-1">
          {LISTAS.map(l => {
            const val = item[l.key]
            if (val == null) return null
            const isActive = Math.abs(item.precio_unitario - val) < 0.001
            return (
              <button
                key={l.key}
                onClick={() => onSetLista(index, l.key, val)}
                title={`${l.label}: USD ${val}`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#004a99] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {l.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Subtotal */}
      <div className="flex flex-col items-end justify-center w-28 pt-5">
        <span className="text-sm font-semibold text-gray-800">
          {fmtUSD(item.precio_unitario * item.cantidad)}
        </span>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(index)}
        className="mt-5 p-1.5 text-gray-300 hover:text-[#dc3545] hover:bg-red-50 rounded-lg transition-colors"
        title="Quitar"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
  )
}

// ─── buscador de productos ────────────────────────────────────────────────────

function BuscadorProducto({ productos, itemsActuales, onAgregar, listaDefault, setListaDefault, cantDefault, setCantDefault }) {
  const [busqueda, setBusqueda] = useState('')

  const idsEnCotizacion = new Set(itemsActuales.map(i => i.producto_id))

  const resultados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return []
    return productos
      .filter(p => !idsEnCotizacion.has(p.id) && (
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
      ))
      .slice(0, 8)
  }, [busqueda, productos, idsEnCotizacion])

  function agregar(prod) {
    const precios = Array.isArray(prod.precios_actuales) ? prod.precios_actuales[0] : prod.precios_actuales
    const precio = precios?.[listaDefault] ?? 0
    onAgregar({
      producto_id:   prod.id,
      codigo:        prod.codigo,
      nombre:        prod.nombre,
      presentacion:  prod.presentacion ?? '',
      cantidad:      cantDefault,
      precio_unitario: precio,
      lista_usada:   listaDefault,
      lista1_may:    precios?.lista1_may ?? null,
      lista4_std:    precios?.lista4_std ?? null,
      lista3_min:    precios?.lista3_min ?? null,
    })
    setBusqueda('')
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agregar producto</p>

      {/* Lista default + cant */}
      <div className="flex gap-2 mb-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-1">
          {LISTAS.map(l => (
            <button
              key={l.key}
              onClick={() => setListaDefault(l.key)}
              className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${
                listaDefault === l.key ? 'bg-[#004a99] text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="1"
          value={cantDefault}
          onChange={e => setCantDefault(Number(e.target.value) || 1)}
          className="w-20 text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          title="Cantidad por defecto"
          placeholder="Cant."
        />
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"
        />
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-card">
          {resultados.map(p => {
            const precios = Array.isArray(p.precios_actuales) ? p.precios_actuales[0] : p.precios_actuales
            const precio = precios?.[listaDefault]
            return (
              <button
                key={p.id}
                onClick={() => agregar(p)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 leading-tight">{p.nombre}</p>
                  <p className="text-xs text-gray-400">{p.presentacion} · {p.codigo}</p>
                </div>
                <span className="text-sm font-semibold text-[#004a99] ml-3 flex-shrink-0">
                  {precio != null ? `USD ${precio}` : '—'}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {busqueda && resultados.length === 0 && (
        <p className="text-xs text-gray-400 mt-2 text-center">Sin resultados para "{busqueda}"</p>
      )}
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function NuevaCotizacion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const solicitudId  = searchParams.get('solicitud')
  const recotizarId  = searchParams.get('recotizar')

  const { data: productos = [], isLoading: loadProd } = useProductos()
  const { data: clientes = [], isLoading: loadCli }   = useClientes()
  const { data: solicitud, isLoading: loadSol }        = useSolicitud(solicitudId)
  const { data: cotBase,   isLoading: loadCot }        = useCotizacion(recotizarId)
  const crearCotizacion     = useCrearCotizacion()
  const actualizarCotizacion = useActualizarCotizacion()

  const [clienteId, setClienteId]         = useState('')
  const [items, setItems]                 = useState([])
  const [validezDias, setValidezDias]     = useState(5)
  const [observaciones, setObservaciones] = useState('')
  const [exito, setExito]                 = useState(null)
  const [listaDefault, setListaDefault]   = useState('lista4_std')
  const [cantDefault, setCantDefault]     = useState(100)

  // Pre-cargar desde solicitud
  useEffect(() => {
    if (!solicitud) return
    setClienteId(solicitud.cliente_id ?? '')
    if (solicitud.observaciones) {
      setObservaciones(`Pedido cliente: ${solicitud.observaciones}`)
    }
    const preItems = (solicitud.solicitud_items ?? []).map(si => {
      const prod = si.productos
      const precios = Array.isArray(prod?.precios_actuales)
        ? prod.precios_actuales[0]
        : prod?.precios_actuales
      const precio = precios?.lista4_std ?? 0
      return {
        producto_id:     si.producto_id,
        codigo:          prod?.codigo ?? '',
        nombre:          prod?.nombre ?? '',
        presentacion:    prod?.presentacion ?? '',
        cantidad:        si.cantidad,
        precio_unitario: precio,
        lista_usada:     'lista4_std',
        lista1_may:      precios?.lista1_may ?? null,
        lista4_std:      precios?.lista4_std ?? null,
        lista3_min:      precios?.lista3_min ?? null,
      }
    })
    setItems(preItems)
  }, [solicitud])

  // Pre-cargar desde cotización a recotizar
  useEffect(() => {
    if (!cotBase) return
    setClienteId(cotBase.cliente_id ?? '')
    const todosItems = cotBase.cotizacion_items ?? []
    const conRecotizar = todosItems.filter(it => it.respuesta === 'recotizar')
    // Si el cliente marcó ítems específicos para recotizar, usar solo esos;
    // si no, mostrar todos los ítems de la cotización original
    const base = conRecotizar.length > 0 ? conRecotizar : todosItems
    const preItems = base.map(it => ({
      producto_id:     it.producto_id,
      codigo:          it.productos?.codigo ?? '',
      nombre:          it.productos?.nombre ?? '',
      presentacion:    it.productos?.presentacion ?? '',
      cantidad:        it.cantidad_nueva ?? it.cantidad,
      precio_unitario: it.precio_unitario,
      lista_usada:     'lista4_std',
      lista1_may:      it.lista1_snapshot ?? null,
      lista4_std:      it.lista4_snapshot ?? null,
      lista3_min:      it.lista3_snapshot ?? null,
      _recotizar:      it.respuesta === 'recotizar',
      _recotizarTipo:  it.recotizar_tipo ?? '',
      _nota:           it.respuesta_nota ?? '',
    }))
    setItems(preItems)
    if (cotBase.observaciones) setObservaciones(cotBase.observaciones)
  }, [cotBase])

  // ── mutación de items ──────────────────────────────────────────────────────

  const agregarItem = useCallback(item => {
    setItems(prev => [...prev, item])
  }, [])

  const quitarItem = useCallback(index => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const cambiarCantidad = useCallback((index, val) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, cantidad: parseFloat(val) || 0 } : it))
  }, [])

  const cambiarPrecio = useCallback((index, val) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, precio_unitario: parseFloat(val) || 0 } : it))
  }, [])

  const setLista = useCallback((index, listaKey, val) => {
    setItems(prev => prev.map((it, i) =>
      i === index ? { ...it, precio_unitario: val, lista_usada: listaKey } : it
    ))
  }, [])

  const idsEnCotizacion = useMemo(() => new Set(items.map(i => i.producto_id)), [items])

  // ── totales ────────────────────────────────────────────────────────────────

  const subtotal = items.reduce((s, it) => s + (it.precio_unitario * it.cantidad || 0), 0)
  const iva      = subtotal * 0.21
  const total    = subtotal + iva

  // ── enviar ─────────────────────────────────────────────────────────────────

  async function handleEnviar() {
    if (!clienteId) { alert('Seleccioná un cliente'); return }
    if (!items.length) { alert('Agregá al menos un producto'); return }

    try {
      let result
      if (recotizarId) {
        // Actualizar la cotización existente en lugar de crear una nueva
        result = await actualizarCotizacion.mutateAsync({
          cotizacionId: recotizarId,
          items,
          validezDias,
          observaciones,
        })
      } else {
        result = await crearCotizacion.mutateAsync({
          clienteId,
          items,
          validezDias,
          observaciones,
          solicitudId: solicitudId || undefined,
        })
      }
      setExito(result)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    }
  }

  // ── pantalla de éxito ──────────────────────────────────────────────────────

  if (exito) {
    return (
      <div className="p-8 max-w-md mx-auto mt-16 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[#28a745]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Cotización enviada</h2>
        <p className="text-sm text-gray-500 mb-1">Código: <strong className="text-[#004a99]">{exito.codigo}</strong></p>
        <p className="text-sm text-gray-500 mb-6">El cliente ya puede verla y responder.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setExito(null); setItems([]); setClienteId(''); setObservaciones(''); }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Nueva cotización
          </button>
          <button
            onClick={() => navigate('/vendedor/cotizaciones')}
            className="px-4 py-2 bg-[#004a99] text-white rounded-lg text-sm hover:bg-[#003d80]"
          >
            Ver cotizaciones
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Banner solicitud */}
      {solicitudId && (
        <div className={`mb-4 rounded-[10px] border px-4 py-3 flex items-center gap-3 ${
          loadSol ? 'bg-gray-50 border-gray-200' : 'bg-yellow-50 border-yellow-300'
        }`}>
          <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          {loadSol
            ? <span className="text-sm text-gray-500">Cargando solicitud…</span>
            : <span className="text-sm text-yellow-800">
                Respondiendo a solicitud <strong>{solicitud?.codigo}</strong>
                {solicitud?.clientes?.razon_social && <> de <strong>{solicitud.clientes.razon_social}</strong></>}
              </span>
          }
        </div>
      )}

      {/* Banner recotización */}
      {recotizarId && (
        <div className={`mb-4 rounded-[10px] border px-4 py-3 flex items-center gap-3 ${
          loadCot ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-300'
        }`}>
          <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {loadCot
            ? <span className="text-sm text-gray-500">Cargando cotización…</span>
            : <span className="text-sm text-orange-800">
                Recotizando <strong>{cotBase?.codigo}</strong> para <strong>{cotBase?.clientes?.razon_social}</strong>
                {' · '}Solo se incluyeron los ítems que el cliente pidió recotizar
              </span>
          }
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {recotizarId ? 'Recotización' : solicitudId ? 'Cotizar solicitud' : 'Nueva cotización'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Completá los ítems y enviá al cliente</p>
        </div>
        <button
          onClick={handleEnviar}
          disabled={crearCotizacion.isPending || actualizarCotizacion.isPending || !clienteId || !items.length}
          className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {(crearCotizacion.isPending || actualizarCotizacion.isPending) ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Enviar cotización
            </>
          )}
        </button>
      </div>

      {/* Cliente selector */}
      <div className="bg-white rounded-[10px] shadow-card px-4 py-3 mb-4 flex items-center gap-3">
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <label className="text-sm font-medium text-gray-500 w-20 flex-shrink-0">Cliente</label>
        <select
          value={clienteId}
          onChange={e => setClienteId(e.target.value)}
          disabled={loadCli}
          className="flex-1 text-sm border-0 focus:outline-none bg-transparent text-gray-900"
        >
          <option value="">— Seleccionar cliente —</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.razon_social}</option>
          ))}
        </select>
      </div>

      {/* Layout: items + panel lateral */}
      <div className="flex gap-4 items-start">

        {/* Items list */}
        <div className="flex-1 bg-white rounded-[10px] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Ítems {items.length > 0 && <span className="text-[#004a99]">({items.length})</span>}
            </span>
            {items.length > 0 && (
              <button
                onClick={() => setItems([])}
                className="text-xs text-gray-400 hover:text-[#dc3545]"
              >
                Limpiar todo
              </button>
            )}
          </div>

          <div className="px-4">
            {items.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm">Buscá un producto a la derecha para agregar</p>
              </div>
            ) : (
              items.map((item, i) => (
                <ItemRow
                  key={item.producto_id}
                  item={item}
                  index={i}
                  onChangeCantidad={cambiarCantidad}
                  onChangePrecio={cambiarPrecio}
                  onSetLista={setLista}
                  onRemove={quitarItem}
                />
              ))
            )}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="w-72 flex-shrink-0 space-y-4">

          {/* Buscador por nombre */}
          <div className="bg-white rounded-[10px] shadow-card p-4">
            {loadProd
              ? <p className="text-sm text-gray-400 text-center py-2">Cargando productos…</p>
              : <BuscadorProducto
                  productos={productos}
                  itemsActuales={items}
                  onAgregar={agregarItem}
                  listaDefault={listaDefault}
                  setListaDefault={setListaDefault}
                  cantDefault={cantDefault}
                  setCantDefault={setCantDefault}
                />
            }
          </div>

          {/* Buscador por marca comercial (contratipos) */}
          <div className="bg-white rounded-[10px] shadow-card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por marca comercial</p>
            {loadProd
              ? <p className="text-sm text-gray-400 text-center py-2">Cargando…</p>
              : <BuscadorContratipos
                  productos={productos}
                  idsExcluir={idsEnCotizacion}
                  onAgregar={agregarItem}
                  cantDefault={cantDefault}
                  listaDefault={listaDefault}
                />
            }
          </div>

          {/* Totales */}
          <div className="bg-white rounded-[10px] shadow-card p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Totales</p>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium">{fmtUSD(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>IVA 21%</span>
              <span className="font-medium">{fmtUSD(iva)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-[#004a99]">{fmtUSD(total)}</span>
            </div>
          </div>

          {/* Validez */}
          <div className="bg-white rounded-[10px] shadow-card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Validez</p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min="1"
                max="30"
                value={validezDias}
                onChange={e => setValidezDias(parseInt(e.target.value) || 1)}
                className="w-16 text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              />
              <span className="text-sm text-gray-500">días</span>
            </div>
            <p className="text-xs text-gray-400">
              Vence el <span className="font-medium text-gray-600">{calcVencimiento(validezDias)}</span>
            </p>
          </div>

          {/* Observaciones */}
          <div className="bg-white rounded-[10px] shadow-card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observaciones</p>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas para el cliente…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            />
          </div>

        </div>
      </div>
    </div>
  )
}
