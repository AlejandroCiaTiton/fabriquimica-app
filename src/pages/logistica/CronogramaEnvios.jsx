import { useState } from 'react'
import { useOrdenesListasDespacho, useTransportistas, useProgramarEnvio, useCronogramaLogistica } from '../../hooks/useLogistica'

const ESTADO_BADGE = {
  'listo-entrega':     'bg-green-100 text-green-700',
  'pendiente-despacho':'bg-blue-100 text-blue-700',
}

const ESTADO_LABEL = {
  'listo-entrega':      'Listo para despacho',
  'pendiente-despacho': 'Pendiente despacho',
}

const CRONOGRAMA_ESTADO_BADGE = {
  programado:    'bg-blue-100 text-blue-700',
  'en-camino':   'bg-amber-100 text-amber-700',
  entregado:     'bg-green-100 text-green-700',
  'sin-productos':'bg-red-100 text-red-700',
  'sin-transporte':'bg-red-100 text-red-700',
}

function FormProgramar({ oc, transportistas, onSubmit, onCancel }) {
  const [form, setForm] = useState({ transportistaId: '', fechaProgramada: '', horaEstimada: '', observaciones: '' })
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.transportistaId || !form.fechaProgramada) {
      setError('Transportista y fecha son obligatorios')
      return
    }
    setError('')
    await onSubmit({
      ocId:            oc.id,
      transportistaId: parseInt(form.transportistaId),
      fechaProgramada: form.fechaProgramada,
      horaEstimada:    form.horaEstimada || null,
      observaciones:   form.observaciones || null,
    })
  }

  const items = oc.cotizaciones?.cotizacion_items ?? []

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
      <p className="text-xs font-medium text-blue-800 mb-3">
        Programar envío — OC #{oc.numero} · {oc.cotizaciones?.clientes?.razon_social}
      </p>
      <div className="text-xs text-gray-600 mb-3 space-y-0.5">
        {items.slice(0, 4).map(it => (
          <div key={it.id}>{it.productos?.nombre} ×{it.cantidad}</div>
        ))}
        {items.length > 4 && <div className="text-gray-400">+{items.length - 4} más</div>}
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Transportista <span className="text-red-500">*</span>
          </label>
          <select
            value={form.transportistaId}
            onChange={e => setForm(f => ({ ...f, transportistaId: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
          >
            <option value="">Seleccionar...</option>
            {transportistas.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre} {t.apellido}{t.empresa ? ` (${t.empresa})` : ''}{t.vehiculo ? ` — ${t.vehiculo}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Fecha programada <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.fechaProgramada}
            onChange={e => setForm(f => ({ ...f, fechaProgramada: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora estimada</label>
          <input
            type="time"
            value={form.horaEstimada}
            onChange={e => setForm(f => ({ ...f, horaEstimada: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
          <input
            value={form.observaciones}
            onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            placeholder="Opcional..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
          />
        </div>
        {error && (
          <p className="col-span-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
        )}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-[#1b4332] hover:bg-[#152e24] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Programar envío
          </button>
        </div>
      </form>
    </div>
  )
}

export default function CronogramaEnvios() {
  const { data: ordenes = [],      isLoading: loadingOC }   = useOrdenesListasDespacho()
  const { data: transportistas = []                       } = useTransportistas()
  const { data: cronograma = [],   isLoading: loadingCron } = useCronogramaLogistica()
  const programar = useProgramarEnvio()

  const [formAbierto, setFormAbierto] = useState(null) // oc.id

  const ordenesListas    = ordenes.filter(o => o.estado === 'listo-entrega')
  const ordenesProgramadas = ordenes.filter(o => o.estado === 'pendiente-despacho')

  async function handleProgramar(datos) {
    try {
      await programar.mutateAsync(datos)
      setFormAbierto(null)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Cronograma de envíos</h1>
        <p className="text-sm text-gray-400 mt-0.5">Programar despachos y ver estado de envíos</p>
      </div>

      {/* OCs listas para despacho */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Órdenes listas para despacho</h2>
        {loadingOC ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : ordenesListas.length === 0 ? (
          <div className="bg-white rounded-[10px] shadow-card py-10 text-center text-sm text-gray-400">
            No hay órdenes en estado "listo para entrega".
          </div>
        ) : (
          <div className="bg-white rounded-[10px] shadow-card divide-y divide-gray-50">
            {ordenesListas.map(oc => (
              <div key={oc.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="font-semibold text-gray-900">OC #{oc.numero}</span>
                    <span className="ml-3 text-sm text-gray-600">{oc.cotizaciones?.clientes?.razon_social}</span>
                    {oc.fecha_estimada_entrega && (
                      <span className="ml-3 text-xs text-gray-400">entrega estimada: {oc.fecha_estimada_entrega}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ESTADO_BADGE[oc.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ESTADO_LABEL[oc.estado] ?? oc.estado}
                    </span>
                    <button
                      onClick={() => setFormAbierto(formAbierto === oc.id ? null : oc.id)}
                      className="bg-[#1b4332] hover:bg-[#152e24] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      {formAbierto === oc.id ? 'Cancelar' : 'Programar envío'}
                    </button>
                  </div>
                </div>

                {formAbierto === oc.id && (
                  <FormProgramar
                    oc={oc}
                    transportistas={transportistas}
                    onSubmit={handleProgramar}
                    onCancel={() => setFormAbierto(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* OCs ya programadas */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Envíos programados</h2>
        {loadingCron ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : cronograma.length === 0 ? (
          <div className="bg-white rounded-[10px] shadow-card py-10 text-center text-sm text-gray-400">
            No hay envíos programados aún.
          </div>
        ) : (
          <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">OC</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Transportista</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cronograma.map(envio => {
                  const oc    = envio.ordenes_compra
                  const cot   = oc?.cotizaciones
                  const trans = envio.transportistas
                  return (
                    <tr key={envio.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">#{oc?.numero}</td>
                      <td className="px-4 py-3 text-gray-700">{cot?.clientes?.razon_social || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {envio.fecha_programada}
                        {envio.hora_estimada && (
                          <span className="ml-1.5 text-xs text-gray-400">{envio.hora_estimada.slice(0, 5)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {trans ? `${trans.nombre} ${trans.apellido}` : '—'}
                        {trans?.vehiculo && <span className="ml-1 text-xs text-gray-400">— {trans.vehiculo}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CRONOGRAMA_ESTADO_BADGE[envio.estado] ?? 'bg-gray-100 text-gray-500'}`}>
                          {envio.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
