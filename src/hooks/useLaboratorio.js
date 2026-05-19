import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

// ── COAs ─────────────────────────────────────────────────────────────────────

export function useLotesSinCoa() {
  return useQuery({
    queryKey: ['laboratorio', 'lotes-sin-coa'],
    queryFn: async () => {
      const { data, error } = await db
        .from('producciones')
        .select('id, codigo, nombre, cantidad, numero_lote, fecha_produccion, fecha_vencimiento, coa_url')
        .is('coa_url', null)
        .order('fecha_produccion', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useLotesConCoa() {
  return useQuery({
    queryKey: ['laboratorio', 'lotes-con-coa'],
    queryFn: async () => {
      const { data, error } = await db
        .from('producciones')
        .select('id, codigo, nombre, cantidad, numero_lote, fecha_produccion, coa_url')
        .not('coa_url', 'is', null)
        .order('fecha_produccion', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useSubirCoaLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loteId, archivo }) => {
      const ext  = archivo.name.split('.').pop()
      const path = `lotes/${loteId}/${Date.now()}.${ext}`
      const { error: upErr } = await db.storage.from('coas').upload(path, archivo, { upsert: true })
      if (upErr) throw new Error(`Error al subir archivo: ${upErr.message}`)
      const { data: { publicUrl } } = db.storage.from('coas').getPublicUrl(path)
      const { error: updErr } = await db.from('producciones').update({ coa_url: publicUrl }).eq('id', loteId)
      if (updErr) throw updErr
      const { data: { user } } = await supabase.auth.getUser()
      const { error: verErr } = await db.from('coa_versiones').insert({
        produccion_id: loteId,
        url:           publicUrl,
        creado_por:    user?.id ?? null,
      })
      if (verErr) throw verErr
    },
    onSuccess: (_, { loteId }) => {
      qc.invalidateQueries({ queryKey: ['laboratorio', 'lotes-sin-coa'] })
      qc.invalidateQueries({ queryKey: ['laboratorio', 'lotes-con-coa'] })
      qc.invalidateQueries({ queryKey: ['laboratorio', 'coa-versiones', loteId] })
    },
  })
}

export function useCoaVersiones(produccionId) {
  return useQuery({
    queryKey: ['laboratorio', 'coa-versiones', produccionId],
    enabled:  !!produccionId,
    queryFn: async () => {
      const { data, error } = await db
        .from('coa_versiones')
        .select('id, url, creado_en, creado_por')
        .eq('produccion_id', produccionId)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
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

// ── Documentos de producto ────────────────────────────────────────────────────

export function useProductosDocumentos() {
  return useQuery({
    queryKey: ['laboratorio', 'documentos-producto'],
    queryFn: async () => {
      const { data, error } = await db
        .from('productos')
        .select('id, codigo, nombre, presentacion, ficha_tecnica_url, tds_url, hoja_seguridad_url')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useSubirDocumentoProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productoId, tipo, archivo }) => {
      const ext  = archivo.name.split('.').pop()
      const path = `productos/${productoId}/${tipo}.${ext}`
      const { error: upErr } = await db.storage.from('documentos').upload(path, archivo, { upsert: true })
      if (upErr) throw new Error(`Error al subir archivo: ${upErr.message}`)
      const { data: { publicUrl } } = db.storage.from('documentos').getPublicUrl(path)
      const { error } = await db.from('productos').update({ [tipo]: publicUrl }).eq('id', productoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laboratorio', 'documentos-producto'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'stock'] })
    },
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
