import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

const SELECT_ENTREGA = `
  id, numero, estado, fecha_estimada_entrega, tipo_entrega,
  cotizaciones (
    id, codigo,
    clientes (id, razon_social, lat, lng),
    cotizacion_items (
      id, cantidad, lote_aplicado,
      productos (id, nombre, codigo)
    )
  ),
  plan_entregas (id, fecha, notas)
`

export function useEntregasChofer() {
  return useQuery({
    queryKey: ['chofer', 'entregas'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ordenes_compra')
        .select(SELECT_ENTREGA)
        .eq('tipo_entrega', 'entrega')
        .eq('estado', 'listo-entrega')
        .order('fecha_estimada_entrega', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useConfirmarEntrega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ocId) => {
      const { error } = await db
        .from('ordenes_compra')
        .update({ estado: 'entregada' })
        .eq('id', ocId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chofer'] })
      qc.invalidateQueries({ queryKey: ['logistica'] })
      qc.invalidateQueries({ queryKey: ['ordenes'] })
    },
  })
}

export function useRegistrarNoEntrega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, motivo }) => {
      const { error } = await db
        .from('plan_entregas')
        .upsert({ oc_id: ocId, notas: motivo }, { onConflict: 'oc_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chofer'] }),
  })
}
