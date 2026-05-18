import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const PESOS_DEFAULT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

export function usePlanAnual(anio) {
  return useQuery({
    queryKey: ['plan', anio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_vendedor_anual')
        .select('id, objetivo, vendedor_id, vendedores(id, perfiles(nombre))')
        .eq('anio', anio)
      if (error) throw error
      return data ?? []
    },
    staleTime: 0,
  })
}

export function usePesosMensuales(anio) {
  return useQuery({
    queryKey: ['plan_pesos', anio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_pesos_mensuales')
        .select('mes, peso')
        .eq('anio', anio)
        .order('mes')
      if (error) throw error
      return data ?? []
    },
    staleTime: 0,
  })
}

export function useActualizarPesoMes(anio) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ mes, peso }) => {
      const { error } = await supabase
        .from('plan_pesos_mensuales')
        .upsert({ anio, mes, peso: parseFloat(peso) || 0 }, { onConflict: 'anio,mes' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan_pesos', anio] }),
  })
}

export function useActualizarObjetivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ planId, objetivo }) => {
      const { error } = await supabase
        .from('plan_vendedor_anual')
        .update({ objetivo: parseFloat(objetivo) || 0 })
        .eq('id', planId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan'] }),
  })
}

export function useCrearPlanVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vendedorId, anio }) => {
      const { error } = await supabase
        .from('plan_vendedor_anual')
        .insert({ vendedor_id: vendedorId, anio, objetivo: 0 })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan'] }),
  })
}

export function useEliminarPlanVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ planId }) => {
      const { error } = await supabase
        .from('plan_vendedor_anual')
        .delete()
        .eq('id', planId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan'] }),
  })
}
