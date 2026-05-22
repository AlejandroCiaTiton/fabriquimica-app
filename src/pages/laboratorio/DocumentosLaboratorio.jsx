import { useState, useRef } from 'react'
import { useProductosDocumentos, useSubirDocumentoProducto } from '../../hooks/useLaboratorio'

const TIPOS = [
  { key: 'ficha_tecnica_url',  label: 'Ficha Técnica',        short: 'FT',  color: 'blue'   },
  { key: 'tds_url',            label: 'Technical Data Sheet', short: 'TDS', color: 'green'  },
  { key: 'hoja_seguridad_url', label: 'Hoja de Seguridad',    short: 'HS',  color: 'amber'  },
]

const COLOR = {
  blue:  { chip: 'bg-blue-100 text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700'   },
  green: { chip: 'bg-green-100 text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
  amber: { chip: 'bg-amber-100 text-amber-700', btn: 'bg-amber-500 hover:bg-amber-600' },
}

function DocChip({ tipo, url, onClick }) {
  const c = COLOR[tipo.color]
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.chip}`}
        title={tipo.label}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
        </svg>
        {tipo.short}
      </a>
    )
  }
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"
      title={`Subir ${tipo.label}`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
      </svg>
      {tipo.short}
    </button>
  )
}

function FormSubirDoc({ producto, tipo, onSubmit, onCancel }) {
  const [archivo, setArchivo] = useState(null)
  const [error, setError]     = useState('')
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef()
  const c = COLOR[tipo.color]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!archivo) { setError('Seleccioná un archivo PDF o Word'); return }
    setError('')
    setCargando(true)
    try {
      await onSubmit({ productoId: producto.id, tipo: tipo.key, archivo })
    } catch (err) {
      setError(err.message)
      setCargando(false)
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
      <p className="text-xs font-semibold text-gray-700 mb-3">
        Subir {tipo.label} — {producto.nombre}
        {producto.url && (
          <a href={producto.url} target="_blank" rel="noopener noreferrer"
            className="ml-2 text-[#1b4332] hover:underline font-normal">
            (ver actual)
          </a>
        )}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#1b4332] transition-colors"
        >
          {archivo
            ? <p className="text-sm text-gray-700 font-medium">{archivo.name}</p>
            : <p className="text-sm text-gray-400">Click para seleccionar PDF o Word</p>
          }
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={e => setArchivo(e.target.files[0] || null)} />
        </div>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
            Cancelar
          </button>
          <button type="submit" disabled={cargando}
            className={`${c.btn} text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2`}>
            {cargando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            {cargando ? 'Subiendo…' : `Guardar ${tipo.short}`}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function DocumentosLaboratorio() {
  const { data: productos = [], isLoading } = useProductosDocumentos()
  const subirDoc = useSubirDocumentoProducto()

  const [formAbierto, setFormAbierto] = useState(null) // { productoId, tipoKey }
  const [buscar, setBuscar] = useState('')

  const filtrados = buscar.trim()
    ? productos.filter(p =>
        p.nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(buscar.toLowerCase())
      )
    : productos

  const incompletos = filtrados.filter(p => TIPOS.some(t => !p[t.key]))
  const completos   = filtrados.filter(p => TIPOS.every(t =>  p[t.key]))

  async function handleSubir(datos) {
    await subirDoc.mutateAsync(datos)
    setFormAbierto(null)
  }

  function toggleForm(productoId, tipoKey) {
    const key = `${productoId}-${tipoKey}`
    setFormAbierto(formAbierto === key ? null : key)
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Documentos de Producto</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Ficha Técnica · Technical Data Sheet · Hoja de Seguridad
        </p>
      </div>

      {/* Buscador */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {incompletos.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {incompletos.length} productos con documentos pendientes
            </span>
          )}
        </div>
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar producto…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1b4332] w-56"
        />
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <>
          {/* Pendientes */}
          {incompletos.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Documentos pendientes</h2>
              <div className="bg-white rounded-[10px] shadow-card divide-y divide-gray-50">
                {incompletos.map(producto => (
                  <div key={producto.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{producto.nombre}</span>
                          {producto.codigo && (
                            <span className="text-xs text-gray-400 font-mono">{producto.codigo}</span>
                          )}
                        </div>
                        {producto.presentacion && (
                          <p className="text-xs text-gray-400 mt-0.5">{producto.presentacion}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {TIPOS.map(tipo => (
                          <DocChip
                            key={tipo.key}
                            tipo={tipo}
                            url={producto[tipo.key]}
                            onClick={() => toggleForm(producto.id, tipo.key)}
                          />
                        ))}
                      </div>
                    </div>
                    {TIPOS.map(tipo => {
                      const key = `${producto.id}-${tipo.key}`
                      if (formAbierto !== key) return null
                      return (
                        <FormSubirDoc
                          key={tipo.key}
                          producto={{ ...producto, url: producto[tipo.key] }}
                          tipo={tipo}
                          onSubmit={handleSubir}
                          onCancel={() => setFormAbierto(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Completos */}
          {completos.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Documentos completos</h2>
              <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">FT</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">TDS</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">HS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {completos.map(producto => (
                      <tr key={producto.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{producto.nombre}</p>
                          {producto.codigo && <p className="text-xs text-gray-400 font-mono">{producto.codigo}</p>}
                        </td>
                        {TIPOS.map(tipo => (
                          <td key={tipo.key} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <a href={producto[tipo.key]} target="_blank" rel="noopener noreferrer"
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLOR[tipo.color].chip} hover:opacity-80`}>
                                {tipo.short}
                              </a>
                              <button
                                onClick={() => toggleForm(producto.id, tipo.key)}
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                                title={`Reemplazar ${tipo.label}`}>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                                </svg>
                              </button>
                            </div>
                            {formAbierto === `${producto.id}-${tipo.key}` && (
                              <div className="text-left mt-2">
                                <FormSubirDoc
                                  producto={{ ...producto, url: producto[tipo.key] }}
                                  tipo={tipo}
                                  onSubmit={handleSubir}
                                  onCancel={() => setFormAbierto(null)}
                                />
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {filtrados.length === 0 && (
            <div className="bg-white rounded-[10px] shadow-card py-10 text-center text-sm text-gray-400">
              {buscar ? 'No se encontraron productos.' : 'No hay productos activos.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
