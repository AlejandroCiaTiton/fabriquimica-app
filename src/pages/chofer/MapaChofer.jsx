import { useState, useCallback, useRef } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, PolylineF } from '@react-google-maps/api'
import { useEntregasChofer, useConfirmarEntrega, useRegistrarNoEntrega } from '../../hooks/useChofer'
import { useSeguimientoChofer } from '../../hooks/useSeguimiento'
import { fmtFecha } from '../../utils/calc'

const LIBRARIES = []
const CENTER_DEFAULT = { lat: -34.6037, lng: -58.3816 }
const MAP_STYLE = { width: '100%', height: '100%' }

function markerSvg(confirmado) {
  const color = confirmado ? '#28a745' : '#004a99'
  return encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="14" cy="14" r="11" fill="${color}" stroke="white" stroke-width="2"/>
    </svg>`
  )
}

function getFechaEntrega(oc) {
  const planFecha = Array.isArray(oc.plan_entregas)
    ? oc.plan_entregas[0]?.fecha
    : oc.plan_entregas?.fecha
  return planFecha || oc.fecha_estimada_entrega || null
}

function ModalNoEntrega({ oc, onConfirm, onClose, loading }) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="font-bold text-gray-900 text-base mb-1">No pudo entregarse</h2>
        <p className="text-sm text-gray-500 mb-4">
          {oc.cotizaciones?.clientes?.razon_social} · <span className="font-mono">{oc.numero}</span>
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ej: Cliente ausente, dirección incorrecta, acceso denegado…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            disabled={!motivo.trim() || loading}
            onClick={() => onConfirm(motivo.trim())}
            className="flex-1 bg-[#dc3545] hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

function markerSvgChofer() {
  return encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="14" fill="#2563eb" stroke="white" stroke-width="3"/>
      <text x="18" y="23" text-anchor="middle" font-size="14" fill="white">🚚</text>
    </svg>`
  )
}

