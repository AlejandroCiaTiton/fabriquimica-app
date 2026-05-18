import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useVendedorAlertas() {
  return useQuery({
    queryKey: ['vendedor', 'alertas'],
    refetchInterval: 30_000,
    staleTime: 1000 * 25,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: vend } = await supabase
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      if (!vend) return { solicitudes: 0, cotizaciones: 0, ordenes: 0, solicitudesAlta: 0 }

      // Tres counts en paralelo; el de OCs usa !inner para evitar el fetch intermedio de IDs
      const [solRes, cotRes, ocRes, altaRes] = await Promise.all([
        supabase
          .from('solicitudes')
          .select('id', { count: 'exact', head: true })
          .eq('vendedor_id', vend.id)
          .eq('estado', 'pendiente'),

        supabase
          .from('cotizaciones')
          .select('id', { count: 'exact', head: true })
          .eq('vendedor_id', vend.id)
          .eq('estado', 'revision'),

        supabase
          .from('ordenes_compra')
          .select('cotizaciones!inner(vendedor_id)', { count: 'exact', head: true })
          .eq('cotizaciones.vendedor_id', vend.id)
          .eq('estado', 'recibida'),

        supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('vendedor_id', vend.id)
          .eq('estado', 'pendiente_confirmacion'),
      ])

      return {
        solicitudes:    solRes.count  ?? 0,
        cotizaciones:   cotRes.count  ?? 0,
        ordenes:        ocRes.count   ?? 0,
        solicitudesAlta: altaRes.count ?? 0,
      }
    },
  })
}
