import { useState } from 'react'
import { useCoas, useTrabajosSinCoa, useSubirCoa } from '../../hooks/useLaboratorio'

function FormSubirCoa({ trabajo, onSubmit, onCancel }) {
  const [url, setUrl]     = useState('')
  const [lote, setLote]   = useState(trabajo.numero_lote || '')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) { setError('La URL del archivo es requerida'); return }
    setError('')
    await onSubmit({ trabajoId: trabajo.id, archivoUrl: url.trim(), numeroLote: lote.trim() || null })
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
      <p className="text-xs font-medium text-blue-800 mb-3">
        Subir COA — {trabajo.codigo} · {trabajo.nombre}
      </p>
      {/* TODO: implementar upload a Supabase Storage bucket 'coas' en lugar de URL manual */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            URL del archivo <span className="text-red-500">*</span>
          </label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Número de lote</label>
          <input
            value={lote}
            onChange={e => setLote(e.target.value)}
            placeholder="Ej: L-2024-001"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
            Cancelar
          </button>
          <button type="submit" className="bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            Guardar COA
          </button>
        </div>
      </form>
    </div>
  )
}

export default function CoasLaboratorio() {
  const { data: coas = [],     isLoading: loadingCoas }     = useCoas()
  const { data: sinCoa = [],   isLoading: loadingSinCoa }   = useTrabajosSinCoa()
  const subirCoa = useSubirCoa()

  const [formAbierto, setFormAbierto] = useState(null) // trabajo.id

  async function handleSubir(datos) {
    try {
      await subirCoa.mutateAsync(datos)
      setFormAbierto(null)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Certificados de Análisis (COA)</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestión de COAs por lote de producción</p>
      </div>

      {/* Trabajos sin COA */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Trabajos completados sin COA</h2>
        {loadingSinCoa ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : sinCoa.length === 0 ? (
          <div className="bg-white rounded-[10px] shadow-card py-10 text-center text-sm text-gray-400">
            Todos los trabajos completados tienen COA cargado.
          </div>
        ) : (
          <div className="bg-white rounded-[10px] shadow-card divide-y divide-gray-50">
            {sinCoa.map(trabajo => (
              <div key={trabajo.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="font-medium text-gray-900">{trabajo.codigo}</span>
                    <span className="ml-2 text-sm text-gray-600">{trabajo.nombre}</span>
                    {trabajo.numero_lote && (
                      <span className="ml-2 text-xs text-gray-400">Lote: {trabajo.numero_lote}</span>
                    )}
                    {trabajo.fecha_fin && (
                      <span className="ml-2 text-xs text-gray-400">Fin: {trabajo.fecha_fin}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setFormAbierto(formAbierto === trabajo.id ? null : trabajo.id)}
                    className="bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    Subir COA
                  </button>
                </div>
                {formAbierto === trabajo.id && (
                  <FormSubirCoa
                    trabajo={trabajo}
                    onSubmit={handleSubir}
                    onCancel={() => setFormAbierto(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* COAs existentes */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">COAs cargados</h2>
        {loadingCoas ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : coas.length === 0 ? (
          <div className="bg-white rounded-[10px] shadow-card py-10 text-center text-sm text-gray-400">
            No hay COAs cargados aún.
          </div>
        ) : (
          <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Lote</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cargado</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coas.map(coa => (
                  <tr key={coa.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{coa.trabajos_produccion?.codigo || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{coa.trabajos_produccion?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{coa.numero_lote || coa.trabajos_produccion?.numero_lote || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(coa.creado_en).toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-3">
                      <a
                        href={coa.archivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#004a99] hover:underline text-xs font-medium"
                      >
                        Ver PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
