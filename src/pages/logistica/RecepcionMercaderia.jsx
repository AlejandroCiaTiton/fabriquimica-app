import { useState } from 'react'
import { useProductos } from '../../hooks/useProductos'
import { useRecepciones, useRegistrarRecepcion } from '../../hooks/useLogistica'
import { fmtFecha } from '../../utils/calc'

const HOY = new Date().toISOString().split('T')[0]

const EMPTY = {
  tipo:             'existente',
  productoId:       '',
  codigo:           '',
  nombre:           '',
  cantidad:         '',
  fechaRecepcion:   HOY,
  numeroLote:       '',
  fechaVencimiento: '',
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]'

function BadgeVto({ fecha }) {
  if (!fecha) return <span className="text-gray-300">—</span>
  const vencido = new Date(fecha + 'T00:00:00') < new Date()
  return (
    <span className={`font-medium text-sm ${vencido ? 'text-red-600' : 'text-gray-700'}`}>
      {fmtFecha(fecha)}
      {vencido && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Vencido</span>}
    </span>
  )
}

export default function RecepcionMercaderia() {
  const { data: productos = [] }                  = useProductos()
  const { data: historial = [], isLoading: loadH } = useRecepciones()
  const registrar = useRegistrarRecepcion()

  const [tab,  setTab]  = useState('registrar')
  const [form, setForm] = useState(EMPTY)
  const [err,  setErr]  = useState('')
  const [ok,   setOk]   = useState('')
  const [busH, setBusH] = useState('')

  const prodSel = productos.find(p => String(p.id) === String(form.productoId))

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(''); setOk('')

    if (form.tipo === 'existente' && !form.productoId) {
      setErr('Seleccioná un producto'); return
    }
    if (form.tipo === 'nuevo' && (!form.codigo.trim() || !form.nombre.trim())) {
      setErr('Código y nombre son obligatorios'); return
    }
    if (!form.cantidad || parseFloat(form.cantidad) <= 0) {
      setErr('La cantidad debe ser mayor a 0'); return
    }

    const payload = form.tipo === 'existente'
      ? { productoId: form.productoId, codigo: prodSel?.codigo ?? '', nombre: prodSel?.nombre ?? '',
          cantidad: form.cantidad, fechaRecepcion: form.fechaRecepcion,
          numeroLote: form.numeroLote, fechaVencimiento: form.fechaVencimiento, esNuevo: false }
      : { productoId: null, codigo: form.codigo.trim(), nombre: form.nombre.trim(),
          cantidad: form.cantidad, fechaRecepcion: form.fechaRecepcion,
          numeroLote: form.numeroLote, fechaVencimiento: form.fechaVencimiento, esNuevo: true }

    try {
      await registrar.mutateAsync(payload)
      setOk(`Recepción registrada: ${payload.nombre} — ${form.cantidad} kg/lt`)
      setForm(EMPTY)
    } catch (e) {
      setErr(e.message)
    }
  }

  const histFiltrado = busH.trim()
    ? historial.filter(r =>
        r.nombre?.toLowerCase().includes(busH.toLowerCase()) ||
        r.codigo?.toLowerCase().includes(busH.toLowerCase()) ||
        r.numero_lote?.toLowerCase().includes(busH.toLowerCase())
      )
    : historial

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Recepción de mercadería</h1>
        <p className="text-sm text-gray-400 mt-0.5">Registrá los ingresos al depósito — actualiza el stock automáticamente</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[['registrar', 'Registrar ingreso'], ['historial', 'Historial']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === v ? 'bg-white text-[#1b4332] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {l}
            {v === 'historial' && historial.length > 0 && (
              <span className="ml-1.5 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{historial.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Registrar ─────────────────────────────────────────────────── */}
      {tab === 'registrar' && (
        <div className="bg-white rounded-[10px] shadow-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Producto</label>
              <div className="flex gap-2 mb-3">
                {[['existente', 'Producto existente'], ['nuevo', 'Nuevo producto']].map(([v, l]) => (
                  <button key={v} type="button"
                    onClick={() => { set('tipo', v); setErr(''); setOk('') }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      form.tipo === v
                        ? 'border-[#1b4332] bg-blue-50 text-[#1b4332]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>

              {form.tipo === 'existente' && (
                <select value={form.productoId} onChange={e => set('productoId', e.target.value)}
                  className={INPUT}>
                  <option value="">Seleccionar producto…</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.codigo ? ` — ${p.codigo}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {form.tipo === 'nuevo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Código <span className="text-red-500">*</span></label>
                    <input className={INPUT} value={form.codigo}
                      onChange={e => set('codigo', e.target.value)}
                      placeholder="Ej: FQ-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                    <input className={INPUT} value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      placeholder="Nombre del producto" />
                  </div>
                </div>
              )}
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad (kg/lt) <span className="text-red-500">*</span>
              </label>
              <input className={INPUT} type="number" min="0.01" step="0.01"
                value={form.cantidad} onChange={e => set('cantidad', e.target.value)}
                placeholder="0" />
            </div>

            {/* Fecha recepción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de recepción <span className="text-red-500">*</span>
              </label>
              <input className={INPUT} type="date"
                value={form.fechaRecepcion} onChange={e => set('fechaRecepcion', e.target.value)} />
            </div>

            {/* Lote + Vencimiento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° de lote</label>
                <input className={INPUT} value={form.numeroLote}
                  onChange={e => set('numeroLote', e.target.value)}
                  placeholder="Ej: L2025-042" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
                <input className={INPUT} type="date"
                  value={form.fechaVencimiento} onChange={e => set('fechaVencimiento', e.target.value)} />
              </div>
            </div>

            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            {ok  && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{ok}</p>}

            <button type="submit" disabled={registrar.isPending}
              className="w-full bg-[#1b4332] hover:bg-[#152e24] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {registrar.isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Registrar recepción
            </button>
          </form>
        </div>
      )}

      {/* ── Tab: Historial ─────────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <>
          <div className="relative max-w-sm mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" value={busH} onChange={e => setBusH(e.target.value)}
              placeholder="Buscar por producto, código o lote…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b4332]"/>
          </div>

          <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
            {loadH
              ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/></div>
              : histFiltrado.length === 0
              ? <div className="p-12 text-center text-sm text-gray-400">Sin recepciones registradas</div>
              : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Producto</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Código</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">Cantidad</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Recepción</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Lote</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {histFiltrado.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.nombre}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{r.codigo || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-800">{r.cantidad}</td>
                        <td className="px-4 py-2.5 text-gray-500">{fmtFecha(r.fecha_recepcion)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.numero_lote || '—'}</td>
                        <td className="px-4 py-2.5"><BadgeVto fecha={r.fecha_vencimiento}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </>
      )}
    </div>
  )
}
