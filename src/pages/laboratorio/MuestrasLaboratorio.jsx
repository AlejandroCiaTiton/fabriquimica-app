import { useState, useMemo } from 'react'
import { useMuestras, useCrearMuestra, useActualizarMuestra } from '../../hooks/useLaboratorio'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const RESULTADO_BADGE = {
  pendiente:     'bg-yellow-100 text-yellow-700',
  aprobado:      'bg-green-100 text-green-700',
  rechazado:     'bg-red-100 text-red-700',
  'sin-respuesta':'bg-gray-100 text-gray-500',
}

function useClientesSimple() {
  return useQuery({
    queryKey: ['clientes', 'simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, razon_social').order('razon_social')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

function useProductosSimple() {
  return useQuery({
    queryKey: ['productos', 'simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('productos').select('id, nombre, codigo').eq('activo', true).order('nombre')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

function ModalActualizar({ muestra, onClose, onSave }) {
  const [resultado,  setResultado]  = useState(muestra.resultado || 'pendiente')
  const [devolucion, setDevolucion] = useState(muestra.devolucion || '')

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave({ id: muestra.id, resultado, devolucion })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Actualizar resultado</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{muestra.clientes?.razon_social}</strong> — {muestra.producto_nombre || muestra.productos?.nombre}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resultado</label>
            <select
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
            >
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
              <option value="sin-respuesta">Sin respuesta</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Devolución / Comentario del cliente</label>
            <textarea
              value={devolucion}
              onChange={e => setDevolucion(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332] resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              Cancelar
            </button>
            <button type="submit" className="bg-[#1b4332] hover:bg-[#152e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const FORM_VACIO = { clienteId: '', productoId: '', productoNombre: '', fechaEnvio: '', cantidadG: '', numeroLote: '', notas: '' }

export default function MuestrasLaboratorio() {
  const { data: muestras = [], isLoading } = useMuestras()
  const { data: clientes = [] }            = useClientesSimple()
  const { data: productos = [] }           = useProductosSimple()
  const crearMuestra     = useCrearMuestra()
  const actualizarMuestra = useActualizarMuestra()

  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(FORM_VACIO)
  const [formError, setFormError]       = useState('')
  const [modalActualizar, setModalActualizar] = useState(null)

  const filtradas = useMemo(() => {
    if (filtroEstado === 'todos') return muestras
    return muestras.filter(m => m.resultado === filtroEstado)
  }, [muestras, filtroEstado])

  async function handleCrear(e) {
    e.preventDefault()
    if (!form.fechaEnvio) { setFormError('La fecha de envío es requerida'); return }
    if (!form.clienteId)  { setFormError('El cliente es requerido'); return }
    setFormError('')
    try {
      await crearMuestra.mutateAsync({
        clienteId:      form.clienteId,
        productoId:     form.productoId || null,
        productoNombre: form.productoNombre || productos.find(p => p.id === parseInt(form.productoId))?.nombre || null,
        fechaEnvio:     form.fechaEnvio,
        cantidadG:      form.cantidadG,
        numeroLote:     form.numeroLote,
        notas:          form.notas,
      })
      setForm(FORM_VACIO)
      setShowForm(false)
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function handleActualizar({ id, resultado, devolucion }) {
    try {
      await actualizarMuestra.mutateAsync({ id, resultado, devolucion })
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Muestras</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registro de muestras enviadas a clientes</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 bg-[#1b4332] hover:bg-[#152e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Nueva muestra
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-[10px] shadow-card p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Registrar nueva muestra</h2>
          <form onSubmit={handleCrear} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cliente <span className="text-red-500">*</span>
              </label>
              <select
                value={form.clienteId}
                onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              >
                <option value="">Seleccionar...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Producto</label>
              <select
                value={form.productoId}
                onChange={e => setForm(f => ({ ...f, productoId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              >
                <option value="">Seleccionar...</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha de envío <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.fechaEnvio}
                onChange={e => setForm(f => ({ ...f, fechaEnvio: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad (g)</label>
              <input
                type="number"
                value={form.cantidadG}
                onChange={e => setForm(f => ({ ...f, cantidadG: e.target.value }))}
                placeholder="Ej: 500"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número de lote</label>
              <input
                value={form.numeroLote}
                onChange={e => setForm(f => ({ ...f, numeroLote: e.target.value }))}
                placeholder="Ej: L-2024-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
              <input
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Opcional..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            {formError && (
              <p className="col-span-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{formError}</p>
            )}
            <div className="col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={crearMuestra.isPending}
                className="bg-[#1b4332] hover:bg-[#152e24] disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {crearMuestra.isPending && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Registrar muestra
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4">
        {['todos', 'pendiente', 'aprobado', 'rechazado', 'sin-respuesta'].map(estado => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtroEstado === estado
                ? 'bg-[#1b4332] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
            }`}
          >
            {estado === 'todos' ? 'Todos' : estado.charAt(0).toUpperCase() + estado.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {muestras.length === 0 ? 'No hay muestras registradas aún.' : 'Sin resultados para ese filtro.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cantidad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Lote</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Resultado</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.clientes?.razon_social || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{m.producto_nombre || m.productos?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{m.fecha_envio}</td>
                  <td className="px-4 py-3 text-gray-500">{m.cantidad_g != null ? `${m.cantidad_g} g` : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.numero_lote || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${RESULTADO_BADGE[m.resultado] ?? 'bg-gray-100 text-gray-500'}`}>
                      {m.resultado || 'pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(m.resultado === 'pendiente' || m.resultado === null) && (
                      <button
                        onClick={() => setModalActualizar(m)}
                        className="text-xs text-[#1b4332] hover:underline font-medium"
                      >
                        Actualizar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalActualizar && (
        <ModalActualizar
          muestra={modalActualizar}
          onClose={() => setModalActualizar(null)}
          onSave={handleActualizar}
        />
      )}
    </div>
  )
}
