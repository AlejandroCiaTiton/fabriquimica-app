import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { useZonas } from '../../hooks/useLogistica'

// supabaseAdmin bypasses RLS — admin necesita leer/escribir todos los clientes y vendedores
const db = supabaseAdmin ?? supabase

async function geocodificarDireccion(direccion) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
  if (!key || !direccion) return null
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion + ', Argentina')}&key=${key}&language=es`
  const res  = await fetch(url)
  const data = await res.json()
  if (data.status === 'OK' && data.results[0]) {
    const { lat, lng } = data.results[0].geometry.location
    return { lat, lng }
  }
  return null
}

function useVendedoresAdmin() {
  return useQuery({
    queryKey: ['admin', 'vendedores'],
    queryFn: async () => {
      const { data, error } = await db
        .from('vendedores')
        .select('id, perfiles(nombre)')
        .order('id')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

function useClientesAdmin() {
  return useQuery({
    queryKey: ['admin', 'clientes'],
    queryFn: async () => {
      const { data, error } = await db
        .from('clientes')
        .select('id, razon_social, cuit, pais, es_exterior, direccion, condicion_pago, estado, vendedor_id, vendedores(id, perfiles(nombre)), contactos(id, nombre, tipo, email, telefono)')
        .order('razon_social')
      if (error) throw error
      return data
    },
    staleTime: 0,
  })
}

function useActualizarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, campos }) => {
      const { error } = await db.from('clientes').update(campos).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'clientes'] }),
  })
}

function EditCell({ value, onSave, type = 'text', placeholder = '' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  function handleBlur() {
    setEditing(false)
    if (val !== (value ?? '')) onSave(val)
  }

  if (editing) return (
    <input autoFocus type={type} value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => e.key === 'Enter' && handleBlur()}
      placeholder={placeholder}
      className="w-full text-sm border border-[#004a99] rounded px-2 py-0.5 focus:outline-none min-w-[120px]"
    />
  )

  return (
    <span onClick={() => { setEditing(true); setVal(value ?? '') }}
      className={`cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded block text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>
      {value || placeholder || '—'}
    </span>
  )
}

