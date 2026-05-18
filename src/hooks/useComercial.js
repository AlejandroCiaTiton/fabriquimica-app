import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

export function useHistoricoCompras() {
  return useQuery({
    queryKey: ['comercial', 'historico'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ordenes_compra')
        .select(`
          id, numero, estado, estado_pago, numero_factura, creado_en,
          cotizaciones(
            id, codigo, total,
            clientes(id, razon_social),
            vendedores(id, perfiles(nombre)),
            cotizacion_items(id, cantidad, lote_aplicado, productos(nombre, codigo))
          )
        `)
        .order('creado_en', { ascending: false })
        .limit(500)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

export function useDirectorioClientes() {
  return useQuery({
    queryKey: ['comercial', 'directorio'],
    queryFn: async () => {
      const { data, error } = await db
        .from('clientes')
        .select(`
          id, razon_social, cuit, direccion, condicion_pago, estado,
          vendedores(id, perfiles(nombre)),
          contactos(id, nombre, tipo, email, telefono)
        `)
        .order('razon_social')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}
