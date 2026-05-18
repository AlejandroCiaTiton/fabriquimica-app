import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  usePlanAnual, usePesosMensuales, useActualizarPesoMes,
  useActualizarObjetivo, useCrearPlanVendedor, useEliminarPlanVendedor,
} from '../../hooks/usePlan'

const AÑO_ACTUAL = new Date().getFullYear()
const AÑOS  = [AÑO_ACTUAL - 1, AÑO_ACTUAL, AÑO_ACTUAL + 1, AÑO_ACTUAL + 2]
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function useVendedores() {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendedores').select('id, rol, perfiles(nombre)')
      if (error) throw error
      return (data ?? []).filter(v => v.rol !== 'jefe')
    },
    staleTime: 1000 * 60 * 10,
  })
}

// ─── input inline USD ─────────────────────────────────────────────────────────

function NumInputUSD({ value, onSave, step = 1000 }) {
  const [editando, setEditando] = useState(false)
  const [val, setVal] = useState(value ?? 0)
  const [err, setErr] = useState(null)

  async function guardar() {
    const n = parseFloat(val) || 0
    setEditando(false)
    try {
      await onSave(n)
      setErr(null)
    } catch (e) {
      setErr(e.message)
    }
  }

  if (editando) {
    return (
      <input
        autoFocus type="number" min={0} step={step} value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={guardar}
        onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setVal(value ?? 0); setEditando(false) } }}
        className="w-full text-center text-sm border border-[#004a99] rounded px-1 py-1.5 focus:outline-none"
      />
    )
  }

  return (
    <div>
      <button
        onClick={() => { setVal(value ?? 0); setEditando(true) }}
        className="w-full text-center hover:bg-blue-50 rounded py-1.5 transition-colors group"
      >
        {value > 0
          ? <span className="text-sm font-bold text-[#004a99]">${Number(value).toLocaleString('es-AR')}</span>
          : <span className="text-gray-300 text-xs group-hover:text-gray-400">— clic —</span>
        }
      </button>
      {err && <p className="text-[10px] text-red-600 text-center mt-0.5 leading-tight">{err}</p>}
    </div>
  )
}

function NumInputAnual({ value, onSave }) {
  const [editando, setEditando] = useState(false)
  const [val, setVal] = useState(value ?? 0)

  async function guardar() {
    setEditando(false)
    try { await onSave(parseFloat(val) || 0) } catch (e) { alert('Error al guardar: ' + e.message) }
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus type="number" min={0} step={1000} value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={guardar}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setVal(value ?? 0); setEditando(false) } }}
          className="w-36 text-right text-sm border border-[#004a99] rounded-lg px-2 py-1.5 focus:outline-none"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => { setVal(value ?? 0); setEditando(true) }}
      className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-[#004a99] transition-colors group"
    >
      {value > 0
        ? `USD ${Number(value).toLocaleString('es-AR')}`
        : <span className="text-gray-300 font-normal">Clic para ingresar</span>
      }
      <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#004a99] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
      </svg>
    </button>
  )
}

// ─── página ────────────────────────────────────────────────────────────────────

