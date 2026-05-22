import { useState, useRef } from 'react'
import { useLotesSinCoa, useLotesConCoa, useSubirCoaLote, useCoaVersiones } from '../../hooks/useLaboratorio'
import { fmtFecha } from '../../utils/calc'

function fmtFechaHora(str) {
  if (!str) return '—'
  return new Date(str).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtKg(n) {
  if (!n) return '—'
  return parseFloat(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' kg'
}

function FormSubirCoa({ lote, esRevalidacion, onSubmit, onCancel }) {
  const [archivo, setArchivo] = useState(null)
  const [error, setError]     = useState('')
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!archivo) { setError('Seleccioná un archivo PDF'); return }
    setError('')
    setCargando(true)
    try {
      await onSubmit({ loteId: lote.id, archivo })
    } catch (err) {
      setError(err.message)
      setCargando(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
      <p className="text-xs font-semibold text-blue-800 mb-3">
        {esRevalidacion ? 'Revalidar COA' : 'Subir COA'} — {lote.nombre}
        {lote.numero_lote ? ` · Lote ${lote.numero_lote}` : ''}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-blue-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#1b4332] transition-colors"
        >
          {archivo
            ? <p className="text-sm text-gray-700 font-medium">{archivo.name}</p>
            : <p className="text-sm text-gray-400">Click para seleccionar un archivo PDF o Word</p>
          }
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={e => setArchivo(e.target.files[0] || null)} />
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
            Cancelar
          </button>
          <button type="submit" disabled={cargando}
            className="bg-[#1b4332] hover:bg-[#152e24] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
            {cargando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            {cargando ? 'Subiendo…' : esRevalidacion ? 'Guardar Revalidación' : 'Guardar COA'}
          </button>
        </div>
      </form>
    </div>
  )
}

function HistorialCoa({ loteId, urlActual }) {
  const { data: versiones = [], isLoading } = useCoaVersiones(loteId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <div className="w-4 h-4 border-2 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }

  if (versiones.length === 0) {
    return <p className="text-xs text-gray-400 py-2 px-1">No hay versiones registradas (las revalidaciones futuras aparecerán aquí).</p>
  }

  return (
    <div className="space-y-1 py-1">
      {versiones.map((v, i) => (
        <div key={v.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-gray-100">
          <div className="flex items-center gap-2">
            {i === 0
              ? <span className="text-[10px] font-semibold bg-[#1b4332] text-white px-1.5 py-0.5 rounded-full">Actual</span>
              : <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">v{versiones.length - i}</span>
            }
            <span className="text-xs text-gray-500">{fmtFechaHora(v.creado_en)}</span>
          </div>
          <a href={v.url} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-[#1b4332] hover:underline flex-shrink-0">
            Descargar
          </a>
        </div>
      ))}
    </div>
  )
}

export default function CoasLaboratorio() {
  const { data: sinCoa = [], isLoading: loadingSin } = useLotesSinCoa()
  const { data: conCoa = [], isLoading: loadingCon } = useLotesConCoa()
  const subirCoa = useSubirCoaLote()

  // formAbierto: lote.id (subir) | `rev-${lote.id}` (revalidar) | `hist-${lote.id}` (historial)
  const [formAbierto, setFormAbierto] = useState(null)
  const [buscar, setBuscar] = useState('')

  const sinCoaFiltrados = buscar.trim()
    ? sinCoa.filter(l =>
        l.nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
        l.codigo?.toLowerCase().includes(buscar.toLowerCase()) ||
        l.numero_lote?.toLowerCase().includes(buscar.toLowerCase())
      )
    : sinCoa

  async function handleSubir(datos) {
    await subirCoa.mutateAsync(datos)
    setFormAbierto(null)
  }

  function toggle(key) {
    setFormAbierto(prev => prev === key ? null : key)
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Certificados de Análisis (COA)</h1>
        <p className="text-sm text-gray-400 mt-0.5">Cargá el COA para cada lote fabricado</p>
      </div>

      {/* Lotes sin COA */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">
            Lotes sin COA
            {sinCoa.length > 0 && (
              <span className="ml-2 text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {sinCoa.length}
              </span>
            )}
          </h2>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar producto o lote…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1b4332] w-52"
          />
        </div>

        {loadingSin ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : sinCoaFiltrados.length === 0 ? (
          <div className="bg-white rounded-[10px] shadow-card py-10 text-center text-sm text-gray-400">
            {buscar ? 'No se encontraron lotes.' : 'Todos los lotes tienen COA cargado.'}
          </div>
        ) : (
          <div className="bg-white rounded-[10px] shadow-card divide-y divide-gray-50">
            {sinCoaFiltrados.map(lote => (
              <div key={lote.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{lote.nombre}</span>
                      {lote.codigo && <span className="text-xs text-gray-400 font-mono">{lote.codigo}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      {lote.numero_lote && <span>Lote: <span className="font-medium text-gray-600">{lote.numero_lote}</span></span>}
                      <span>Fecha: {fmtFecha(lote.fecha_produccion)}</span>
                      <span>{fmtKg(lote.cantidad)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(lote.id)}
                    className="bg-[#1b4332] hover:bg-[#152e24] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    Subir COA
                  </button>
                </div>
                {formAbierto === lote.id && (
                  <FormSubirCoa
                    lote={lote}
                    esRevalidacion={false}
                    onSubmit={handleSubir}
                    onCancel={() => setFormAbierto(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* COAs cargados */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">COAs cargados</h2>
        {loadingCon ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : conCoa.length === 0 ? (
          <div className="bg-white rounded-[10px] shadow-card py-10 text-center text-sm text-gray-400">
            No hay COAs cargados aún.
          </div>
        ) : (
          <div className="bg-white rounded-[10px] shadow-card divide-y divide-gray-50">
            {conCoa.map(lote => (
              <div key={lote.id} className="px-4 py-3">
                {/* Fila principal */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0 grid grid-cols-4 gap-2 items-center">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{lote.nombre}</p>
                      {lote.codigo && <p className="text-xs text-gray-400 font-mono">{lote.codigo}</p>}
                    </div>
                    <p className="text-sm text-gray-600">{lote.numero_lote || '—'}</p>
                    <p className="text-xs text-gray-400">{fmtFecha(lote.fecha_produccion)}</p>
                    <p className="text-sm text-gray-600 text-right">{fmtKg(lote.cantidad)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={lote.coa_url} target="_blank" rel="noopener noreferrer"
                      className="text-[#1b4332] hover:underline text-xs font-medium">
                      Ver COA
                    </a>
                    <span className="text-gray-200">|</span>
                    <button
                      onClick={() => toggle(`rev-${lote.id}`)}
                      className={`text-xs font-medium transition-colors ${
                        formAbierto === `rev-${lote.id}`
                          ? 'text-gray-400'
                          : 'text-gray-500 hover:text-[#1b4332]'
                      }`}
                    >
                      Revalidar
                    </button>
                    <span className="text-gray-200">|</span>
                    <button
                      onClick={() => toggle(`hist-${lote.id}`)}
                      className={`text-xs font-medium transition-colors ${
                        formAbierto === `hist-${lote.id}`
                          ? 'text-[#1b4332]'
                          : 'text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      Historial
                    </button>
                  </div>
                </div>

                {/* Form revalidación */}
                {formAbierto === `rev-${lote.id}` && (
                  <FormSubirCoa
                    lote={lote}
                    esRevalidacion={true}
                    onSubmit={handleSubir}
                    onCancel={() => setFormAbierto(null)}
                  />
                )}

                {/* Historial de versiones */}
                {formAbierto === `hist-${lote.id}` && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Historial de versiones
                    </p>
                    <HistorialCoa loteId={lote.id} urlActual={lote.coa_url} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
