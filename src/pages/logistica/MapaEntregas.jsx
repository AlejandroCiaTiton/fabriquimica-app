import { useState, useCallback, useRef } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api'
import { useOrdenesLogistica, useZonas, getUrgencia, checkStock, URGENCIA_CONFIG } from '../../hooks/useLogistica'

const LIBRARIES = []
const CENTER_DEFAULT = { lat: -34.6037, lng: -58.3816 }
const MAP_STYLE = { width: '100%', height: '100%' }

function markerSvg(color, sinStock) {
  const badge = sinStock
    ? `<rect x="20" y="0" width="12" height="12" rx="6" fill="#dc3545"/>
       <path d="M24 4 L28 8 M28 4 L24 8" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`
    : ''
  return encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="14" cy="14" r="11" fill="${color}" stroke="white" stroke-width="2"/>
      ${badge}
    </svg>`
  )
}

function BadgeUrgencia({ urgencia }) {
  const cfg = URGENCIA_CONFIG[urgencia]
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bgClass}`}>
      {cfg.label}
    </span>
  )
}

function BadgeStock({ ok }) {
  if (ok === null) return <span className="text-[10px] text-gray-400">Stock desconocido</span>
  return ok
    ? <span className="text-[10px] font-semibold text-green-700">✓ En stock</span>
    : <span className="text-[10px] font-semibold text-red-600">✗ Sin stock</span>
}

