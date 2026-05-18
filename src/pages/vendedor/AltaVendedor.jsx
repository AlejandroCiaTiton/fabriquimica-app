import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin, crearAuthUser } from '../../lib/supabaseAdmin'
import { useAuth } from '../../context/AuthContext'

function useVendedores() {
  return useQuery({
    queryKey: ['vendedores', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, rol, perfiles(nombre)')
        .order('id')
      if (error) throw error
      return data ?? []
    },
    staleTime: 0,
  })
}

const ROL_LABEL = { vendedor: 'Vendedor', jefe: 'Jefe de ventas' }
const ROL_COLOR = { vendedor: 'bg-blue-50 text-blue-700', jefe: 'bg-purple-50 text-purple-700' }

export default function AltaVendedor() {
  const { isJefeVentas } = useAuth()
  const qc = useQueryClient()
  const { data: vendedores = [], isLoading } = useVendedores()

  const [form, setForm]     = useState({ nombre: '', email: '', pass: '', rol: 'vendedor' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [ok, setOk]         = useState('')

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.email.trim() || !form.pass || form.pass.length < 6) {
      setError('Nombre, email y contraseña (mín. 6 caracteres) son obligatorios')
      return
    }
    setLoading(true)
    setError('')
    setOk('')
    try {
      // 1. Crear auth user
      const user = await crearAuthUser(form.email, form.pass)

      // 2. Crear/actualizar perfil (puede existir por trigger)
      const { error: ep } = await supabaseAdmin.from('perfiles').upsert({
        id:     user.id,
        nombre: form.nombre.trim(),
        tipo:   'vendedor',
      }, { onConflict: 'id' })
      if (ep) throw ep

      // 3. Crear vendedor
      const { error: ev } = await supabaseAdmin.from('vendedores').insert({
        perfil_id: user.id,
        rol: form.rol,
      })
      if (ev) throw ev

      setOk(`Vendedor "${form.nombre}" creado correctamente. Email: ${form.email}`)
      setForm({ nombre: '', email: '', pass: '', rol: 'vendedor' })
      qc.invalidateQueries({ queryKey: ['vendedores'] })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isJefeVentas) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 text-sm">Esta sección es solo para el jefe de ventas.</p>
      </div>
    )
  }

  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]'

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Alta de vendedor</h1>
        <p className="text-sm text-gray-400 mt-0.5">Creá una nueva cuenta para un integrante del equipo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Formulario */}
        <div className="bg-white rounded-[10px] shadow-card p-6">
          <h2 className="font-semibold text-gray-800 mb-5">Nuevo vendedor</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input className={INPUT} value={form.nombre} onChange={set('nombre')}
                placeholder="Ej: Juan Pérez" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input className={INPUT} type="email" value={form.email} onChange={set('email')}
                placeholder="vendedor@fabriquimica.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña inicial <span className="text-red-500">*</span>
              </label>
              <input className={INPUT} type="password" value={form.pass} onChange={set('pass')}
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select className={INPUT} value={form.rol} onChange={set('rol')}>
                <option value="vendedor">Vendedor</option>
                <option value="jefe">Jefe de ventas</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            {ok && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{ok}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              Crear vendedor
            </button>
          </form>
        </div>

        {/* Lista actual */}
        <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Equipo actual</h2>
          </div>
          {isLoading
            ? <div className="p-8 flex justify-center"><div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
            : vendedores.length === 0
            ? <div className="p-8 text-center text-sm text-gray-400">Sin vendedores</div>
            : (
              <ul className="divide-y divide-gray-50">
                {vendedores.map(v => (
                  <li key={v.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#004a99]/10 flex items-center justify-center text-[#004a99] font-bold text-sm">
                        {(v.perfiles?.nombre ?? '?')[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800">
                        {v.perfiles?.nombre ?? `Vendedor ${v.id}`}
                      </span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROL_COLOR[v.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROL_LABEL[v.rol] ?? v.rol}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </div>
      </div>
    </div>
  )
}
