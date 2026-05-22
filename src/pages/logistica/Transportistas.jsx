import { useState } from 'react'
import { useTransportistas, useCrearTransportista, useEliminarTransportista } from '../../hooks/useLogistica'

const FORM_VACIO = { nombre: '', apellido: '', empresa: '', vehiculo: '' }

export default function Transportistas() {
  const { data: transportistas = [], isLoading } = useTransportistas()
  const crear    = useCrearTransportista()
  const eliminar = useEliminarTransportista()

  const [form, setForm]   = useState(FORM_VACIO)
  const [error, setError] = useState('')
  const [ok, setOk]       = useState('')

  async function handleAgregar(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError('Nombre y apellido son obligatorios')
      return
    }
    setError('')
    setOk('')
    try {
      await crear.mutateAsync(form)
      setForm(FORM_VACIO)
      setOk('Transportista agregado.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleEliminar(id, nombre) {
    if (!confirm(`¿Dar de baja a ${nombre}?`)) return
    try {
      await eliminar.mutateAsync(id)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Transportistas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestión de transportistas activos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-[10px] shadow-card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Agregar transportista</h2>
          <form onSubmit={handleAgregar} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Juan"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Apellido <span className="text-red-500">*</span>
              </label>
              <input
                value={form.apellido}
                onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                placeholder="Ej: García"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Empresa</label>
              <input
                value={form.empresa}
                onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                placeholder="Ej: Transportes SA (opcional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehículo</label>
              <input
                value={form.vehiculo}
                onChange={e => setForm(f => ({ ...f, vehiculo: e.target.value }))}
                placeholder="Ej: Ford Transit ABC123 (opcional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
            )}
            {ok && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">{ok}</p>
            )}
            <button
              type="submit"
              disabled={crear.isPending}
              className="w-full bg-[#1b4332] hover:bg-[#152e24] disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {crear.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              Agregar
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[10px] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{transportistas.length} transportistas activos</span>
          </div>
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : transportistas.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Sin transportistas. Agregá uno con el formulario.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Empresa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehículo</th>
                  <th className="w-10"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transportistas.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{t.nombre} {t.apellido}</td>
                    <td className="px-4 py-2.5 text-gray-500">{t.empresa || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{t.vehiculo || '—'}</td>
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => handleEliminar(t.id, `${t.nombre} ${t.apellido}`)}
                        className="p-1 text-gray-300 hover:text-[#dc3545] rounded transition-colors"
                        title="Dar de baja"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