export default function MapaChofer() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? '',
    libraries: LIBRARIES,
  })

  const { data: ordenes = [], isLoading } = useEntregasChofer()
  const { mutate: confirmar, isPending: confirmando } = useConfirmarEntrega()
  const { mutate: noEntrega, isPending: registrando } = useRegistrarNoEntrega()
  const { activo, error: errorGps, posActual, kmRecorridos, iniciar, detener } = useSeguimientoChofer()

  const [selected, setSelected] = useState(null)
  const [modalOC, setModalOC]   = useState(null)
  const mapRef = useRef(null)
  const onLoad = useCallback(map => { mapRef.current = map }, [])

  // Centrar mapa en posición actual cuando cambia
  const prevPosRef = useRef(null)
  if (posActual && mapRef.current && (!prevPosRef.current ||
    Math.abs(posActual.lat - prevPosRef.current.lat) > 0.0005 ||
    Math.abs(posActual.lng - prevPosRef.current.lng) > 0.0005
  )) {
    prevPosRef.current = posActual
    mapRef.current.panTo(posActual)
  }

  const ordenesConPos = ordenes.filter(oc => {
    const cli = oc.cotizaciones?.clientes
    return cli?.lat && cli?.lng
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

        {/* Control de seguimiento */}
        <div className={`px-4 py-3 border-b ${activo ? 'bg-green-50 border-green-100' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {activo
                ? <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"/>
                  </span>
                : <span className="h-2.5 w-2.5 rounded-full bg-gray-300 flex-shrink-0"/>
              }
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800">
                  {activo ? 'Seguimiento activo' : 'Seguimiento inactivo'}
                </p>
                {activo && kmRecorridos > 0 && (
                  <p className="text-[10px] text-gray-500">{kmRecorridos} km recorridos hoy</p>
                )}
                {errorGps && (
                  <p className="text-[10px] text-red-600 truncate">{errorGps}</p>
                )}
              </div>
            </div>
            <button
              onClick={activo ? detener : iniciar}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                activo
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {activo ? 'Detener' : 'Iniciar'}
            </button>
          </div>
        </div>

        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-900">Mapa de entregas</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isLoading ? 'Cargando…' : `${ordenes.length} pendiente${ordenes.length !== 1 ? 's' : ''}`}
            {sinCoordenadas > 0 && (
              <span className="ml-1 text-orange-500">· {sinCoordenadas} sin coordenadas</span>
            )}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {ordenes.length === 0 && !isLoading && (
            <div className="p-6 text-center text-sm text-gray-400">No hay entregas pendientes</div>
          )}
          {ordenes.map(oc => {
            const cli   = oc.cotizaciones?.clientes
            const fecha = getFechaEntrega(oc)
            const plan  = Array.isArray(oc.plan_entregas) ? oc.plan_entregas[0] : oc.plan_entregas
            return (
              <button key={oc.id}
                onClick={() => {
                  setSelected(oc.id)
                  if (cli?.lat && cli?.lng && mapRef.current) {
                    mapRef.current.panTo({ lat: Number(cli.lat), lng: Number(cli.lng) })
                    mapRef.current.setZoom(15)
                  }
                }}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selected === oc.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{cli?.razon_social}</p>
                    <p className="text-xs font-mono text-[#004a99]">{oc.numero}</p>
                  </div>
                  {plan?.notas && (
                    <span className="flex-shrink-0 text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                      Intento fallido
                    </span>
                  )}
                </div>
                {fecha && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Entrega: {fmtFecha(fecha)}</p>
                )}
                {!cli?.lat && (
                  <p className="text-[10px] text-orange-500 mt-0.5">Sin coordenadas</p>
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
            {/* Marcador posición propia */}
            {posActual && (
              <MarkerF
                position={posActual}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${markerSvgChofer()}`,
                  scaledSize: new window.google.maps.Size(36, 36),
                  anchor:     new window.google.maps.Point(18, 18),
                }}
                zIndex={100}
              />
            )}

            {ordenesConPos.map(oc => {
              const cli   = oc.cotizaciones?.clientes
              const items = oc.cotizaciones?.cotizacion_items ?? []
              const pos   = { lat: Number(cli.lat), lng: Number(cli.lng) }
              const plan  = Array.isArray(oc.plan_entregas) ? oc.plan_entregas[0] : oc.plan_entregas
              const fecha = getFechaEntrega(oc)

              return (
                <MarkerF
                  key={oc.id}
                  position={pos}
                  icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${markerSvg(false)}`,
                    scaledSize: new window.google.maps.Size(32, 32),
                    anchor:     new window.google.maps.Point(14, 14),
                  }}
                  onClick={() => setSelected(selected === oc.id ? null : oc.id)}
                >
                  {selected === oc.id && (
                    <InfoWindowF position={pos} onCloseClick={() => setSelected(null)}>
                      <div className="text-sm min-w-[220px] max-w-[260px]">
                        <p className="font-bold text-[#004a99] mb-0.5">{oc.numero}</p>
                        <p className="font-semibold text-gray-900 mb-1">{cli.razon_social}</p>
                        {fecha && (
                          <p className="text-xs text-gray-500 mb-2">Entrega: {fmtFecha(fecha)}</p>
                        )}
                        {plan?.notas && (
                          <div className="mb-2 bg-orange-50 border border-orange-100 rounded px-2 py-1">
                            <p className="text-xs text-orange-700"><span className="font-medium">Intento fallido:</span> {plan.notas}</p>
                          </div>
                        )}
                        <div className="text-xs text-gray-600 space-y-0.5 border-t border-gray-100 pt-1.5 mb-3">
                          {items.slice(0, 4).map(it => (
                            <p key={it.id}>{it.productos?.nombre} · {it.cantidad} kg/lt</p>
                          ))}
                          {items.length > 4 && <p className="text-gray-400">+{items.length - 4} más</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setModalOC(oc)}
                            className="flex-1 border border-gray-200 text-gray-600 font-medium py-1.5 rounded text-xs hover:bg-gray-50 transition-colors">
                            No entregué
                          </button>
                          <button
                            disabled={confirmando}
                            onClick={() => { confirmar(oc.id); setSelected(null) }}
                            className="flex-1 bg-[#28a745] hover:bg-green-700 text-white font-medium py-1.5 rounded text-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
                            {confirmando
                              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                              : '✓ Entregado'
                            }
                          </button>
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

      {modalOC && (
        <ModalNoEntrega
          oc={modalOC}
          loading={registrando}
          onConfirm={motivo => noEntrega({ ocId: modalOC.id, motivo }, { onSuccess: () => { setModalOC(null); setSelected(null) } })}
          onClose={() => setModalOC(null)}
        />
      )}
    </div>
  )
}
