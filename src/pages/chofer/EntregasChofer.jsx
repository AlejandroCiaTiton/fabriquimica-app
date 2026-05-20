import { useState } from 'react'
import { useEntregasChofer, useConfirmarEntrega, useRegistrarNoEntrega } from '../../hooks/useChofer'
import { fmtFecha } from '../../utils/calc'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_CORTO = ['Do','Lu','Ma','Mi','Ju','Vi','Sá']

function toYMD(date) {
  return date.toISOString().slice(0, 10)
}

function getFechaEntrega(oc) {
  const planFecha = Array.isArray(oc.plan_entregas)
    ? oc.plan_entregas[0]?.fecha
    : oc.plan_entregas?.fecha
  return planFecha || oc.fecha_estimada_entrega || null
}

function Calendario({ year, month, entregasPorDia, diaSeleccionado, onSelectDia, onPrevMes, onNextMes }) {
  const primerDia = new Date(year, month, 1).getDay()
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const celdas = []

  for (let i = 0; i < primerDia; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)

  const hoy = toYMD(new Date())

  return (
    <div className="bg-white rounded-[10px] shadow-card p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevMes} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="font-semibold text-gray-900 text-sm">{MESES[month]} {year}</span>
        <button onClick={onNextMes} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DIAS_CORTO.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {celdas.map((dia, i) => {
          if (!dia) return <div key={`e-${i}`}/>
          const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const count = entregasPorDia[ymd] ?? 0
          const esHoy = ymd === hoy
          const seleccionado = ymd === diaSeleccionado
          return (
            <button key={ymd} onClick={() => onSelectDia(seleccionado ? null : ymd)}
              className={`relative flex flex-col items-center py-1.5 rounded-lg text-xs font-medium transition-colors ${
                seleccionado
                  ? 'bg-[#004a99] text-white'
                  : esHoy
                  ? 'bg-blue-50 text-[#004a99] font-bold'
                  : count > 0
                  ? 'hover:bg-gray-100 text-gray-800'
                  : 'hover:bg-gray-50 text-gray-400'
              }`}>
              {dia}
              {count > 0 && !seleccionado && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#004a99] mt-0.5"/>
              )}
              {count > 0 && seleccionado && (
                <span className="w-1.5 h-1.5 rounded-full bg-white mt-0.5"/>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModalNoEntrega({ oc, onConfirm, onClose, loading }) {
  const [motivo, setMotivo] = useState('')
  const cli = oc.cotizaciones?.clientes

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="font-bold text-gray-900 text-base mb-1">No pudo entregarse</h2>
        <p className="text-sm text-gray-500 mb-4">
          {cli?.razon_social} · <span className="font-mono">{oc.numero}</span>
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ej: Cliente ausente, dirección incorrecta, acceso denegado…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            disabled={!motivo.trim() || loading}
            onClick={() => onConfirm(motivo.trim())}
            className="flex-1 bg-[#dc3545] hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

function TarjetaEntrega({ oc, onConfirmar, onNoEntrega }) {
  const cli   = oc.cotizaciones?.clientes
  const items = oc.cotizaciones?.cotizacion_items ?? []
  const plan  = Array.isArray(oc.plan_entregas) ? oc.plan_entregas[0] : oc.plan_entregas
  const tieneMotivo = plan?.notas

  return (
    <div className={`bg-white rounded-[10px] shadow-card p-4 ${tieneMotivo ? 'border border-orange-200' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{cli?.razon_social}</p>
          <p className="font-mono text-xs text-[#004a99]">{oc.numero}</p>
          {oc.fecha_estimada_entrega && (
            <p className="text-xs text-gray-400 mt-0.5">
              Entrega estimada: {fmtFecha(oc.fecha_estimada_entrega)}
            </p>
          )}
        </div>
        {tieneMotivo && (
          <span className="flex-shrink-0 text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
            Intento fallido
          </span>
        )}
      </div>

      {tieneMotivo && (
        <div className="mb-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          <p className="text-xs text-orange-700"><span className="font-medium">Último intento:</span> {plan.notas}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-3 space-y-1">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between text-xs text-gray-600">
              <span className="truncate">{it.productos?.nombre}</span>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <span className="font-medium">{it.cantidad} kg/lt</span>
                {it.lote_aplicado && (
                  <span className="font-mono text-gray-400">L: {it.lote_aplicado}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-50">
        <button onClick={() => onNoEntrega(oc)}
          className="flex-1 border border-gray-200 text-gray-600 font-medium py-1.5 rounded-lg text-xs hover:bg-gray-50 transition-colors">
          No pude entregar
        </button>
        <button onClick={() => onConfirmar(oc.id)}
          className="flex-1 bg-[#28a745] hover:bg-green-700 text-white font-medium py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          Entregado
        </button>
      </div>
    </div>
  )
}

export default function EntregasChofer() {
  const { data: ordenes = [], isLoading } = useEntregasChofer()
  const { mutate: confirmar, isPending: confirmando } = useConfirmarEntrega()
  const { mutate: noEntrega, isPending: registrando }  = useRegistrarNoEntrega()

  const hoy = new Date()
  const [mes, setMes]             = useState(hoy.getMonth())
  const [year, setYear]           = useState(hoy.getFullYear())
  const [diaSelec, setDiaSelec]   = useState(toYMD(hoy))
  const [modalOC, setModalOC]     = useState(null)

  function prevMes() {
    if (mes === 0) { setMes(11); setYear(y => y - 1) }
    else setMes(m => m - 1)
  }
  function nextMes() {
    if (mes === 11) { setMes(0); setYear(y => y + 1) }
    else setMes(m => m + 1)
  }

  const entregasPorDia = {}
  ordenes.forEach(oc => {
    const fecha = getFechaEntrega(oc)
    if (fecha) entregasPorDia[fecha] = (entregasPorDia[fecha] ?? 0) + 1
  })

  const ordenesDelDia = diaSelec
    ? ordenes.filter(oc => getFechaEntrega(oc) === diaSelec)
    : []
  const ordenesSinFecha = ordenes.filter(oc => !getFechaEntrega(oc))

  function handleConfirmar(ocId) {
    confirmar(ocId)
  }

  function handleNoEntregaConfirm(motivo) {
    noEntrega({ ocId: modalOC.id, motivo }, { onSuccess: () => setModalOC(null) })
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Mis entregas</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? 'Cargando…' : `${ordenes.length} pedido${ordenes.length !== 1 ? 's' : ''} pendiente${ordenes.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="flex gap-5 items-start">
        {/* Columna izquierda: calendario */}
        <div className="w-64 flex-shrink-0 space-y-4">
          <Calendario
            year={year}
            month={mes}
            entregasPorDia={entregasPorDia}
            diaSeleccionado={diaSelec}
            onSelectDia={setDiaSelec}
            onPrevMes={prevMes}
            onNextMes={nextMes}
          />

          {ordenesSinFecha.length > 0 && (
            <div className="bg-white rounded-[10px] shadow-card p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sin fecha asignada</p>
              <p className="text-2xl font-bold text-[#004a99]">{ordenesSinFecha.length}</p>
              <button onClick={() => setDiaSelec(null)}
                className="mt-2 text-xs text-[#004a99] hover:underline font-medium">
                Ver todas →
              </button>
            </div>
          )}
        </div>

        {/* Columna derecha: lista */}
        <div className="flex-1 min-w-0">
          {isLoading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
            </div>
          )}

          {!isLoading && (
            <>
              {diaSelec && (
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    {fmtFecha(diaSelec)}
                    <span className="ml-2 text-gray-400 font-normal">
                      {ordenesDelDia.length} {ordenesDelDia.length === 1 ? 'entrega' : 'entregas'}
                    </span>
                  </h2>
                  {ordenesDelDia.length === 0 ? (
                    <div className="bg-white rounded-[10px] shadow-card p-8 text-center text-sm text-gray-400">
                      Sin entregas para este día
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ordenesDelDia.map(oc => (
                        <TarjetaEntrega key={oc.id} oc={oc}
                          onConfirmar={handleConfirmar}
                          onNoEntrega={setModalOC}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!diaSelec && ordenesSinFecha.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    Sin fecha asignada
                    <span className="ml-2 text-gray-400 font-normal">{ordenesSinFecha.length} entregas</span>
                  </h2>
                  <div className="space-y-3">
                    {ordenesSinFecha.map(oc => (
                      <TarjetaEntrega key={oc.id} oc={oc}
                        onConfirmar={handleConfirmar}
                        onNoEntrega={setModalOC}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modalOC && (
        <ModalNoEntrega
          oc={modalOC}
          loading={registrando}
          onConfirm={handleNoEntregaConfirm}
          onClose={() => setModalOC(null)}
        />
      )}
    </div>
  )
}
