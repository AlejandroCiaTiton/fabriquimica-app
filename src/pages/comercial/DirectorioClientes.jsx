import { useState, useMemo } from 'react'
import { useDirectorioClientes } from '../../hooks/useComercial'

function fmtTipo(tipo) {
  const MAP = { principal: 'Principal', comercial: 'Comercial', tecnico: 'Técnico', administrativo: 'Admin' }
  return MAP[tipo] ?? tipo
}

export default function DirectorioClientes() {
  const { data: clientes = [], isLoading, error } = useDirectorioClientes()
  const [busqueda,       setBusqueda]       = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState('todos')

  const vendedores = useMemo(() => {
    const map = {}
    clientes.forEach(c => {
      const v = c.vendedores
      if (v) map[v.id] = v.perfiles?.nombre ?? `Vendedor ${v.id}`
    })
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]))
  }, [clientes])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return clientes.filter(c => {
      if (vendedorFiltro !== 'todos' && String(c.vendedores?.id) !== vendedorFiltro) return false
      if (!q) return true
      return (
        c.razon_social?.toLowerCase().includes(q) ||
        c.cuit?.includes(q)
      )
    })
  }, [clientes, busqueda, vendedorFiltro])

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Directorio de clientes</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? 'Cargando…' : `${filtrados.length} cliente${filtrados.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o CUIT…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b4332]"/>
        </div>
        <select value={vendedorFiltro} onChange={e => setVendedorFiltro(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1b4332] bg-white">
          <option value="todos">Todos los vendedores</option>
          {vendedores.map(([id, nombre]) => (
            <option key={id} value={id}>{nombre}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-mono">
          Error: {error.message}
        </div>
      )}

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/></div>
          : filtrados.length === 0
          ? <div className="p-12 text-center text-sm text-gray-400">Sin clientes para estos filtros</div>
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">CUIT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Vendedor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Contactos</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Cond. pago</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(c => {
                  const vendedor = c.vendedores?.perfiles?.nombre
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.razon_social}</p>
                        {c.direccion && <p className="text-xs text-gray-400 mt-0.5">{c.direccion}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.cuit || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {vendedor ?? <span className="text-xs text-gray-300 italic">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3">
                        {(!c.contactos || c.contactos.length === 0)
                          ? <span className="text-xs text-gray-300">—</span>
                          : c.contactos.map(ct => (
                            <div key={ct.id} className="flex items-baseline gap-2 text-xs mb-1 flex-wrap">
                              {ct.nombre && (
                                <span className="font-medium text-gray-700">{ct.nombre}</span>
                              )}
                              {ct.tipo && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{fmtTipo(ct.tipo)}</span>
                              )}
                              {ct.email && (
                                <a href={`mailto:${ct.email}`} className="text-[#1b4332] hover:underline">{ct.email}</a>
                              )}
                              {ct.telefono && (
                                <a href={`tel:${ct.telefono}`} className="text-gray-500 hover:text-gray-700">{ct.telefono}</a>
                              )}
                            </div>
                          ))
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.condicion_pago || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          c.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {c.estado === 'activo' ? 'Activo' : (c.estado ?? '—')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
