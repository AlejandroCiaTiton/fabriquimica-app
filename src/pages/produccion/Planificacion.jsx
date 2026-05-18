import { useState, useMemo } from 'react'
import { useProductos } from '../../hooks/useProductos'
import { useTrabajos, useCrearTrabajo, useEliminarTrabajo } from '../../hooks/useProduccion'
import { esProduccionPropia } from '../../data/produccionPropia'

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]'
const HOY   = new Date().toISOString().split('T')[0]

function semanaDesd(base) {
  const lunes = new Date(base)
  lunes.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  lunes.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d
  })
}
function isoDate(d)  { return d.toISOString().split('T')[0] }
function fmtDia(d)   { return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }) }
function fmtCorto(d) { return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) }

const EMPTY = { productoId: '', cantidad: '', fechaInicio: HOY, fechaFin: '', notas: '' }

export default function Planificacion() {
  const { data: todosProductos = [] } = useProductos()
  const { data: trabajos = [] }       = useTrabajos()
  const crear    = useCrearTrabajo()
  const eliminar = useEliminarTrabajo()

  const productos = useMemo(
    () => todosProductos.filter(p => esProduccionPropia(p.nombre)),
    [todosProductos]
  )

  const [base, setBase] = useState(() => new Date())
  const [form, setForm] = useState(EMPTY)
  const [err,  setErr]  = useState('')
  const [ok,   setOk]   = useState('')
  const dias = semanaDesd(base)

  function prev() { const d = new Date(base); d.setDate(d.getDate() - 7); setBase(d) }
  function next() { const d = new Date(base); d.setDate(d.getDate() + 7); setBase(d) }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const prodSel = productos.find(p => String(p.id) === String(form.productoId))

  // Trabajos de la semana visible (pendientes/en-curso)
  const semanaKeys = new Set(dias.map(isoDate))
  const trabajosSemana = trabajos.filter(
    t => t.estado !== 'completado' && t.fecha_inicio && semanaKeys.has(t.fecha_inicio)
  )
  const porFecha = {}
  trabajosSemana.forEach(t => {
    if (!porFecha[t.fecha_inicio]) porFecha[t.fecha_inicio] = []
    porFecha[t.fecha_inicio].push(t)
  })

  // Sin fecha
  const sinFecha = trabajos.filter(t => t.estado !== 'completado' && !t.fecha_inicio)

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(''); setOk('')
    if (!form.productoId) { setErr('Seleccioná un producto'); return }
    if (!form.cantidad || parseFloat(form.cantidad) <= 0) { setErr('La cantidad debe ser mayor a 0'); return }
    if (!form.fechaInicio) { setErr('La fecha es obligatoria'); return }
    try {
      await crear.mutateAsync({
        productoId:          form.productoId,
        codigo:              prodSel?.codigo ?? '',
        nombre:              prodSel?.nombre ?? '',
        cantidadPlanificada: form.cantidad,
        fechaInicio:         form.fechaInicio,
        fechaFin:            form.fechaFin,
        notas:               form.notas,
      })
      setOk(`"${prodSel?.nombre}" agregado al plan`)
      setForm(f => ({ ...EMPTY, fechaInicio: f.fechaInicio }))
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Planificación</h1>
        <p className="text-sm text-gray-400 mt-0.5">Cargá el plan de producción semanal</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

        {/* ── Formulario ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-[10px] shadow-card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Agregar al plan</h2>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Producto <span className="text-red-500">*</span></label>
              <select value={form.productoId} onChange={e => set('productoId', e.target.value)} className={INPUT}>
                <option value="">Seleccionar producto…</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.codigo ? ` — ${p.codigo}` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad (kg/lt) <span className="text-red-500">*</span></label>
              <input className={INPUT} type="number" min="0.01" step="0.01"
                value={form.cantidad} onChange={e => set('cantidad', e.target.value)} placeholder="0"/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio <span className="text-red-500">*</span></label>
                <input className={INPUT} type="date" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                <input className={INPUT} type="date" value={form.fechaFin} onChange={e => set('fechaFin', e.target.value)}/>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea className={INPUT + ' resize-none'} rows={2}
                value={form.notas} onChange={e => set('notas', e.target.value)}
                placeholder="Instrucciones especiales…"/>
            </div>

            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            {ok  && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{ok}</p>}

            <button type="submit" disabled={crear.isPending}
              className="w-full bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {crear.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              Agregar al plan
            </button>
          </form>
        </div>

        {/* ── Plan de la semana ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <button onClick={prev} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[190px] text-center">
                {fmtCorto(dias[0])} – {fmtCorto(dias[6])}
              </span>
              <button onClick={next} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <span className="text-xs text-gray-400">{trabajosSemana.length} trabajo{trabajosSemana.length !== 1 ? 's' : ''} planificado{trabajosSemana.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Sin fecha */}
          {sinFecha.length > 0 && (
            <div className="mb-4 bg-white rounded-[10px] shadow-card overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">Sin fecha asignada</div>
              <div className="divide-y divide-gray-50">
                {sinFecha.map(t => (
                  <JobRow key={t.id} trabajo={t} onEliminar={id => eliminar.mutate(id)}/>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
            {dias.map(dia => {
              const key  = isoDate(dia)
              const ocs  = porFecha[key] ?? []
              const esHoy = key === isoDate(new Date())
              if (ocs.length === 0 && !esHoy) return null
              return (
                <div key={key} className="border-b border-gray-50 last:border-0">
                  <div className={`px-4 py-2 text-xs font-semibold flex items-center justify-between ${esHoy ? 'bg-blue-50 text-[#004a99]' : 'bg-gray-50 text-gray-500'}`}>
                    <span className="capitalize">{fmtDia(dia)}</span>
                    {ocs.length > 0 && <span className="bg-[#004a99] text-white px-1.5 py-0.5 rounded-full">{ocs.length}</span>}
                  </div>
                  {ocs.length === 0
                    ? <div className="px-4 py-2 text-xs text-gray-300 italic">Sin tareas</div>
                    : <div className="divide-y divide-gray-50">
                        {ocs.map(t => <JobRow key={t.id} trabajo={t} onEliminar={id => eliminar.mutate(id)}/>)}
                      </div>
                  }
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function JobRow({ trabajo, onEliminar }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{trabajo.nombre}</p>
        {trabajo.cantidad_planificada > 0 && (
          <p className="text-xs text-gray-400">{trabajo.cantidad_planificada} kg/lt</p>
        )}
        {trabajo.notas && <p className="text-xs text-gray-400 italic truncate">{trabajo.notas}</p>}
      </div>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
        trabajo.estado === 'en-curso' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
      }`}>
        {trabajo.estado === 'en-curso' ? 'En curso' : 'Pendiente'}
      </span>
      <button onClick={() => onEliminar(trabajo.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  )
}