function ModalContactos({ cliente, onClose }) {
  const contactos = cliente.contactos ?? []
  const TIPO_LABEL = { compras: 'Compras', administracion: 'Administración', gerencia: 'Gerencia', tecnico: 'Técnico' }
  const TIPO_COLOR = { compras: 'bg-blue-50 text-blue-700', administracion: 'bg-purple-50 text-purple-700', gerencia: 'bg-green-50 text-green-700' }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-lg w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{cliente.razon_social}</h2>
            <p className="text-xs text-gray-400">CUIT {cliente.cuit}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">
          {contactos.length === 0
            ? <p className="text-sm text-gray-400 text-center py-4">Sin contactos registrados</p>
            : <ul className="space-y-3">
                {contactos.map(c => (
                  <li key={c.id} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-[#004a99]/10 flex items-center justify-center text-[#004a99] font-bold text-xs flex-shrink-0">
                      {(c.nombre || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{c.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{c.email}{c.telefono ? ` · ${c.telefono}` : ''}</p>
                    </div>
                    {c.tipo && (
                      <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${TIPO_COLOR[c.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_LABEL[c.tipo] ?? c.tipo}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
          }
        </div>
      </div>
    </div>
  )
}

export default function MaestroClientes() {
  const { data: clientes = [], isLoading } = useClientesAdmin()
  const { data: vendedores = [] }          = useVendedoresAdmin()
  const { data: zonas = [] }               = useZonas()
  const actualizar = useActualizarCliente()
  const [geocodingId, setGeocodingId] = useState(null)

  const [tab, setTab]           = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [modalCliente, setModalCliente] = useState(null)

  const pendientes = useMemo(() => clientes.filter(c => c.estado === 'pendiente'), [clientes])
  const inactivos  = useMemo(() => clientes.filter(c => c.estado === 'inactivo'),  [clientes])

  const filtrados = useMemo(() => {
    const base = tab === 'pendientes' ? pendientes : tab === 'inactivos' ? inactivos : clientes
    const q = busqueda.toLowerCase().trim()
    return q ? base.filter(c =>
      c.razon_social?.toLowerCase().includes(q) ||
      c.cuit?.toLowerCase().includes(q) ||
      c.pais?.toLowerCase().includes(q)
    ) : base
  }, [clientes, pendientes, inactivos, tab, busqueda])

  function toggleEstado(id, estadoActual) {
    const nuevo = estadoActual === 'activo' ? 'inactivo' : 'activo'
    actualizar.mutate({ id, campos: { estado: nuevo } })
  }

  function confirmarCliente(id) {
    actualizar.mutate({ id, campos: { estado: 'activo' } })
  }

  async function handleGeocodificar(cliente) {
    if (!cliente.direccion) return
    setGeocodingId(cliente.id)
    const coords = await geocodificarDireccion(cliente.direccion)
    setGeocodingId(null)
    if (coords) {
      actualizar.mutate({ id: cliente.id, campos: { lat: coords.lat, lng: coords.lng } })
    } else {
      alert('No se pudo geocodificar la dirección. Verificá que la dirección sea correcta o que la API key de Google Maps esté configurada.')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Maestro de Clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Hacé clic en cualquier campo para editar</p>
        </div>
        <div className="flex gap-2">
          {pendientes.length > 0 && (
            <span className="bg-amber-50 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-amber-200">
              {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''} de confirmación
            </span>
          )}
          {inactivos.length > 0 && (
            <span className="bg-red-50 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-red-200">
              {inactivos.length} inactivo{inactivos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          ['todos',     'Todos',      null],
          ['pendientes','Pendientes', pendientes.length > 0 ? pendientes.length : null],
          ['inactivos', 'Inactivos',  inactivos.length  > 0 ? inactivos.length  : null],
        ].map(([v, l, count]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === v ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
            {count != null && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${v === 'pendientes' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar cliente…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
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
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Cond. Pago</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Vendedor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Zona</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Coords.</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Contactos</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-28">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.estado === 'pendiente' ? 'bg-amber-50/40' : c.estado !== 'activo' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-2">
                    <EditCell value={c.razon_social}
                      onSave={val => actualizar.mutate({ id: c.id, campos: { razon_social: val } })}
                      placeholder="Razón social"/>
                    {c.es_exterior && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                        Exterior · {c.pais ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <EditCell value={c.cuit}
                      onSave={val => actualizar.mutate({ id: c.id, campos: { cuit: val } })}
                      placeholder="XX-XXXXXXXX-X"/>
                  </td>
                  <td className="px-4 py-2">
                    <EditCell value={c.condicion_pago}
                      onSave={val => actualizar.mutate({ id: c.id, campos: { condicion_pago: val } })}
                      placeholder="Ej: 30 días"/>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={c.vendedor_id ?? ''}
                      onChange={e => actualizar.mutate({ id: c.id, campos: { vendedor_id: e.target.value ? parseInt(e.target.value) : null } })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white text-gray-700 w-full min-w-[120px]"
                    >
                      <option value="">Sin asignar</option>
                      {vendedores.map(v => (
                        <option key={v.id} value={v.id}>{v.perfiles?.nombre ?? `Vendedor ${v.id}`}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={c.zona_id ?? ''}
                      onChange={e => actualizar.mutate({ id: c.id, campos: { zona_id: e.target.value ? parseInt(e.target.value) : null } })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white text-gray-700 w-full"
                    >
                      <option value="">Sin zona</option>
                      {zonas.map(z => (
                        <option key={z.id} value={z.id}>{z.nombre}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {c.lat && c.lng
                      ? <span className="text-[10px] text-green-600 font-semibold">✓ OK</span>
                      : <button
                          onClick={() => handleGeocodificar(c)}
                          disabled={geocodingId === c.id || !c.direccion}
                          title={c.direccion ? 'Geocodificar dirección' : 'Sin dirección cargada'}
                          className="text-xs text-[#004a99] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {geocodingId === c.id ? '…' : 'Geocodificar'}
                        </button>
                    }
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => setModalCliente(c)}
                      className="text-xs text-[#004a99] hover:underline">
                      {c.contactos?.length ?? 0}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {c.estado === 'pendiente' ? (
                      <button onClick={() => confirmarCliente(c.id)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200">
                        Confirmar alta
                      </button>
                    ) : (
                      <button onClick={() => toggleEstado(c.id, c.estado)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          c.estado === 'activo'
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}>
                        {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalCliente && (
        <ModalContactos cliente={modalCliente} onClose={() => setModalCliente(null)}/>
      )}
    </div>
  )
}
