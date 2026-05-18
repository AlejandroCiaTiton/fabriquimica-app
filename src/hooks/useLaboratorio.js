import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

// ── COAs ─────────────────────────────────────────────────────────────────────

export function useCoas() {
  return useQuery({
    queryKey: ['laboratorio', 'coas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coas')
        .select('id, numero_lote, archivo_url, creado_en, trabajos_produccion (id, codigo, nombre, numero_lote, estado, fecha_fin)')
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60,
  })
}

export function useTrabajosSinCoa() {
  return useQuery({
    queryKey: ['laboratorio', 'trabajos-sin-coa'],
    queryFn: async () => {
      const { data: conCoa, error: e1 } = await supabase
        .from('coas')
        .select('trabajo_id')
      if (e1) throw e1

      const idsConCoa = (conCoa ?? []).map(c => c.trabajo_id)

      let q = supabase
        .from('trabajos_produccion')
        .select('id, codigo, nombre, numero_lote, estado, fecha_fin, fecha_inicio')
        .eq('estado', 'completado')
        .order('fecha_fin', { ascending: false })

      if (idsConCoa.length > 0) {
        q = q.not('id', 'in', `(${idsConCoa.join(',')})`)
      }

      const { data, error: e2 } = await q
      if (e2) throw e2
      return data ?? []
    },
    staleTime: 1000 * 60,
  })
}

export function useSubirCoa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trabajoId, archivoUrl, numeroLote }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await db.from('coas').insert({
        trabajo_id:  trabajoId,
        archivo_url: archivoUrl,
        numero_lote: numeroLote || null,
        subido_por:  user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laboratorio', 'coas'] })
      qc.invalidateQueries({ queryKey: ['laboratorio', 'trabajos-sin-coa'] })
    },
  })
}

// ── Muestras ──────────────────────────────────────────────────────────────────

export function useMuestras() {
  return useQuery({
    queryKey: ['laboratorio', 'muestras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('muestras')
        .select('id, producto_nombre, fecha_envio, cantidad_g, numero_lote, resultado, devolucion, notas, creado_en, clientes (id, razon_social), productos (id, nombre, codigo)')
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useCrearMuestra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clienteId, productoId, productoNombre, fechaEnvio, cantidadG, numeroLote, notas }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await db.from('muestras').insert({
        cliente_id:     clienteId || null,
        producto_id:    productoId || null,
        producto_nombre: productoNombre || null,
        fecha_envio:    fechaEnvio,
        cantidad_g:     cantidadG ? parseFloat(cantidadG) : null,
        numero_lote:    numeroLote || null,
        resultado:      'pendiente',
        notas:          notas || null,
        creado_por:     user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['laboratorio', 'muestras'] }),
  })
}

export function useActualizarMuestra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, resultado, devolucion }) => {
      const { error } = await db.from('muestras').update({ resultado, devolucion: devolucion || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['laboratorio', 'muestras'] }),
  })
}

// ── Desarrollos ───────────────────────────────────────────────────────────────

export function useDesarrollos() {
  return useQuery({
    queryKey: ['laboratorio', 'desarrollos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('desarrollos')
        .select('id, codigo, nombre, descripcion, productos_utilizados, resultado_esperado, resultado_obtenido, estado, fecha_inicio, fecha_fin, creado_en')
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60,
  })
}

export function useCrearDesarrollo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ codigo, nombre, descripcion, productosUtilizados, resultadoEsperado, fechaInicio }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await db.from('desarrollos').insert({
        codigo:               codigo || null,
        nombre,
        descripcion:          descripcion || null,
        productos_utilizados: productosUtilizados ?? [],
        resultado_esperado:   resultadoEsperado || null,
        fecha_inicio:         fechaInicio || null,
        estado:               'en-curso',
        creado_por:           user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['laboratorio', 'desarrollos'] }),
  })
}

export function useActualizarDesarrollo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, resultadoObtenido, estado, fechaFin }) => {
      const { error } = await db.from('desarrollos').update({
        resultado_obtenido: resultadoObtenido || null,
        estado,
        fecha_fin: fechaFin || null,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['laboratorio', 'desarrollos'] }),
  })
}

// ── Contratipos (migrado de admin) ────────────────────────────────────────────

export function useContratipos() {
  return useQuery({
    queryKey: ['laboratorio', 'contratipos'],
    queryFn: async () => {
      const { data, error } = await db
        .from('contratipos')
        .select('id, nombre_fq, marca, productor')
        .order('marca')
      if (error) throw error
      return data ?? []
    },
    staleTime: 0,
  })
}

export function useCrearContratype() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nombre_fq, marca, productor }) => {
      const { error } = await db.from('contratipos').insert({
        nombre_fq: nombre_fq.trim(),
        marca:     marca.trim(),
        productor: productor?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laboratorio', 'contratipos'] })
      qc.invalidateQueries({ queryKey: ['admin', 'contratipos'] })
    },
  })
}

export function useEliminarContratype() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await db.from('contratipos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laboratorio', 'contratipos'] })
      qc.invalidateQueries({ queryKey: ['admin', 'contratipos'] })
    },
  })
}
