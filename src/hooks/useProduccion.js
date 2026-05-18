import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

// ── Registros de producción ───────────────────────────────────────────────────

export function useProducciones() {
  return useQuery({
    queryKey: ['produccion', 'registros'],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producciones')
        .select('id, codigo, nombre, cantidad, fecha_produccion, numero_lote, fecha_vencimiento, notas, coa_url, creado_en')
        .order('creado_en', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRegistrarProduccion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productoId, codigo, nombre, cantidad, fechaProduccion, numeroLote, fechaVencimiento, notas, coaFile, esNuevo }) => {
      let prodId = productoId

      if (esNuevo) {
        const { data: prod, error: prodErr } = await db
          .from('productos')
          .insert({ codigo: codigo.trim(), nombre: nombre.trim(), activo: true })
          .select('id')
          .single()
        if (prodErr) throw prodErr
        prodId = prod.id
        const { error: saErr } = await db.from('stock_actual').insert({ producto_id: prodId, cantidad: parseFloat(cantidad) || 0 })
        if (saErr) throw saErr
      } else {
        const { data: sa, error: saFetchErr } = await db
          .from('stock_actual')
          .select('cantidad')
          .eq('producto_id', prodId)
          .maybeSingle()
        if (saFetchErr) throw saFetchErr

        if (sa) {
          const { error: saUpdErr } = await db.from('stock_actual')
            .update({ cantidad: (sa.cantidad ?? 0) + (parseFloat(cantidad) || 0) })
            .eq('producto_id', prodId)
          if (saUpdErr) throw saUpdErr
        } else {
          const { error: saInsErr } = await db.from('stock_actual')
            .insert({ producto_id: prodId, cantidad: parseFloat(cantidad) || 0 })
          if (saInsErr) throw saInsErr
        }
      }

      let coaUrl = null
      if (coaFile) {
        const ext  = coaFile.name.split('.').pop()
        const path = `manual/${Date.now()}.${ext}`
        const { error: upErr } = await db.storage.from('coas').upload(path, coaFile, { upsert: true })
        if (upErr) throw new Error(`Error al subir COA: ${upErr.message}`)
        const { data: { publicUrl } } = db.storage.from('coas').getPublicUrl(path)
        coaUrl = publicUrl
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('producciones').insert({
        producto_id:       prodId,
        codigo,
        nombre,
        cantidad:          parseFloat(cantidad) || 0,
        fecha_produccion:  fechaProduccion,
        numero_lote:       numeroLote || null,
        fecha_vencimiento: fechaVencimiento || null,
        notas:             notas || null,
        coa_url:           coaUrl,
        creado_por:        user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produccion', 'registros'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stock'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'stock'] })
    },
  })
}

// ── Trabajos de producción (calendario) ──────────────────────────────────────

export function useTrabajos() {
  return useQuery({
    queryKey: ['produccion', 'trabajos'],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trabajos_produccion')
        .select('id, producto_id, codigo, nombre, cantidad_planificada, fecha_inicio, fecha_fin, estado, notas, numero_lote, fecha_vencimiento, coa_url, creado_en')
        .not('estado', 'eq', 'cancelado')
        .order('fecha_inicio', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCrearTrabajo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productoId, codigo, nombre, cantidadPlanificada, fechaInicio, fechaFin, notas }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('trabajos_produccion').insert({
        producto_id:          productoId || null,
        codigo,
        nombre,
        cantidad_planificada: parseFloat(cantidadPlanificada) || 0,
        fecha_inicio:         fechaInicio,
        fecha_fin:            fechaFin || null,
        estado:               'pendiente',
        notas:                notas || null,
        creado_por:           user.id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produccion', 'trabajos'] }),
  })
}

export function useActualizarTrabajo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, campos }) => {
      const { error } = await supabase.from('trabajos_produccion').update(campos).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produccion', 'trabajos'] }),
  })
}

export function useEliminarTrabajo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('trabajos_produccion').update({ estado: 'cancelado' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produccion', 'trabajos'] }),
  })
}

export function useConfirmarLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trabajo, numeroLote, fechaVencimiento, coaFile }) => {
      // 1. Upload COA
      let coaUrl = null
      if (coaFile) {
        const ext  = coaFile.name.split('.').pop()
        const path = `${trabajo.id}/${Date.now()}.${ext}`
        const { error: upErr } = await db.storage.from('coas').upload(path, coaFile, { upsert: true })
        if (upErr) throw new Error(`Error al subir COA: ${upErr.message}`)
        const { data: { publicUrl } } = db.storage.from('coas').getPublicUrl(path)
        coaUrl = publicUrl
      }

      // 2. Actualizar stock — antes de marcar completado para detectar fallos
      if (trabajo.producto_id && trabajo.cantidad_planificada > 0) {
        const { data: sa, error: saFetchErr } = await db
          .from('stock_actual')
          .select('cantidad')
          .eq('producto_id', trabajo.producto_id)
          .maybeSingle()
        if (saFetchErr) throw saFetchErr

        if (sa) {
          const { error: saUpdErr } = await db.from('stock_actual')
            .update({ cantidad: (sa.cantidad ?? 0) + trabajo.cantidad_planificada })
            .eq('producto_id', trabajo.producto_id)
          if (saUpdErr) throw saUpdErr
        } else {
          const { error: saInsErr } = await db.from('stock_actual')
            .insert({ producto_id: trabajo.producto_id, cantidad: trabajo.cantidad_planificada })
          if (saInsErr) throw saInsErr
        }
      }

      // 3. Marcar trabajo como completado
      const { error: updErr } = await db.from('trabajos_produccion').update({
        estado:            'completado',
        numero_lote:       numeroLote,
        fecha_vencimiento: fechaVencimiento || null,
        coa_url:           coaUrl,
      }).eq('id', trabajo.id)
      if (updErr) throw updErr

      // 4. Registrar producción
      const { data: { user } } = await supabase.auth.getUser()
      const { error: prodErr } = await supabase.from('producciones').insert({
        producto_id:       trabajo.producto_id,
        codigo:            trabajo.codigo,
        nombre:            trabajo.nombre,
        cantidad:          trabajo.cantidad_planificada,
        fecha_produccion:  new Date().toISOString().split('T')[0],
        numero_lote:       numeroLote,
        fecha_vencimiento: fechaVencimiento || null,
        notas:             coaUrl ? 'COA adjunto' : null,
        coa_url:           coaUrl,
        creado_por:        user.id,
      })
      if (prodErr) throw prodErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produccion'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stock'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'stock'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}
