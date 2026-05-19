import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const SELECT_ENVIO = `
  id, estado, cantidad, lote, notas, uso, resultado, creado_en, recibida_en, evaluada_en,
  vendedor_id, cliente_id,
  clientes   (id, razon_social),
  productos  (id, nombre, codigo),
  vendedores (id, perfiles(nombre))
`

const SELECT_SOLICITUD = `
  id, uso_previsto, estado, respuesta_vendedor, creado_en, respondida_en,
  vendedor_id, cliente_id,
  clientes  (id, razon_social),
  productos (id, nombre, codigo),
  producto_alternativo:productos!muestras_solicitud_producto_alternativo_id_fkey (id, nombre, codigo),
  vendedores (id, perfiles(nombre))
`

async function getVendedorId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('vendedores').select('id').eq('perfil_id', user.id).maybeSingle()
  return data?.id ?? null
}

async function getClienteId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('clientes_usuarios').select('cliente_id').eq('perfil_id', user.id).maybeSingle()
  return data?.cliente_id ?? null
}

// ── VENDEDOR ─────────────────────────────────────────────────────────────────

export function useClientesVendedor() {
  return useQuery({
    queryKey: ['muestras', 'clientes-vendedor'],
    queryFn: async () => {
      const vendId = await getVendedorId()
      if (!vendId) return []
      const { data, error } = await supabase
        .from('clientes')
        .select('id, razon_social')
        .eq('vendedor_id', vendId)
        .eq('estado', 'activo')
        .order('razon_social')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useLotesProducto(productoId) {
  return useQuery({
    queryKey: ['muestras', 'lotes', productoId],
    enabled:  !!productoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producciones')
        .select('id, numero_lote, cantidad, fecha_produccion')
        .eq('producto_id', productoId)
        .not('numero_lote', 'is', null)
        .order('fecha_produccion', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useMuestrasVendedor() {
  return useQuery({
    queryKey: ['muestras', 'envios-vendedor'],
    queryFn: async () => {
      const vendId = await getVendedorId()
      if (!vendId) return []
      const { data, error } = await supabase
        .from('muestras_envio')
        .select(SELECT_ENVIO)
        .eq('vendedor_id', vendId)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useEnviarMuestra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clienteId, productoId, cantidad, lote, notas }) => {
      const vendId = await getVendedorId()
      if (!vendId) throw new Error('No se encontró el vendedor')
      const { error } = await supabase
        .from('muestras_envio')
        .insert({ vendedor_id: vendId, cliente_id: clienteId, producto_id: productoId, cantidad, lote: lote || null, notas: notas || null })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['muestras', 'envios-vendedor'] })
      qc.invalidateQueries({ queryKey: ['muestras', 'envios-cliente'] })
    },
  })
}

export function useSolicitudesVendedor() {
  return useQuery({
    queryKey: ['muestras', 'solicitudes-vendedor'],
    queryFn: async () => {
      const vendId = await getVendedorId()
      if (!vendId) return []
      // Solicitudes asignadas a este vendedor O sin asignar (de sus clientes)
      const { data: propias } = await supabase
        .from('muestras_solicitud')
        .select(SELECT_SOLICITUD)
        .eq('vendedor_id', vendId)
        .order('creado_en', { ascending: false })

      const { data: clientes } = await supabase
        .from('clientes').select('id').eq('vendedor_id', vendId)
      const clienteIds = (clientes ?? []).map(c => c.id)

      let sinAsignar = []
      if (clienteIds.length > 0) {
        const { data } = await supabase
          .from('muestras_solicitud')
          .select(SELECT_SOLICITUD)
          .in('cliente_id', clienteIds)
          .is('vendedor_id', null)
          .order('creado_en', { ascending: false })
        sinAsignar = data ?? []
      }

      const todas = [...(propias ?? []), ...sinAsignar]
      const unique = todas.filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
      return unique.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
    },
    staleTime: 1000 * 30,
  })
}

export function useSolicitudesPendientesCount() {
  const { data = [] } = useSolicitudesVendedor()
  return data.filter(s => s.estado === 'pendiente').length
}

export function useResponderSolicitud() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ solicitudId, accion, respuesta, productoAlternativoId, clienteId, productoId, cantidad }) => {
      const vendId = await getVendedorId()

      if (accion === 'aceptar') {
        // 1. Crear envío
        const { error: envErr } = await supabase
          .from('muestras_envio')
          .insert({ vendedor_id: vendId, cliente_id: clienteId, producto_id: productoId, cantidad, notas: respuesta || null })
        if (envErr) throw envErr
        // 2. Actualizar solicitud
        const { error } = await supabase
          .from('muestras_solicitud')
          .update({ estado: 'aceptada', vendedor_id: vendId, respuesta_vendedor: respuesta || null, respondida_en: new Date().toISOString() })
          .eq('id', solicitudId)
        if (error) throw error

      } else if (accion === 'alternativa') {
        const { error } = await supabase
          .from('muestras_solicitud')
          .update({ estado: 'alternativa_sugerida', vendedor_id: vendId, respuesta_vendedor: respuesta, producto_alternativo_id: productoAlternativoId, respondida_en: new Date().toISOString() })
          .eq('id', solicitudId)
        if (error) throw error

      } else if (accion === 'rechazar') {
        const { error } = await supabase
          .from('muestras_solicitud')
          .update({ estado: 'rechazada', vendedor_id: vendId, respuesta_vendedor: respuesta, respondida_en: new Date().toISOString() })
          .eq('id', solicitudId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['muestras'] })
    },
  })
}

