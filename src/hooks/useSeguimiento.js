import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── Para el chofer: controla el seguimiento GPS ───────────────────────────────

export function useSeguimientoChofer() {
  const [activo,    setActivo]    = useState(false)
  const [error,     setError]     = useState(null)
  const [posActual, setPosActual] = useState(null)
  const [kmRecorridos, setKmRecorridos] = useState(0)

  const watchIdRef          = useRef(null)
  const ultimaGuardadaRef   = useRef(null)
  const ultimoTimestampRef  = useRef(0)
  const kmRef               = useRef(0)

  async function guardarUbicacion(lat, lng, precision) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await db.from('choferes_ubicacion').upsert(
      { chofer_id: user.id, lat, lng, precision_m: precision, activo: true, actualizado_en: new Date().toISOString() },
      { onConflict: 'chofer_id' }
    )

    const ultima  = ultimaGuardadaRef.current
    const ahora   = Date.now()
    const distancia = ultima ? distanciaMetros(ultima.lat, ultima.lng, lat, lng) : 0
    const movioSuficiente = !ultima || distancia > 30
    const pasoPorTiempo   = ahora - ultimoTimestampRef.current > 60000

    if (movioSuficiente || pasoPorTiempo) {
      await db.from('choferes_recorrido').insert({
        chofer_id: user.id,
        lat, lng,
        fecha: new Date().toISOString().split('T')[0],
      })
      if (ultima) {
        kmRef.current += distancia / 1000
        setKmRecorridos(Math.round(kmRef.current * 10) / 10)
      }
      ultimaGuardadaRef.current = { lat, lng }
      ultimoTimestampRef.current = ahora
    }
  }

  function iniciar() {
    if (!navigator.geolocation) { setError('Este dispositivo no soporta GPS'); return }
    setError(null)
    kmRef.current = 0
    setKmRecorridos(0)
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setPosActual({ lat, lng })
        guardarUbicacion(lat, lng, accuracy)
      },
      err => setError(`Error GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )
    setActivo(true)
  }

  async function detener() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setActivo(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await db.from('choferes_ubicacion').upsert(
        { chofer_id: user.id, lat: 0, lng: 0, activo: false, actualizado_en: new Date().toISOString() },
        { onConflict: 'chofer_id' }
      )
    }
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  return { activo, error, posActual, kmRecorridos, iniciar, detener }
}

// ── Para logística: choferes activos en tiempo real ───────────────────────────

export function useChoforesActivos() {
  const [choferes, setChoferes] = useState([])

  useEffect(() => {
    db.from('choferes_ubicacion')
      .select('chofer_id, lat, lng, activo, actualizado_en, perfiles(nombre)')
      .eq('activo', true)
      .then(({ data }) => setChoferes(data ?? []))

    const channel = supabase
      .channel('choferes-ubicacion-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'choferes_ubicacion' }, ({ new: nuevo }) => {
        if (!nuevo) return
        setChoferes(prev => {
          if (!nuevo.activo) return prev.filter(c => c.chofer_id !== nuevo.chofer_id)
          const existe = prev.find(c => c.chofer_id === nuevo.chofer_id)
          return existe
            ? prev.map(c => c.chofer_id === nuevo.chofer_id ? { ...c, ...nuevo } : c)
            : [...prev, nuevo]
        })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return choferes
}

// ── Recorrido del día para logística ─────────────────────────────────────────

export function useRecorridoChofer(choferId, fecha) {
  return useQuery({
    queryKey: ['seguimiento', 'recorrido', choferId, fecha],
    enabled:  !!choferId && !!fecha,
    queryFn: async () => {
      const { data, error } = await db
        .from('choferes_recorrido')
        .select('lat, lng, registrado_en')
        .eq('chofer_id', choferId)
        .eq('fecha', fecha)
        .order('registrado_en')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}