export default function MapaEntregas() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? '',
    libraries: LIBRARIES,
  })

  const { data: ordenes = [], isLoading } = useOrdenesLogistica()
  const { data: zonas = [] }              = useZonas()

  const [filtro, setFiltro]       = useState('todos')
  const [soloSinStock, setSoloSinStock] = useState(false)
  const [selected, setSelected]   = useState(null)
  const mapRef = useRef(null)

  const onLoad = useCallback(map => { mapRef.current = map }, [])

  const ordenesConPos = ordenes.filter(oc => {
    const cli = oc.cotizaciones?.clientes
    return cli?.lat && cli?.lng
  })

  const filtradas = ordenesConPos.filter(oc => {
    const urg = getUrgencia(oc.fecha_estimada_entrega)
    const stock = checkStock(oc.cotizaciones?.cotizacion_items)

    if (soloSinStock && stock !== false) return false

    if (filtro === 'todos') return true
    if (filtro === 'critico') return urg === 'critico'
    if (filtro === '4dias')   return urg === 'critico' || urg === 'urgente'
    if (filtro === 'semana')  return urg === 'critico' || urg === 'urgente' || urg === 'proximo'
    return true
  })

  const sinCoordenadas = ordenes.length - ordenesConPos.length

  if (!apiKey) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center">
        <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">API key pendiente</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Agregá <code className="bg-gray-100 px-1 rounded font-mono text-xs">VITE_GOOGLE_MAPS_KEY=tu_api_key</code> en el archivo <code className="bg-gray-100 px-1 rounded font-mono text-xs">.env.local</code> y reiniciá el servidor.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      {/* Panel izquierdo */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-900">Mapa de entregas</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isLoading ? 'Cargando…' : `${filtradas.length} de ${ordenes.length} OC`}
            {sinCoordenadas > 0 && (
              <span className="ml-1 text-orange-500">· {sinCoordenadas} sin coordenadas</span>
            )}
          </p>
        </div>

        {/* Filtros de urgencia */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Filtrar por fecha</p>
          <div className="flex flex-col gap-1">
            {[
              ['todos',   'Todos'],
              ['critico', '≤ 2 días'],
              ['4dias',   '≤ 4 días'],
              ['semana',  '≤ 1 semana'],
            ].map(([v, l]) => (
              <button key={v} onClick={() => setFiltro(v)}
                className={`text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtro === v ? 'bg-[#004a99] text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {l}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={soloSinStock} onChange={e => setSoloSinStock(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#dc3545]"/>
            <span className="text-xs text-gray-600 font-medium">Solo sin stock</span>
          </label>
        </div>

        {/* Leyenda */}
        <div className="px-4 py-2 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Urgencia</p>
          <div className="space-y-1">
            {Object.entries(URGENCIA_CONFIG).filter(([k]) => k !== 'sin-fecha').map(([k, cfg]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }}/>
                <span className="text-xs text-gray-500">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de OCs */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtradas.length === 0 && !isLoading && (
            <div className="p-6 text-center text-sm text-gray-400">Sin órdenes para este filtro</div>
          )}
          {filtradas.map(oc => {
            const cli   = oc.cotizaciones?.clientes
            const urg   = getUrgencia(oc.fecha_estimada_entrega)
            const stock = checkStock(oc.cotizaciones?.cotizacion_items)
            const cfg   = URGENCIA_CONFIG[urg]
            return (
              <button key={oc.id}
                onClick={() => {
                  setSelected(oc.id)
                  if (cli?.lat && cli?.lng && mapRef.current) {
                    mapRef.current.panTo({ lat: Number(cli.lat), lng: Number(cli.lng) })
                    mapRef.current.setZoom(14)
                  }
                }}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected === oc.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{cli?.razon_social}</p>
                    <p className="text-xs font-mono text-[#004a99]">{oc.numero}</p>
                  </div>
                  <div className="flex-shrink-0 w-3 h-3 rounded-full mt-1" style={{ backgroundColor: cfg.color }}/>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <BadgeUrgencia urgencia={urg}/>
                  <BadgeStock ok={stock}/>
                  {cli?.zonas_entrega && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: cli.zonas_entrega.color + '22', color: cli.zonas_entrega.color }}>
                      {cli.zonas_entrega.nombre}
                    </span>
                  )}
                </div>
                {oc.fecha_estimada_entrega && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Entrega: {new Date(oc.fecha_estimada_entrega + 'T00:00:00').toLocaleDateString('es-AR')}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1">
        {loadError && (
          <div className="flex items-center justify-center h-full text-red-600 text-sm">
            Error al cargar Google Maps: {loadError.message}
          </div>
        )}
        {!loadError && !isLoaded && (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        )}
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={MAP_STYLE}
            center={CENTER_DEFAULT}
            zoom={11}
            onLoad={onLoad}
            options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
          >
            {filtradas.map(oc => {
              const cli   = oc.cotizaciones?.clientes
              if (!cli?.lat || !cli?.lng) return null
              const urg   = getUrgencia(oc.fecha_estimada_entrega)
              const stock = checkStock(oc.cotizaciones?.cotizacion_items)
              const cfg   = URGENCIA_CONFIG[urg]
              const pos   = { lat: Number(cli.lat), lng: Number(cli.lng) }
              const items = oc.cotizaciones?.cotizacion_items ?? []

              return (
                <MarkerF
                  key={oc.id}
                  position={pos}
                  icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${markerSvg(cfg.color, stock === false)}`,
                    scaledSize: new window.google.maps.Size(32, 32),
                    anchor:     new window.google.maps.Point(14, 14),
                  }}
                  onClick={() => setSelected(selected === oc.id ? null : oc.id)}
                >
                  {selected === oc.id && (
                    <InfoWindowF position={pos} onCloseClick={() => setSelected(null)}>
                      <div className="text-sm min-w-[200px]">
                        <p className="font-bold text-[#004a99] mb-0.5">{oc.numero}</p>
                        <p className="font-semibold text-gray-900 mb-1">{cli.razon_social}</p>
                        {oc.fecha_estimada_entrega && (
                          <p className="text-xs text-gray-500 mb-1">
                            Entrega: {new Date(oc.fecha_estimada_entrega + 'T00:00:00').toLocaleDateString('es-AR')}
                          </p>
                        )}
                        <div className="flex gap-1 mb-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bgClass}`}>{cfg.label}</span>
                          {stock !== null && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {stock ? '✓ En stock' : '✗ Sin stock'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5 border-t border-gray-100 pt-1.5">
                          {items.slice(0, 4).map(it => (
                            <p key={it.id}>{it.productos?.nombre} · {it.cantidad} kg</p>
                          ))}
                          {items.length > 4 && <p className="text-gray-400">+{items.length - 4} más</p>}
                        </div>
                      </div>
                    </InfoWindowF>
                  )}
                </MarkerF>
              )
            })}
          </GoogleMap>
        )}
      </div>
    </div>
  )
}
