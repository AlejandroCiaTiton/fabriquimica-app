import { useState } from 'react'
import { useZonas, useCrearZona, useEliminarZona } from '../../hooks/useLogistica'

const COLORES_PRESET = [
  '#004a99', '#28a745', '#dc3545', '#fd7e14', '#6f42c1',
  '#20c997', '#e83e8c', '#17a2b8', '#ffc107', '#6c757d',
]

export default function ZonasEntrega() {
  const { data: zonas = [], isLoading } = useZonas()
  const crear    = useCrearZona()
  const eliminar = useEliminarZona()

  const [nombre, setNombre] = useState('')
  const [color,  setColor]  = useState(COLORES_PRESET[0])
  const [err,    setErr]    = useState('')

  async function handleCrear(e) {
    e.preventDefault()
    if (!nombre.trim()) { setErr('El nombre es obligatorio'); return }
    setErr('')
    try {
      await crear.mutateAsync({ nombre: nombre.trim(), color })
      setNombre('')
    } catch (e) {
      setErr(e.message)
    }
  }

  async function handleEliminar(zona) {
    if (!confirm(`¿Eliminar la zona "${zona.nombre}"? Los clientes asignados quedarán sin zona.`)) return
    await eliminar.mutateAsync(zona.id)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Zonas de entrega</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Definí las zonas y asignálas a los clientes desde Maestro de Clientes.
        </p>
      </div>

      {/* Crear zona */}
      <div className="bg-white rounded-[10px] shadow-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Nueva zona</h2>
        <form onSubmit={handleCrear} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Zona Norte, Capital, GBA Sur…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORES_PRESET.map(c => (
                <button key={c} type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border border-gray-200"
                title="Color personalizado"
              />
            </div>
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{err}</p>}

          <button type="submit" disabled={crear.isPending}
            className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
            {crear.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Crear zona
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading && (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        )}
        {!isLoading && zonas.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">Sin zonas definidas</div>
        )}
        {!isLoading && zonas.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Zona</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Color</th>
                <th className="w-16 px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {zonas.map(z => (
                <tr key={z.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{z.nombre}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="w-6 h-6 rounded-full mx-auto border border-gray-200"
                      style={{ backgroundColor: z.color }}/>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEliminar(z)}
                      className="text-gray-300 hover:text-[#dc3545] transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
  )
}
