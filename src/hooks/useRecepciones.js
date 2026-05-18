import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// recepciones schema: { oc_id, cot_item_id, estado, comentario, accion_correctiva, estado_gestion }
// composite PK: (oc_id, cot_item_id)
// confirmation via ordenes_compra.recepcion_confirmada

export function useMarcarItemRecepcion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, cotizacionItemId, estado, comentario, fotoUrl }) => {
      const record = { oc_id: ocId, cot_item_id: cotizacionItemId, estado, comentario: comentario || null }
      if (fotoUrl !== undefined) record.foto_url = fotoUrl
      const { error } = await supabase
        .from('recepciones')
        .upsert(record, { onConflict: 'oc_id,cot_item_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes'] }),
  })
}

export function useGuardarAccionCorrectiva() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId, cotizacionItemId, accionCorrectiva, estadoGestion }) => {
      const { error } = await supabase
        .from('recepciones')
        .update({
          accion_correctiva: accionCorrectiva || null,
          estado_gestion:    estadoGestion,
        })
        .eq('oc_id', ocId)
        .eq('cot_item_id', cotizacionItemId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes'] }),
  })
}

export function useConfirmarRecepcion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ocId }) => {
      const { error } = await supabase
        .from('ordenes_compra')
        .update({ recepcion_confirmada: true })
        .eq('id', ocId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes'] }),
  })
}
