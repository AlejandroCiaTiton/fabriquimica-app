import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { supabase } from '../../lib/supabase'

const db = supabaseAdmin ?? supabase

function useClientesAsignacion() {
  return useQuery({
    queryKey: ['jefe', 'clientes-asignacion'],
    queryFn: async () => {
      const { data, error } = await db
        .from('clientes')
        .select('id, razon_social, cuit, estado, vendedor_id, vendedores(id, perfiles(nombre))')
        .order('razon_social')
      if (error) throw error
      return data ?? []
    },
    staleTime: 0,
  })
}

function useVendedoresLista() {
  return useQuery({
    queryKey: ['jefe', 'vendedores-lista'],
    queryFn: async () => {
      const { data, error } = await db
        .from('vendedores')
        .select('id, rol, perfiles(nombre)')
        .order('id')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

function useReasignarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clienteId, vendedorId }) => {
      const { error } = await db
        .from('clientes')
        .update({ vendedor_id: vendedorId ?? null })
        .eq('id', clienteId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jefe', 'clientes-asignacion'] }),
  })
}

export default function AsignacionClientes() {
  const { isJefeVentas, isLoading: authLoading } = useAuth()

  const { data: clientes = [], isLoading } = useClientesAsignacion()
  const { data: vendedores = [] }          = useVendedoresLista()
  const reasignar = useReasignarCliente()

  const [busqueda, setBusqueda] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('')

  if (authLoading) return null
  if (!isJefeVentas) return <Navigate to="/vendedor/stock" replace />

  const vendedoresSolo = vendedores.filter(v => v.rol !== 'jefe')

  const filtrados = useMemo(() => {
    let lista = clientes
    const q = busqueda.toLowerCase().trim()
    if (q) {
      lista = lista.filter(c =>
        c.razon_social?.toLowerCase().includes(q) ||
        c.cuit?.includes(q)
      )
    }
    if (filtroVendedor === '__sin__') {
      lista = lista.filter(c => !c.vendedor_id)
    } else if (filtroVendedor) {
      lista = lista.filter(c => String(c.vendedor_id) === filtroVendedor)
    }
    return lista
  }, [clientes, busqueda, filtroVendedor])

  const sinAsignar = clientes.filter(c => !c.vendedor_id).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Asignación de clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Asigná cada cliente a un vendedor</p>
        </div>
        {sinAsignar > 0 && (
          <span className="bg-amber-50 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-amber-200">
            {sinAsignar} sin asignar
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          />
        </div>
        <select
          value={filtroVendedor}
          onChange={e => setFiltroVendedor(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white text-gray-700"
        >
          <option value="">Todos los vendedores</option>
          <option value="__sin__">Sin asignar</option>
          {vendedoresSolo.map(v => (
            <option key={v.id} value={String(v.id)}>{v.perfiles?.nombre ?? `Vendedor ${v.id}`}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : filtrados.length === 0
          ? <div className="p-12 text-center text-sm text-gray-400">Sin clientes</div>
          : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Razón Social</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">CUIT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-52">Vendedor asignado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${!c.vendedor_id ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c.razon_social}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.cuit || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.estado === 'activo' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={c.vendedor_id ?? ''}
                      onChange={e => reasignar.mutate({ clienteId: c.id, vendedorId: e.target.value ? parseInt(e.target.value) : null })}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white text-gray-700 w-full"
                    >
                      <option value="">Sin asignar</option>
                      {vendedoresSolo.map(v => (
                        <option key={v.id} value={v.id}>{v.perfiles?.nombre ?? `Vendedor ${v.id}`}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
