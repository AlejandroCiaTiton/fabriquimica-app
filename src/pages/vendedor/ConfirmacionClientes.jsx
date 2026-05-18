import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin, crearAuthUser } from '../../lib/supabaseAdmin'

function useSolicitudesAlta() {
  return useQuery({
    queryKey: ['jefe', 'solicitudes_alta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitudes_alta')
        .select('*')
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 0,
  })
}

function useVendedores() {
  return useQuery({
    queryKey: ['admin', 'vendedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, perfiles(nombre)')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

function Badge({ estado }) {
  const cfg = {
    pendiente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    aprobado:  'bg-green-50 text-green-700 border-green-200',
    rechazado: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg[estado] ?? cfg.pendiente}`}>
      {estado}
    </span>
  )
}

const PASS_DEFAULT = '123456'

function ModalAprobar({ solicitud, vendedores, onClose, onDone }) {
  const [form, setForm] = useState({
    condicion_pago: '',
    vendedor_id: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  const email  = solicitud.contacto_compras_email?.trim().toLowerCase() ?? ''
  const nombre = solicitud.contacto_compras_nombre ?? solicitud.razon_social

  async function aprobar() {
    if (!email) {
      setError('La solicitud no tiene email de contacto de compras')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await crearAuthUser(email, PASS_DEFAULT)

      const { error: ep } = await supabaseAdmin.from('perfiles').upsert({
        id:     user.id,
        nombre: nombre,
        tipo:   'cliente',
      }, { onConflict: 'id' })
      if (ep) throw ep

      const esExterior = !!(solicitud.pais && solicitud.pais.trim().toLowerCase() !== 'argentina')
      const cuit = solicitud.cuit?.trim() || null
      const clienteData = {
        razon_social:   solicitud.razon_social,
        cuit,
        pais:           solicitud.pais || null,
        es_exterior:    esExterior,
        direccion:      solicitud.direccion,
        condicion_pago: form.condicion_pago || null,
        vendedor_id:    form.vendedor_id ? parseInt(form.vendedor_id) : null,
        estado:         'activo',
      }
      let cliente, ec
      if (cuit) {
        ;({ data: cliente, error: ec } = await supabaseAdmin
          .from('clientes')
          .upsert(clienteData, { onConflict: 'cuit' })
          .select('id')
          .single())
      } else {
        ;({ data: cliente, error: ec } = await supabaseAdmin
          .from('clientes')
          .insert(clienteData)
          .select('id')
          .single())
      }
      if (ec) throw ec

      await supabaseAdmin.from('clientes_usuarios').delete().eq('perfil_id', user.id)
      const { error: ecu } = await supabaseAdmin
        .from('clientes_usuarios')
        .insert({ cliente_id: cliente.id, perfil_id: user.id })
      if (ecu) throw ecu

      const contactos = []
      if (solicitud.contacto_compras_nombre) {
        contactos.push({
          cliente_id: cliente.id,
          nombre:   solicitud.contacto_compras_nombre,
          email:    solicitud.contacto_compras_email,
          telefono: solicitud.contacto_compras_tel,
          tipo:     'compras',
        })
      }
      if (solicitud.contacto_admin_nombre) {
        contactos.push({
          cliente_id: cliente.id,
          nombre:   solicitud.contacto_admin_nombre,
          email:    solicitud.contacto_admin_email,
          telefono: solicitud.contacto_admin_tel,
          tipo:     'administracion',
        })
      }
      if (contactos.length) {
        await supabaseAdmin.from('contactos').delete().eq('cliente_id', cliente.id)
        await supabaseAdmin.from('contactos').insert(contactos)
      }

      await supabaseAdmin
        .from('solicitudes_alta')
        .update({ estado: 'aprobado' })
        .eq('id', solicitud.id)

      onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Aprobar solicitud</h2>
            <p className="text-xs text-gray-400 mt-0.5">{solicitud.razon_social}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 space-y-0.5">
            <p className="text-xs text-gray-500">Acceso del cliente</p>
            <p className="text-sm font-medium text-gray-800">{email || <span className="text-red-500 italic">Sin email de contacto</span>}</p>
            <p className="text-xs text-gray-500 mt-1">Contraseña inicial: <span className="font-mono font-semibold text-[#004a99]">{PASS_DEFAULT}</span> — comunicársela al cliente.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Condición de pago</label>
            <select className={INPUT} value={form.condicion_pago} onChange={set('condicion_pago')}>
              <option value="">Sin definir</option>
              <option>Contado</option>
              <option>Pago anticipado</option>
              <option>Contra entrega</option>
              <option>15 días</option>
              <option>30 días</option>
              <option>60 días</option>
              <option>90 días</option>
              <option>120 días</option>
              <option>30/60 días</option>
              <option>30/60/90 días</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vendedor asignado</label>
            <select className={INPUT} value={form.vendedor_id} onChange={set('vendedor_id')}>
              <option value="">Sin asignar</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.id}>{v.perfiles?.nombre ?? `Vendedor ${v.id}`}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={aprobar} disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-[#28a745] text-white rounded-lg hover:bg-[#218838] disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Crear usuario y aprobar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmacionClientes() {
  const qc = useQueryClient()
  const { data: solicitudes = [], isLoading, error } = useSolicitudesAlta()
  const { data: vendedores  = [] }                   = useVendedores()

  const [tab, setTab]       = useState('pendientes')
  const [modalSol, setModalSol] = useState(null)

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const historial  = solicitudes.filter(s => s.estado !== 'pendiente')

  async function rechazar(id) {
    if (!confirm('¿Rechazar esta solicitud?')) return
    const { error } = await supabase
      .from('solicitudes_alta')
      .update({ estado: 'rechazado' })
      .eq('id', id)
    if (!error) qc.invalidateQueries({ queryKey: ['jefe', 'solicitudes_alta'] })
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Confirmación de clientes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Aprobación de solicitudes de alta de nuevos clientes</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          ['pendientes', `Pendientes${pendientes.length > 0 ? ` (${pendientes.length})` : ''}`],
          ['historial',  'Historial'],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === v ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
            {v === 'pendientes' && pendientes.length > 0 && (
              <span className="ml-1.5 w-5 h-5 inline-flex items-center justify-center bg-[#dc3545] text-white text-[10px] rounded-full font-bold">
                {pendientes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pendientes' && (
        <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
          {error
            ? <div className="p-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded m-4">{error.message}</div>
            : isLoading
            ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
            : pendientes.length === 0
            ? <div className="p-12 text-center text-sm text-gray-400">No hay solicitudes pendientes</div>
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Empresa</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">CUIT</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Contacto compras</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Fecha</th>
                    <th className="w-40 px-4 py-3"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendientes.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.razon_social}</p>
                        {s.pais && s.pais.toLowerCase() !== 'argentina' && (
                          <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">{s.pais}</span>
                        )}
                        {s.direccion && <p className="text-xs text-gray-400 mt-0.5">{s.direccion}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.cuit}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{s.contacto_compras_nombre}</p>
                        <p className="text-xs text-gray-400">{s.contacto_compras_email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(s.creado_en).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setModalSol(s)}
                            className="px-3 py-1.5 text-xs font-medium bg-[#28a745] text-white rounded-lg hover:bg-[#218838]">
                            Aprobar
                          </button>
                          <button onClick={() => rechazar(s.id)}
                            className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-[#dc3545]">
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {tab === 'historial' && (
        <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
          {historial.length === 0
            ? <div className="p-12 text-center text-sm text-gray-400">Sin historial</div>
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Empresa</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">CUIT</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historial.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{s.razon_social}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.cuit}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(s.creado_en).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3"><Badge estado={s.estado}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {modalSol && (
        <ModalAprobar
          solicitud={modalSol}
          vendedores={vendedores}
          onClose={() => setModalSol(null)}
          onDone={() => {
            setModalSol(null)
            qc.invalidateQueries({ queryKey: ['jefe', 'solicitudes_alta'] })
            qc.invalidateQueries({ queryKey: ['admin', 'clientes'] })
          }}
        />
      )}
    </div>
  )
}
