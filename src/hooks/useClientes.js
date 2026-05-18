import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, razon_social, cuit, contactos(id, nombre, email)')
        .order('razon_social')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useCrearClienteVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ razonSocial, cuit, pais, direccion, condicionPago, contactoNombre, contactoEmail, contactoTel }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: vendedor } = await db
        .from('vendedores')
        .select('id')
        .eq('perfil_id', user.id)
        .maybeSingle()

      const esExterior = !!pais && pais.trim().toLowerCase() !== 'argentina'

      const { data: cliente, error } = await db
        .from('clientes')
        .insert({
          razon_social:   razonSocial.trim(),
          cuit:           cuit?.trim()  || null,
          pais:           pais?.trim()  || null,
          es_exterior:    esExterior,
          direccion:      direccion?.trim() || null,
          condicion_pago: condicionPago     || null,
          vendedor_id:    vendedor?.id      ?? null,
          estado:         esExterior ? 'pendiente' : 'activo',
        })
        .select('id, razon_social')
        .single()
      if (error) throw error
      cliente.pendiente = esExterior

      if (contactoNombre?.trim()) {
        await db.from('contactos').insert({
          cliente_id: cliente.id,
          nombre:     contactoNombre.trim(),
          email:      contactoEmail?.trim().toLowerCase() || null,
          telefono:   contactoTel?.trim() || null,
          tipo:       'compras',
        })
      }

      return cliente
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['expo', 'clientes'] })
    },
  })
}
