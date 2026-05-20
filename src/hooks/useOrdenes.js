import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { generarCodigoOrden } from '../utils/codigoGenerator'

const SELECT_OC = `
  id, numero, estado, estado_pago, referencia_cliente, numero_factura, fecha_estimada_entrega, creado_en, recepcion_confirmada, tipo_entrega,
  cotizaciones (
    id, codigo, subtotal, iva, total, moneda,
    clientes (id, razon_social, cuit),
    vendedores (id, perfiles(nombre)),
    cotizacion_items (
      id, producto_id, cantidad, precio_unitario, subtotal,
      lista1_snapshot, lista4_snapshot, lista3_snapshot,
      productos (id, codigo, nombre, presentacion)
    )
  ),
  recepciones (oc_id, cot_item_id, estado, comentario, accion_correctiva, estado_gestion),
  facturas (id, numero)
`

// Misma estructura pero con inner join para poder filtrar por campos de cotizaciones
const SELECT_OC_INNER = SELECT_OC.replace('cotizaciones (', 'cotizaciones!inner(')

export function useOrdenesCliente() {
  return useQuery({
    queryKey: ['ordenes', 'cliente'],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: cu } = await supabase
        .from('clientes_usuarios')
        .select('cliente_id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      if (!cu?.cliente_id) return []

      const { data, error } = await supabase
        .from('ordenes_compra')
        .select(SELECT_OC_INNER)
        .eq('cotizaciones.cliente_id', cu.cliente_id)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useOrdenesVendedor() {
  return useQuery({
    queryKey: ['ordenes', 'vendedor'],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: vend } = await supabase
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      if (!vend) return []

      const { data, error } = await supabase
        .from('ordenes_compra')
        .select(SELECT_OC_INNER)
        .eq('cotizaciones.vendedor_id', vend.id)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useEmitirOC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cotizacionId, referenciaCliente, tipoEntrega = 'entrega' }) => {
      const numero = await generarCodigoOrden()
      const { data, error } = await supabase
        .from('ordenes_compra')
        .insert({
          numero,
          cotizacion_id:      cotizacionId,
          estado:             'recibida',
          referencia_cliente: referenciaCliente || null,
          tipo_entrega:       tipoEntrega,
        })
        .select('id, numero')
        .single()
      if (error) throw error
      const { error: cotErr } = await supabase
        .from('cotizaciones')
        .update({ estado: 'ganada' })
        .eq('id', cotizacionId)
      if (cotErr) throw cotErr
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenes'] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}

export function useActualizarDatosOC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, numeroFactura, fechaEstimadaEntrega }) => {
      const { error } = await supabase
        .from('ordenes_compra')
        .update({
          numero_factura:         numeroFactura         || null,
          fecha_estimada_entrega: fechaEstimadaEntrega  || null,
        })
        .eq('id', ocId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenes'] })
      qc.invalidateQueries({ queryKey: ['logistica'] })
      qc.invalidateQueries({ queryKey: ['chofer'] })
    },
  })
}

export function useActualizarEstadoPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, estadoPago }) => {
      const { error } = await supabase
        .from('ordenes_compra')
        .update({ estado_pago: estadoPago })
        .eq('id', ocId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenes'] })
      qc.invalidateQueries({ queryKey: ['finanzas'] })
    },
  })
}

export function useAvanzarEstadoOC() {
  const qc = useQueryClient()
  const PIPELINE = ['recibida', 'en-preparacion', 'listo-entrega', 'entregada']
  return useMutation({
    mutationFn: async ({ ocId, estadoActual }) => {
      const idx = PIPELINE.indexOf(estadoActual)
      if (idx === -1 || idx === PIPELINE.length - 1) throw new Error('Estado final')
      const nuevoEstado = PIPELINE[idx + 1]
      const { error } = await supabase
        .from('ordenes_compra')
        .update({ estado: nuevoEstado })
        .eq('id', ocId)
      if (error) throw error
      return nuevoEstado
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenes'] })
      qc.invalidateQueries({ queryKey: ['logistica'] })
      qc.invalidateQueries({ queryKey: ['chofer'] })
    },
  })
}

export function useFacturasPdfOC(ocIds = []) {
  return useQuery({
    queryKey: ['ordenes', 'facturas-pdf', ocIds],
    enabled:  ocIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select('id, oc_id, pdf_url')
        .in('oc_id', ocIds)
        .not('pdf_url', 'is', null)
      if (error) return []
      return data ?? []
    },
    staleTime: 1000 * 60,
  })
}

export function useComprobantesOC(ocIds = []) {
  return useQuery({
    queryKey: ['ordenes', 'comprobantes', ocIds],
    enabled:  ocIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comprobantes_pago')
        .select('id, oc_id, url, creado_en')
        .in('oc_id', ocIds)
        .order('creado_en', { ascending: false })
      // Si la tabla aún no existe (migration pendiente), devolver vacío
      if (error) return []
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useSubirComprobantePago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, file }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const ext  = file.name.split('.').pop()
      const path = `${ocId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comprobantes')
        .upload(path, file, { upsert: false })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage
        .from('comprobantes')
        .getPublicUrl(path)
      const { error: dbErr } = await supabase
        .from('comprobantes_pago')
        .insert({ oc_id: ocId, url: publicUrl, subido_por: user.id })
      if (dbErr) throw dbErr
      return publicUrl
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes'] }),
  })
}

export function useOrdenesAsistente() {
  const db = supabaseAdmin ?? supabase
  return useQuery({
    queryKey: ['ordenes', 'asistente'],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await db
        .from('ordenes_compra')
        .select(SELECT_OC)
        .order('creado_en', { ascending: false })
        .limit(1000)
      if (error) throw error
      return data ?? []
    },
  })
}
