import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useCotizacionesCliente() {
  return useQuery({
    queryKey: ['cotizaciones', 'cliente'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: cu } = await supabase
        .from('clientes_usuarios')
        .select('cliente_id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      if (!cu?.cliente_id) return []

      const { data, error } = await supabase
        .from('cotizaciones')
        .select(`
          id, codigo, estado, creado_en, vencimiento,
          subtotal, iva, total, observaciones, moneda, validez_dias,
          vendedores (id, perfiles(nombre)),
          cotizacion_items (
            id, producto_id, cantidad, precio_unitario, subtotal,
            lista1_snapshot, lista4_snapshot, lista3_snapshot,
            respuesta, respuesta_nota, recotizar_tipo, cantidad_nueva,
            productos (id, codigo, nombre, presentacion)
          )
        `)
        .eq('cliente_id', cu.cliente_id)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return (data ?? []).filter(c => c.estado !== 'cancelada' && c.estado !== 'borrador')
    },
  })
}

export function useResponderCotizacion() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ cotizacionId, respuestas }) => {
      // respuestas: [{ itemId, accion, tipo, cantNueva, nota }]

      await Promise.all(respuestas.map(r =>
        supabase
          .from('cotizacion_items')
          .update({
            respuesta:      r.accion,
            recotizar_tipo: r.tipo || null,
            cantidad_nueva: r.cantNueva || null,
            respuesta_nota: r.nota || null,
          })
          .eq('id', r.itemId)
      ))

      const todosAceptados  = respuestas.every(r => r.accion === 'aceptado')
      const todosRechazados = respuestas.every(r => r.accion === 'rechazado')
      const hayRecotizar    = respuestas.some(r => r.accion === 'recotizar')
      const hayAceptados    = respuestas.some(r => r.accion === 'aceptado')
      const nuevoEstado = todosAceptados
        ? 'ganada'
        : todosRechazados
        ? 'perdida'
        : hayRecotizar
        ? 'revision'
        : hayAceptados
        ? 'parcial'
        : 'perdida'

      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: nuevoEstado })
        .eq('id', cotizacionId)

      if (error) throw error
      return { nuevoEstado }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}

export function useRechazarCotizacion() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ cotizacionId, motivo }) => {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: 'perdida', motivo_rechazo: motivo || null })
        .eq('id', cotizacionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}
