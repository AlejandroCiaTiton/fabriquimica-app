import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const SELECT_OC_LOG = `
  id, numero, estado, fecha_estimada_entrega, tipo_entrega, creado_en,
  cotizaciones (
    id, codigo, total,
    clientes (id, razon_social, lat, lng, zona_id,
      zonas_entrega (id, nombre, color)
    ),
    cotizacion_items (
      id, cantidad, producto_id,
      productos (id, nombre, codigo,
        stock_actual (id, cantidad)
      )
    )
  ),
  plan_entregas (id, fecha, notas)
`

export function useOrdenesLogistica() {
  return useQuery({
    queryKey: ['logistica', 'ordenes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordenes_compra')
        .select(SELECT_OC_LOG)
        .eq('tipo_entrega', 'entrega')
        .not('estado', 'eq', 'entregada')
        .order('fecha_estimada_entrega', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useZonas() {
  return useQuery({
    queryKey: ['logistica', 'zonas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zonas_entrega')
        .select('*')
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useCrearZona() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nombre, color }) => {
      const db = supabaseAdmin ?? supabase
      const { data, error } = await db
        .from('zonas_entrega')
        .insert({ nombre, color })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logistica', 'zonas'] }),
  })
}

export function useEliminarZona() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const db = supabaseAdmin ?? supabase
      const { error } = await db.from('zonas_entrega').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logistica', 'zonas'] }),
  })
}

export function useAsignarPlanEntrega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, fecha, notas, logisticaId }) => {
      const { error } = await supabase
        .from('plan_entregas')
        .upsert(
          { oc_id: ocId, fecha, notas: notas || null, logistica_id: logisticaId },
          { onConflict: 'oc_id' }
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logistica'] }),
  })
}

// ── helpers exportados ────────────────────────────────────────────────────────

export function getUrgencia(fechaEstimada) {
  if (!fechaEstimada) return 'sin-fecha'
  const dias = Math.ceil((new Date(fechaEstimada + 'T00:00:00') - new Date()) / 86400000)
  if (dias <= 2) return 'critico'
  if (dias <= 4) return 'urgente'
  if (dias <= 7) return 'proximo'
  return 'normal'
}

export function checkStock(cotizacionItems) {
  if (!cotizacionItems?.length) return null
  return cotizacionItems.every(it => {
    const sa = Array.isArray(it.productos?.stock_actual)
      ? it.productos.stock_actual[0]
      : it.productos?.stock_actual
    return sa != null && (sa.cantidad ?? 0) >= it.cantidad
  })
}

export const URGENCIA_CONFIG = {
  critico:    { color: '#dc3545', label: '≤ 2 días',  bgClass: 'bg-red-100 text-red-700'       },
  urgente:    { color: '#fd7e14', label: '≤ 4 días',  bgClass: 'bg-orange-100 text-orange-700' },
  proximo:    { color: '#ffc107', label: '≤ 7 días',  bgClass: 'bg-yellow-100 text-yellow-700' },
  normal:     { color: '#28a745', label: 'OK',         bgClass: 'bg-green-100 text-green-700'  },
  'sin-fecha':{ color: '#6c757d', label: 'Sin fecha', bgClass: 'bg-gray-100 text-gray-500'     },
}

// ── Transportistas ────────────────────────────────────────────────────────────

export function useTransportistas() {
  return useQuery({
    queryKey: ['logistica', 'transportistas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transportistas')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useCrearTransportista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nombre, apellido, empresa, vehiculo }) => {
      const db = supabaseAdmin ?? supabase
      const { error } = await db.from('transportistas').insert({
        nombre:   nombre.trim(),
        apellido: apellido.trim(),
        empresa:  empresa?.trim() || null,
        vehiculo: vehiculo?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logistica', 'transportistas'] }),
  })
}

export function useEliminarTransportista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const db = supabaseAdmin ?? supabase
      const { error } = await db.from('transportistas').update({ activo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logistica', 'transportistas'] }),
  })
}

// ── Cronograma de envíos (logística) ─────────────────────────────────────────