// ── CLIENTE ──────────────────────────────────────────────────────────────────

export function useMuestrasCliente() {
  return useQuery({
    queryKey: ['muestras', 'envios-cliente'],
    queryFn: async () => {
      const clienteId = await getClienteId()
      if (!clienteId) return []
      const { data, error } = await supabase
        .from('muestras_envio')
        .select(SELECT_ENVIO)
        .eq('cliente_id', clienteId)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useMuestrasClientePendientesCount() {
  const { data = [] } = useMuestrasCliente()
  return data.filter(m => m.estado === 'enviada').length
}

export function useActualizarMuestra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, campos }) => {
      const { error } = await supabase
        .from('muestras_envio')
        .update(campos)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['muestras', 'envios-cliente'] })
      qc.invalidateQueries({ queryKey: ['muestras', 'envios-vendedor'] })
    },
  })
}

export function useSolicitudesCliente() {
  return useQuery({
    queryKey: ['muestras', 'solicitudes-cliente'],
    queryFn: async () => {
      const clienteId = await getClienteId()
      if (!clienteId) return []
      const { data, error } = await supabase
        .from('muestras_solicitud')
        .select(SELECT_SOLICITUD)
        .eq('cliente_id', clienteId)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useSolicitarMuestra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productoId, usoPrevisto }) => {
      const clienteId = await getClienteId()
      if (!clienteId) throw new Error('No se encontró el cliente')

      // Intentar asignar vendedor automáticamente
      const { data: cli } = await supabase
        .from('clientes').select('vendedor_id').eq('id', clienteId).single()

      const { error } = await supabase
        .from('muestras_solicitud')
        .insert({ cliente_id: clienteId, vendedor_id: cli?.vendedor_id ?? null, producto_id: productoId || null, uso_previsto: usoPrevisto })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['muestras', 'solicitudes-cliente'] })
      qc.invalidateQueries({ queryKey: ['muestras', 'solicitudes-vendedor'] })
    },
  })
}

// ── PRODUCTOS (para selects) ──────────────────────────────────────────────────
export function useProductosActivos() {
  return useQuery({
    queryKey: ['muestras', 'productos-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, nombre, codigo')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}
