import { useState, useMemo, useCallback } from 'react'
import { useProductos } from '../../hooks/useProductos'
import { useCrearSolicitud, useClienteActual } from '../../hooks/useSolicitudes'
import { INCOTERMS } from '../../lib/dimensionamiento'
import BuscadorContratipos from '../../components/BuscadorContratipos'

function fmtCodigo(codigo) {
  if (!codigo) return null
  return <span className="text-[10px] text-gray-400 font-mono ml-1">{codigo}</span>
}

// ─── Buscador simple (sin precios) ───────────────────────────────────────────

function BuscadorProducto({ productos, idsEnLista, onAgregar }) {
  const [busqueda, setBusqueda] = useState('')
  const [cantidad, setCantidad] = useState(100)

  const resultados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return []
    return productos
      .filter(p => !idsEnLista.has(p.id) && (
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
      ))
      .slice(0, 8)
  }, [busqueda, productos, idsEnLista])

  function agregar(prod) {
    onAgregar({
      producto_id:  prod.id,
      nombre:       prod.nombre,
      presentacion: prod.presentacion ?? '',
      codigo:       prod.codigo,
      cantidad,
    })
    setBusqueda('')
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          />
        </div>
        <input
          type="number"
          min="1"
          value={cantidad}
          onChange={e => setCantidad(Number(e.target.value) || 1)}
          placeholder="Kg/Lt"
          className="w-24 text-center text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          title="Cantidad en Kg/Lt"
        />
      </div>

      {resultados.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-card">
          {resultados.map(p => (
            <button
              key={p.id}
              onClick={() => agregar(p)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 leading-tight">{p.nombre}</p>
                <p className="text-xs text-gray-400">{p.presentacion} · {p.codigo}</p>
              </div>
              <svg className="w-4 h-4 text-[#004a99] ml-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          ))}
        </div>
      )}
      {busqueda && resultados.length === 0 && (
        <p className="text-xs text-gray-400 mt-2 text-center">Sin resultados para "{busqueda}"</p>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NuevaSolicitud() {
  const { data: productos = [], isLoading } = useProductos()
  const { data: clienteActual } = useClienteActual()
  const crearSolicitud = useCrearSolicitud()

  const esExterior = clienteActual?.es_exterior ?? false

  const [items, setItems]               = useState([])
  const [observaciones, setObs]         = useState('')
  const [incoterm, setIncoterm]         = useState('')
  const [puertoDescarga, setPuerto]     = useState('')
  const [exito, setExito]               = useState(null)

  const idsEnLista = useMemo(() => new Set(items.map(i => i.producto_id)), [items])

  const agregar = useCallback(item => setItems(prev => [...prev, item]), [])
  const quitar  = useCallback(idx  => setItems(prev => prev.filter((_, i) => i !== idx)), [])
  const setCant = useCallback((idx, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: parseFloat(val) || 0 } : it))
  }, [])

  async function handleEnviar() {
    if (!items.length) return
    try {
      const result = await crearSolicitud.mutateAsync({
        items, observaciones,
        incoterm:        esExterior ? incoterm        || null : null,
        puerto_descarga: esExterior ? puertoDescarga  || null : null,
      })
      setExito(result)
    } catch (err) {
      alert('Error al enviar: ' + err.message)
    }
  }

  // ── éxito ──────────────────────────────────────────────────────────────────
  if (exito) {
    const esAutomatic = !!exito.autoCotizacion
    const sinPrecio   = !!exito.sinPrecio
    return (
      <div className="p-8 max-w-md mx-auto mt-16 text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
          esAutomatic ? 'bg-blue-100' : sinPrecio ? 'bg-yellow-100' : 'bg-green-100'
        }`}>
          <svg className={`w-7 h-7 ${esAutomatic ? 'text-[#004a99]' : sinPrecio ? 'text-yellow-600' : 'text-[#28a745]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={sinPrecio ? 'M5 13l4 4L19 7' : 'M5 13l4 4L19 7'} />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {esAutomatic ? '¡Cotización lista!' : 'Solicitud enviada'}
        </h2>
        <p className="text-sm text-gray-500 mb-1">
          {esAutomatic ? 'Cotización' : 'Solicitud'}: <strong className="text-[#004a99]">{esAutomatic ? exito.autoCotizacion.codigo : exito.codigo}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          {esAutomatic
            ? 'Tu pedido es menor a 200 kg. Se generó una cotización automática con precios minoristas. Podés verla y responderla en Mis Cotizaciones.'
            : sinPrecio
            ? 'Algunos productos no tienen precio configurado. Tu vendedor recibirá la solicitud y te enviará la cotización manualmente.'
            : 'Tu vendedor recibirá tu solicitud y te enviará una cotización.'}
        </p>
        <button
          onClick={() => { setExito(null); setItems([]); setObs('') }}
          className="px-5 py-2 bg-[#004a99] text-white rounded-lg text-sm hover:bg-[#003d80]"
        >
          Nueva solicitud
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Nueva solicitud de cotización</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Indicá los productos que necesitás y te enviamos precios
        </p>
      </div>

      {/* Lista de ítems */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Productos {items.length > 0 && <span className="text-[#004a99]">({items.length})</span>}
          </span>
        </div>

        {/* Header columnas */}
        {items.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-[1fr_100px_36px] gap-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <span>Producto</span>
            <span className="text-center">Kg / Lt</span>
            <span />
          </div>
        )}

        <div className="px-4">
          {items.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm">Buscá productos abajo para agregar</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.producto_id}
                className="grid grid-cols-[1fr_100px_36px] gap-3 items-center py-3 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 leading-snug">{item.nombre}</p>
                  <p className="text-xs text-gray-400">{item.presentacion}{fmtCodigo(item.codigo)}</p>
                </div>
                <input
                  type="number"
                  min="0.001"
                  step="1"
                  value={item.cantidad}
                  onChange={e => setCant(idx, e.target.value)}
                  className="text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99]"
                />
                <button
                  onClick={() => quitar(idx)}
                  className="p-1.5 text-gray-300 hover:text-[#dc3545] hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Buscador por nombre */}
      <div className="bg-white rounded-[10px] shadow-card p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Agregar producto
        </p>
        {isLoading
          ? <p className="text-sm text-gray-400">Cargando catálogo…</p>
          : <BuscadorProducto productos={productos} idsEnLista={idsEnLista} onAgregar={agregar} />
        }
      </div>

      {/* Buscador por marca comercial (contratipos) */}
      <div className="bg-white rounded-[10px] shadow-card p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Buscar por marca comercial
        </p>
        <p className="text-xs text-gray-400 mb-3">
          Escribí el nombre comercial o fabricante del producto que usás y te mostramos el equivalente Fabriquímica.
        </p>
        {isLoading
          ? <p className="text-sm text-gray-400">Cargando catálogo…</p>
          : <BuscadorContratipos
              productos={productos}
              idsExcluir={idsEnLista}
              onAgregar={agregar}
            />
        }
      </div>

      {/* Condiciones de entrega — solo clientes del exterior */}
      {esExterior && (
        <div className="bg-white rounded-[10px] shadow-card p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Condiciones de entrega (Exportación)
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Incoterm sugerido</label>
              <select value={incoterm} onChange={e => setIncoterm(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white">
                <option value="">— No especificado —</option>
                {INCOTERMS.map(t => (
                  <option key={t.code} value={t.code}>{t.label} — {t.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Puerto / Localidad de descarga</label>
              <input type="text" value={puertoDescarga} onChange={e => setPuerto(e.target.value)}
                placeholder="Ej: Puerto de Callao, Santiago CL…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
            </div>
          </div>
        </div>
      )}

      {/* Observaciones */}
      <div className="bg-white rounded-[10px] shadow-card p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Observaciones (opcional)
        </p>
        <textarea
          value={observaciones}
          onChange={e => setObs(e.target.value)}
          placeholder="Urgencia, condición de entrega, aclaraciones…"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#004a99]"
        />
      </div>

      {/* Enviar */}
      <button
        onClick={handleEnviar}
        disabled={!items.length || crearSolicitud.isPending}
        className="w-full flex items-center justify-center gap-2 bg-[#004a99] hover:bg-[#003d80] disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors"
      >
        {crearSolicitud.isPending ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Enviar solicitud al vendedor
          </>
        )}
      </button>
    </div>
  )
}
