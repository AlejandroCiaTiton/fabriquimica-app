import { useState } from 'react'
import { useDesarrollos, useCrearDesarrollo, useActualizarDesarrollo } from '../../hooks/useLaboratorio'

const ESTADO_BADGE = {
  'en-curso':  'bg-blue-100 text-blue-700',
  exitoso:     'bg-green-100 text-green-700',
  descartado:  'bg-red-100 text-red-700',
  pausado:     'bg-yellow-100 text-yellow-700',
}

const ESTADO_LABEL = {
  'en-curso': 'En curso',
  exitoso:    'Exitoso',
  descartado: 'Descartado',
  pausado:    'Pausado',
}

function generarCodigo() {
  const año = new Date().getFullYear()
  const num = String(Math.floor(Math.random() * 9000) + 1000)
  return `DEV-${año}-${num}`
}

function ModalCrear({ onClose, onSave }) {
  const [form, setForm] = useState({
    codigo:              generarCodigo(),
    nombre:              '',
    descripcion:         '',
    productosUtilizados: [''],
    resultadoEsperado:   '',
    fechaInicio:         '',
  })
  const [error, setError] = useState('')

  function agregarProducto() {
    setForm(f => ({ ...f, productosUtilizados: [...f.productosUtilizados, ''] }))
  }

  function actualizarProducto(idx, val) {
    setForm(f => {
      const lista = [...f.productosUtilizados]
      lista[idx] = val
      return { ...f, productosUtilizados: lista }
    })
  }

  function quitarProducto(idx) {
    setForm(f => ({ ...f, productosUtilizados: f.productosUtilizados.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setError('')
    try {
      await onSave({
        codigo:              form.codigo.trim() || null,
        nombre:              form.nombre.trim(),
        descripcion:         form.descripcion.trim() || null,
        productosUtilizados: form.productosUtilizados.filter(p => p.trim()),
        resultadoEsperado:   form.resultadoEsperado.trim() || null,
        fechaInicio:         form.fechaInicio || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Nuevo desarrollo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form id="form-desarrollo" onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Código</label>
              <input
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Desarrollo neutralizante pH 5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Productos utilizados</label>
              <button type="button" onClick={agregarProducto} className="text-xs text-[#004a99] hover:underline">
                + Agregar
              </button>
            </div>
            <div className="space-y-2">
              {form.productosUtilizados.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={p}
                    onChange={e => actualizarProducto(idx, e.target.value)}
                    placeholder={`Producto ${idx + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
                  />
                  {form.productosUtilizados.length > 1 && (
                    <button type="button" onClick={() => quitarProducto(idx)} className="text-gray-300 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resultado esperado</label>
            <textarea
              value={form.resultadoEsperado}
              onChange={e => setForm(f => ({ ...f, resultadoEsperado: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
          )}
        </form>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-desarrollo"
            className="bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Crear desarrollo
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEditar({ desarrollo, onClose, onSave }) {
  const [resultadoObtenido, setResultadoObtenido] = useState(desarrollo.resultado_obtenido || '')
  const [estado, setEstado]                       = useState(desarrollo.estado || 'en-curso')
  const [fechaFin, setFechaFin]                   = useState(desarrollo.fecha_fin || '')
  const [error, setError]                         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await onSave({ id: desarrollo.id, resultadoObtenido, estado, fechaFin })
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Editar desarrollo</h2>
            <p className="text-xs text-gray-400 mt-0.5">{desarrollo.codigo} — {desarrollo.nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select
              value={estado}
              onChange={e => setEstado(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            >
              <option value="en-curso">En curso</option>
              <option value="exitoso">Exitoso</option>
              <option value="descartado">Descartado</option>
              <option value="pausado">Pausado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={e => setFechaFin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resultado obtenido</label>
            <textarea
              value={resultadoObtenido}
              onChange={e => setResultadoObtenido(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
              placeholder="Describí el resultado obtenido..."
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DesarrollosLaboratorio() {
  const { data: desarrollos = [], isLoading } = useDesarrollos()
  const crearDesarrollo    = useCrearDesarrollo()
  const actualizarDesarrollo = useActualizarDesarrollo()

  const [showCrear, setShowCrear]   = useState(false)
  const [modalEditar, setModalEditar] = useState(null)

  async function handleCrear(datos) {
    await crearDesarrollo.mutateAsync(datos)
  }

  async function handleActualizar(datos) {
    await actualizarDesarrollo.mutateAsync(datos)
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Desarrollos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Seguimiento de desarrollos de laboratorio</p>
        </div>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo desarrollo
        </button>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : desarrollos.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            No hay desarrollos registrados. Creá uno con el botón de arriba.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Código</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha inicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha fin</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {desarrollos.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{d.codigo || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{d.nombre}</div>
                    {d.descripcion && (
                      <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.descripcion}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ESTADO_BADGE[d.estado] ?? 'bg-gray-100 text-gray-500'}`}>
                      {ESTADO_LABEL[d.estado] ?? d.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{d.fecha_inicio || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{d.fecha_fin || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setModalEditar(d)}
                      className="text-xs text-[#004a99] hover:underline font-medium"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCrear && (
        <ModalCrear
          onClose={() => setShowCrear(false)}
          onSave={handleCrear}
        />
      )}
      {modalEditar && (
        <ModalEditar
          desarrollo={modalEditar}
          onClose={() => setModalEditar(null)}
          onSave={handleActualizar}
        />
      )}
    </div>
  )
}
