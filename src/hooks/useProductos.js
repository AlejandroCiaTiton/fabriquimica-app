import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useProductos() {
  return useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select(`
          id,
          codigo,
          nombre,
          presentacion,
          activo,
          precios_actuales (
            lista1_may,
            lista4_std,
            lista3_min
          ),
          stock_actual (
            cantidad
          )
        `)
        .eq('activo', true)
        .order('nombre')

      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })
}