export default function PlanVentas() {
  const { isJefeVentas } = useAuth()
  const [año, setAño] = useState(AÑO_ACTUAL)

  const { data: vendedores = [], isLoading: loadVend } = useVendedores()
  const { data: planes    = [], isLoading: loadPlan }  = usePlanAnual(año)
  const { data: pesosData = [] }                       = usePesosMensuales(año)

  const actualizarObjetivo = useActualizarObjetivo()
  const crearPlan          = useCrearPlanVendedor()
  const eliminarPlan       = useEliminarPlanVendedor()
  const actualizarMes      = useActualizarPesoMes(año)

  if (!isJefeVentas) {
    return <div className="p-8 text-center"><p className="text-gray-400 text-sm">Esta sección es solo para el jefe de ventas.</p></div>
  }

  // Montos mensuales en USD (directos)
  const planMensual = MESES.map((_, i) => {
    const found = pesosData.find(p => p.mes === i + 1)
    return found?.peso ?? 0
  })
  const totalAnual       = planes.reduce((s, p) => s + (p.objetivo ?? 0), 0)
  const sumaMensual      = planMensual.reduce((a, v) => a + v, 0)
  const diferencia       = totalAnual - sumaMensual
  const maxMes           = Math.max(...planMensual, 1)
  const vendedoresConPlan = new Set(planes.map(p => p.vendedor_id))
  const vendedoresSinPlan = vendedores.filter(v => !vendedoresConPlan.has(v.id))

  return (
    <div className="p-6 max-w-5xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Plan de Ventas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Definí los objetivos anuales y el plan mensual del equipo en USD</p>
      </div>

      {/* Selector de año */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit mb-6">
        {AÑOS.map(a => (
          <button key={a} onClick={() => setAño(a)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${año === a ? 'bg-[#004a99] text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            {a}
          </button>
        ))}
      </div>

      {/* Resumen */}
      {(totalAnual > 0 || sumaMensual > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-[10px] shadow-card px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Objetivo anual equipo</p>
            <p className="text-2xl font-bold text-[#004a99]">USD {totalAnual.toLocaleString('es-AR')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{planes.length} vendedor{planes.length !== 1 ? 'es' : ''} con plan</p>
          </div>
          <div className="bg-white rounded-[10px] shadow-card px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Suma plan mensual</p>
            <p className="text-2xl font-bold text-gray-800">USD {sumaMensual.toLocaleString('es-AR')}</p>
          </div>
          <div className="bg-white rounded-[10px] shadow-card px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Diferencia</p>
            <p className={`text-2xl font-bold ${diferencia === 0 ? 'text-[#28a745]' : 'text-[#ffc107]'}`}>
              {diferencia === 0 ? '✓ Balanceado' : diferencia > 0
                ? `−USD ${diferencia.toLocaleString('es-AR')}`
                : `+USD ${Math.abs(diferencia).toLocaleString('es-AR')}`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {diferencia === 0 ? 'Los totales coinciden' : diferencia > 0 ? 'Falta distribuir' : 'Distribuido de más'}
            </p>
          </div>
        </div>
      )}

      {/* Objetivos por vendedor */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Objetivo anual por vendedor</h2>
          <p className="text-xs text-gray-400 mt-0.5">Clic en el monto para editar</p>
        </div>

        {loadVend || loadPlan
          ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : (
            <div>
              {planes.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Vendedor</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500 w-52">Objetivo anual (USD)</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Proporción</th>
                      <th className="w-10 px-3"/>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {planes.map(plan => {
                      const nombre = plan.vendedores?.perfiles?.nombre ?? '—'
                      const pct = totalAnual > 0 ? (plan.objetivo / totalAnual) * 100 : 0
                      return (
                        <tr key={plan.id} className="hover:bg-gray-50 group">
                          <td className="px-5 py-3 font-medium text-gray-800">{nombre}</td>
                          <td className="px-5 py-3 text-right">
                            <NumInputAnual
                              value={plan.objetivo}
                              onSave={v => actualizarObjetivo.mutateAsync({ planId: plan.id, objetivo: v })}
                            />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[180px]">
                                <div className="h-full bg-[#004a99] rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }}/>
                              </div>
                              <span className="text-xs text-gray-500 w-10">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => { if (confirm(`¿Eliminar plan de ${nombre} para ${año}?`)) eliminarPlan.mutate({ planId: plan.id }) }}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-[#dc3545] transition-all p-1 rounded"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {totalAnual > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-5 py-3 font-bold text-gray-700">Total equipo</td>
                        <td className="px-5 py-3 text-right font-bold text-[#004a99]">USD {totalAnual.toLocaleString('es-AR')}</td>
                        <td colSpan={2} className="px-5 py-3 text-xs text-gray-400">100%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}

              {vendedoresSinPlan.length > 0 && (
                <div className={`px-5 py-4 ${planes.length > 0 ? 'border-t border-dashed border-gray-200' : ''}`}>
                  <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Sin plan para {año}</p>
                  <div className="flex flex-wrap gap-2">
                    {vendedoresSinPlan.map(v => (
                      <button key={v.id}
                        onClick={async () => {
                          try {
                            await crearPlan.mutateAsync({ vendedorId: v.id, anio: año })
                          } catch (e) {
                            alert('Error al crear plan: ' + e.message)
                          }
                        }}
                        disabled={crearPlan.isPending}
                        className="flex items-center gap-2 text-sm border border-dashed border-gray-300 text-gray-500 hover:border-[#004a99] hover:text-[#004a99] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        {v.perfiles?.nombre ?? 'Vendedor'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {vendedores.length === 0 && (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">No hay vendedores registrados.</div>
              )}
            </div>
          )
        }
      </div>

      {/* Plan mensual */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Plan mensual del equipo (USD)</h2>
          <p className="text-xs text-gray-400 mt-0.5">Ingresá el objetivo en dólares para cada mes. Clic en la celda para editar.</p>
        </div>

        <div className="p-5">
          {/* Mini barras visuales */}
          {sumaMensual > 0 && (
            <div className="grid grid-cols-12 gap-2 mb-1 px-1">
              {planMensual.map((v, i) => {
                const h = maxMes > 0 ? Math.round((v / maxMes) * 52) : 0
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className="flex flex-col justify-end h-14 w-full">
                      <div className="w-full bg-[#004a99]/15 rounded-t-sm transition-all" style={{ height: `${h}px`, minHeight: v > 0 ? '2px' : 0 }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Celdas de edición */}
          <div className="grid grid-cols-12 gap-2">
            {MESES.map((mes, i) => (
              <div key={i} className="flex flex-col border border-gray-100 rounded-lg overflow-hidden hover:border-gray-200 transition-colors">
                <div className="bg-gray-50 px-1 py-1.5 text-center border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-600">{mes}</span>
                </div>
                <div className="px-1 py-1">
                  <NumInputUSD
                    value={planMensual[i]}
                    onSave={v => actualizarMes.mutateAsync({ mes: i + 1, peso: v })}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total y balance */}
          <div className={`mt-5 flex items-center justify-between px-4 py-3 rounded-lg ${
            diferencia === 0 && sumaMensual > 0 ? 'bg-green-50 border border-green-200'
            : sumaMensual > 0 ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-gray-50 border border-gray-100'
          }`}>
            <div className="flex items-center gap-6 text-sm">
              <span className="text-gray-500">
                Suma mensual: <span className="font-bold text-gray-800">USD {sumaMensual.toLocaleString('es-AR')}</span>
              </span>
              {totalAnual > 0 && (
                <span className="text-gray-500">
                  Objetivo anual: <span className="font-bold text-gray-800">USD {totalAnual.toLocaleString('es-AR')}</span>
                </span>
              )}
            </div>
            {totalAnual > 0 && (
              <span className={`text-sm font-semibold ${diferencia === 0 ? 'text-[#28a745]' : 'text-[#ffc107]'}`}>
                {diferencia === 0
                  ? '✓ Totales balanceados'
                  : diferencia > 0
                  ? `Falta distribuir USD ${diferencia.toLocaleString('es-AR')}`
                  : `Excede el objetivo en USD ${Math.abs(diferencia).toLocaleString('es-AR')}`
                }
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
