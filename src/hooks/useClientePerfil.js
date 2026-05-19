import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const SELECT_PERFIL = `
  id, razon_social, cuit, pais, direccion, es_exterior,
  sitio_web, horario_entrega, descripcion_produccion,
  telefonos_recepcion, direccion_entrega,
  afip_url, ingresos_brutos_url, cm05_url, perfil_completado
`

async function getClienteId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('clientes_usuarios')
    .select('cliente_id')
    .eq('perfil_id', user.id)
    .maybeSingle()
  return data?.cliente_id ?? null
}

export function useClientePerfil() {
  return useQuery({
    queryKey: ['cliente', 'perfil'],
    queryFn: async () => {
      const clienteId = await getClienteId()
      if (!clienteId) return null
      const { data, error } = await supabase
        .from('clientes')
        .select(SELECT_PERFIL)
        .eq('id', clienteId)
        .single()
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useActualizarPerfilCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (campos) => {
      const clienteId = await getClienteId()
      if (!clienteId) throw new Error('No se encontró el cliente')
      const { error } = await supabase
        .from('clientes')
        .update(campos)
        .eq('id', clienteId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente', 'perfil'] }),
  })
}

export function useSubirDocumentoCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tipo, file }) => {
      const clienteId = await getClienteId()
      if (!clienteId) throw new Error('No se encontró el cliente')

      const ext  = file.name.split('.').pop()
      const path = `${clienteId}/${tipo}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('documentos-cliente')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('documentos-cliente')
        .getPublicUrl(path)

      const col = tipo === 'afip'             ? 'afip_url'
                : tipo === 'ingresos_brutos'  ? 'ingresos_brutos_url'
                :                               'cm05_url'

      const { error: dbErr } = await supabase
        .from('clientes')
        .update({ [col]: publicUrl })
        .eq('id', clienteId)
      if (dbErr) throw dbErr

      return publicUrl
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente', 'perfil'] }),
  })
}
