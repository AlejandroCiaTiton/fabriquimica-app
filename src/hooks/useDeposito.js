import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

const SELECT_CRONOGRAMA = `
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

export function useCronogramaDeposito() {
  return useQuery({
    queryKey: ['deposito', 'cronograma'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cronograma_envios')
        .select(SELECT_CRONOGRAMA)
        .eq('estado', 'programado')
        .order('fecha_programada', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useConfirmarCarga() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { data: envio, error: fetchErr } = await db
        .from('cronograma_envios')
        .select('oc_id')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr

      const { error: e1 } = await db
        .from('cronograma_envios')
        .update({ estado: 'entregado' })
        .eq('id', id)
      if (e1) throw e1

      const { error: e2 } = await db
        .from('ordenes_compra')
        .update({ estado: 'entregada' })
        .eq('id', envio.oc_id)
      if (e2) throw e2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposito', 'cronograma'] })
      qc.invalidateQueries({ queryKey: ['logistica'] })
    },
  })
}

export function useReportarProblema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, tipo, notas }) => {
      const { data: envio, error: fetchErr } = await db
        .from('cronograma_envios')
        .select('oc_id')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr

      const { error: e1 } = await db
        .from('cronograma_envios')
        .update({ estado: tipo, observaciones: notas || null })
        .eq('id', id)
      if (e1) throw e1

      const nuevoEstadoOC = tipo === 'sin-productos' ? 'en-preparacion' : 'listo-entrega'
      const { error: e2 } = await db
        .from('ordenes_compra')
        .update({ estado: nuevoEstadoOC })
        .eq('id', envio.oc_id)
      if (e2) throw e2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposito', 'cronograma'] })
      qc.invalidateQueries({ queryKey: ['logistica'] })
    },
  })
}