const SELECT_CRONOGRAMA_LOG = `
  id, estado, fecha_programada, hora_estimada, observaciones, creado_en,
  ordenes_compra (
    id, numero, estado,
    cotizaciones (
      id, codigo,
      clientes (id, razon_social),
      cotizacion_items (
        id, cantidad,
        productos (id, nombre, codigo)
      )
    )
  ),
  transportistas (id, nombre, apellido, empresa, vehiculo)
`

export function useCronogramaLogistica() {
  return useQuery({
    queryKey: ['logistica', 'cronograma'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cronograma_envios')
        .select(SELECT_CRONOGRAMA_LOG)
        .order('fecha_programada', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useOrdenesListasDespacho() {
  return useQuery({
    queryKey: ['logistica', 'ordenes-listas-despacho'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordenes_compra')
        .select(`
          id, numero, estado, fecha_estimada_entrega,
          cotizaciones (
            id, codigo,
            clientes (id, razon_social),
            cotizacion_items (id, cantidad, productos (id, nombre, codigo))
          )
        `)
        .in('estado', ['listo-entrega', 'pendiente-despacho'])
        .order('fecha_estimada_entrega', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useProgramarEnvio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, transportistaId, fechaProgramada, horaEstimada, observaciones }) => {
      const db = supabaseAdmin ?? supabase
      const { data: { user } } = await supabase.auth.getUser()

      const { error: e1 } = await db.from('cronograma_envios').insert({
        oc_id:            ocId,
        transportista_id: transportistaId,
        fecha_programada: fechaProgramada,
        hora_estimada:    horaEstimada || null,
        observaciones:    observaciones || null,
        creado_por:       user?.id ?? null,
      })
      if (e1) throw e1

      const { error: e2 } = await db
        .from('ordenes_compra')
        .update({ estado: 'pendiente-despacho' })
        .eq('id', ocId)
      if (e2) throw e2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logistica', 'cronograma'] })
      qc.invalidateQueries({ queryKey: ['logistica', 'ordenes-listas-despacho'] })
      qc.invalidateQueries({ queryKey: ['logistica', 'ordenes'] })
    },
  })
}

// ── Recepción de mercadería ───────────────────────────────────────────────────

export function useRecepciones() {
  return useQuery({
    queryKey: ['logistica', 'recepciones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recepciones_mercaderia')
        .select('id, codigo, nombre, cantidad, fecha_recepcion, numero_lote, fecha_vencimiento, creado_en')
        .order('creado_en', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useRegistrarRecepcion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productoId, codigo, nombre, cantidad, fechaRecepcion, numeroLote, fechaVencimiento, esNuevo }) => {
      const db = supabaseAdmin ?? supabase
      let prodId = productoId

      if (esNuevo) {
        const { data: prod, error: prodErr } = await db
          .from('productos')
          .insert({ codigo: codigo.trim(), nombre: nombre.trim(), activo: true })
          .select('id')
          .single()
        if (prodErr) throw prodErr
        prodId = prod.id
        await db.from('stock_actual').insert({ producto_id: prodId, cantidad: parseFloat(cantidad) || 0 })
      } else {
        const { data: sa } = await db
          .from('stock_actual')
          .select('cantidad')
          .eq('producto_id', prodId)
          .maybeSingle()
        if (sa) {
          await db.from('stock_actual')
            .update({ cantidad: (sa.cantidad ?? 0) + (parseFloat(cantidad) || 0) })
            .eq('producto_id', prodId)
        } else {
          await db.from('stock_actual').insert({ producto_id: prodId, cantidad: parseFloat(cantidad) || 0 })
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('recepciones_mercaderia').insert({
        producto_id:      prodId,
        codigo:           codigo,
        nombre:           nombre,
        cantidad:         parseFloat(cantidad) || 0,
        fecha_recepcion:  fechaRecepcion,
        numero_lote:      numeroLote || null,
        fecha_vencimiento: fechaVencimiento || null,
        creado_por:       user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logistica', 'recepciones'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stock'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

