import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { generarCodigoCotizacion, generarCodigoOrden } from '../utils/codigoGenerator'
import { calcularTotales } from '../utils/calc'

export function useCotizaciones() {
  return useQuery({
    queryKey: ['cotizaciones'],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: vend } = await supabase
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      let query = supabase
        .from('cotizaciones')
        .select(`
          id, codigo, estado, creado_en, vencimiento,
          subtotal, iva, total, observaciones, moneda, solicitud_id,
          clientes (id, razon_social),
          vendedores (id, perfiles(nombre))
        `)
        .order('creado_en', { ascending: false })

      if (vend) query = query.eq('vendedor_id', vend.id)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCotizacion(id) {
  return useQuery({
    queryKey: ['cotizacion', id],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select(`
          id, codigo, cliente_id, solicitud_id, observaciones,
          clientes (id, razon_social),
          cotizacion_items (
            id, producto_id, cantidad, precio_unitario,
            lista1_snapshot, lista4_snapshot, lista3_snapshot,
            respuesta, respuesta_nota, recotizar_tipo, cantidad_nueva,
            productos (id, codigo, nombre, presentacion)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCrearCotizacion() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ clienteId, items, validezDias, observaciones, solicitudId }) => {
      const codigo = await generarCodigoCotizacion()

      const vencimiento = new Date()
      vencimiento.setDate(vencimiento.getDate() + validezDias)

      const { subtotal, iva, total } = calcularTotales(items)

      const { data: { user } } = await supabase.auth.getUser()
      const { data: vend } = await supabase
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      const { data: cot, error: errCot } = await supabase
        .from('cotizaciones')
        .insert({
          codigo,
          cliente_id:    clienteId,
          vendedor_id:   vend?.id ?? null,
          estado:        'espera',
          moneda:        'USD',
          validez_dias:  validezDias,
          vencimiento:   vencimiento.toISOString().split('T')[0],
          observaciones: observaciones || null,
          subtotal,
          iva,
          total,
          solicitud_id:  solicitudId || null,
        })
        .select('id, codigo')
        .single()

      if (errCot) throw errCot

      const { error: errItems } = await supabase
        .from('cotizacion_items')
        .insert(items.map((it, idx) => ({
          cotizacion_id:   cot.id,
          producto_id:     it.producto_id,
          cantidad:        it.cantidad,
          precio_unitario: it.precio_unitario,
          lista1_snapshot: it.lista1_may ?? null,
          lista4_snapshot: it.lista4_std ?? null,
          lista3_snapshot: it.lista3_min ?? null,
          posicion:        idx + 1,
        })))

      if (errItems) throw errItems

      if (solicitudId) {
        await supabase
          .from('solicitudes')
          .update({ estado: 'cotizada' })
          .eq('id', solicitudId)
      }

      return cot
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['solicitudes'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'alertas'] })
    },
  })
}

export function useActualizarCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cotizacionId, items, validezDias, observaciones }) => {
      const { data: actual, error: errFetch } = await supabase
        .from('cotizaciones')
        .select('id, codigo, estado, solicitud_id')
        .eq('id', cotizacionId)
        .single()
      if (errFetch) throw errFetch

      const vencimiento = new Date()
      vencimiento.setDate(vencimiento.getDate() + validezDias)

      const { subtotal, iva, total } = calcularTotales(items)

      // revision → espera (cliente ve los nuevos precios)
      const nuevoEstado = actual.estado === 'revision' ? 'espera' : actual.estado

      const { error: errUpd } = await supabase
        .from('cotizaciones')
        .update({
          estado:       nuevoEstado,
          validez_dias: validezDias,
          vencimiento:  vencimiento.toISOString().split('T')[0],
          observaciones: observaciones || null,
          subtotal,
          iva,
          total,
        })
        .eq('id', cotizacionId)
      if (errUpd) throw errUpd

      const { error: errDel } = await supabase
        .from('cotizacion_items')
        .delete()
        .eq('cotizacion_id', cotizacionId)
      if (errDel) throw errDel

      const { error: errIns } = await supabase
        .from('cotizacion_items')
        .insert(items.map((it, idx) => ({
          cotizacion_id:   cotizacionId,
          producto_id:     it.producto_id,
          cantidad:        it.cantidad,
          precio_unitario: it.precio_unitario,
          lista1_snapshot: it.lista1_may  ?? null,
          lista4_snapshot: it.lista4_std  ?? null,
          lista3_snapshot: it.lista3_min  ?? null,
          posicion:        idx + 1,
        })))
      if (errIns) throw errIns

      return { id: actual.id, codigo: actual.codigo }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['cotizacion', variables.cotizacionId] })
      qc.invalidateQueries({ queryKey: ['solicitudes'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'alertas'] })
    },
  })
}

export function useAceptarCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cotizacionId, referenciaCliente, tipoEntrega = 'entrega' }) => {
      const db = supabaseAdmin ?? supabase

      const { data: items } = await supabase
        .from('cotizacion_items')
        .select('id')
        .eq('cotizacion_id', cotizacionId)

      if (items?.length) {
        await Promise.all(
          items.map(it =>
            db.from('cotizacion_items').update({ respuesta: 'aceptado' }).eq('id', it.id)
          )
        )
      }

      const { error: errCot } = await db
        .from('cotizaciones')
        .update({ estado: 'ganada' })
        .eq('id', cotizacionId)
      if (errCot) throw errCot

      const numero = await generarCodigoOrden()
      const { data: oc, error: errOC } = await db
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
      if (errOC) throw errOC

      return oc
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['ordenes'] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['cotizacion', variables.cotizacionId] })
      qc.invalidateQueries({ queryKey: ['solicitudes'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'alertas'] })
    },
  })
}

export function useAprobarCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cotizacionId, solicitudId }) => {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: 'espera' })
        .eq('id', cotizacionId)
      if (error) throw error
      if (solicitudId) {
        await supabase
          .from('solicitudes')
          .update({ estado: 'cotizada' })
          .eq('id', solicitudId)
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['cotizacion', variables.cotizacionId] })
      qc.invalidateQueries({ queryKey: ['solicitudes'] })
    },
  })
}

export function useCancelarCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cotizacionId, solicitudId }) => {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: 'cancelada' })
        .eq('id', cotizacionId)
      if (error) throw error
      if (solicitudId) {
        await supabase
          .from('solicitudes')
          .update({ estado: 'pendiente' })
          .eq('id', solicitudId)
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['cotizacion', variables.cotizacionId] })
      qc.invalidateQueries({ queryKey: ['solicitudes'] })
      qc.invalidateQueries({ queryKey: ['vendedor', 'alertas'] })
    },
  })
}

export function useCerrarCotizacionPerdida() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cotizacionId }) => {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: 'perdida' })
        .eq('id', cotizacionId)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
      qc.invalidateQueries({ queryKey: ['cotizacion', variables.cotizacionId] })
    },
  })
}
