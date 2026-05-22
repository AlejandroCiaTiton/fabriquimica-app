import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { usePlanAnual, usePesosMensuales } from '../../hooks/usePlan'

const AÑO = new Date().getFullYear()
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function useEstadisticas() {
  return useQuery({
    queryKey: ['estadisticas', AÑO],
    queryFn: async () => {
      const [cotRes, ocRes, vendRes] = await Promise.all([
        supabase.from('cotizaciones')
          .select('id, estado, total, moneda, creado_en, vendedores(id, perfiles(nombre))')
          .gte('creado_en', `${AÑO}-01-01`)
          .lt('creado_en', `${AÑO + 1}-01-01`),
        supabase.from('ordenes_compra')
          .select('id, estado, creado_en, cotizaciones(total, moneda)')
          .gte('creado_en', `${AÑO}-01-01`)
          .lt('creado_en', `${AÑO + 1}-01-01`),
        supabase.from('vendedores').select('id, rol, perfiles(nombre)'),
      ])
      if (cotRes.error) throw cotRes.error
      if (ocRes.error) throw ocRes.error
      if (vendRes.error) throw vendRes.error
      return { cotizaciones: cotRes.data, ordenes: ocRes.data, vendedores: vendRes.data }
    },
    staleTime: 1000 * 60 * 5,
  })
}

function KpiCard({ label, value, sub, color = '#1b4332' }) {
  return (
    <div className="bg-white rounded-[10px] shadow-card px-5 py-4">
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Estadisticas() {
  const { isJefeVentas } = useAuth()
  const { data, isLoading } = useEstadisticas()
  const { data: planes = [] } = usePlanAnual(AÑO)
  const { data: pesosData = [] } = usePesosMensuales(AÑO)

  const totalAnual  = planes.reduce((s, p) => s + (p.objetivo ?? 0), 0)
  const planMensual = MESES.map((_, i) => {
    const found = pesosData.find(p => p.mes === i + 1)
    return found?.peso ?? 0
  })

  const stats = useMemo(() => {
    if (!data) return null
    const cots = data.cotizaciones

    const total      = cots.length
    const ganadas    = cots.filter(c => c.estado === 'ganada').length
    const perdidas   = cots.filter(c => c.estado === 'perdida').length
    const espera     = cots.filter(c => c.estado === 'espera').length
    const revision   = cots.filter(c => c.estado === 'revision').length
    const conversion = total > 0 ? Math.round((ganadas / total) * 100) : 0

    const totalFacturado = data.ordenes
      .filter(o => o.estado === 'entregada')
      .reduce((s, o) => s + (o.cotizaciones?.total ?? 0), 0)

    const porVendedor = {}
    for (const c of cots) {
      const vId = c.vendedores?.id
      if (!vId) continue
      if (!porVendedor[vId]) {
        porVendedor[vId] = { nombre: c.vendedores?.perfiles?.nombre ?? '—', total: 0, ganadas: 0, perdidas: 0, revision: 0 }
      }
      porVendedor[vId].total++
      if (c.estado === 'ganada')   porVendedor[vId].ganadas++
      if (c.estado === 'perdida')  porVendedor[vId].perdidas++
      if (c.estado === 'revision') porVendedor[vId].revision++
    }

    const ocPorMes = Array(12).fill(0)
    for (const oc of data.ordenes) {
      const mes = new Date(oc.creado_en).getMonth()
      ocPorMes[mes] += oc.cotizaciones?.total ?? 0
    }

    return { total, ganadas, perdidas, espera, revision, conversion, totalFacturado, porVendedor, ocPorMes }
  }, [data])

  if (!isJefeVentas) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 text-sm">Esta sección es solo para el jefe de ventas.</p>
      </div>
    )
  }

  if (isLoading || !stats) {
    return <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/></div>
  }

  const realTotal = stats.ocPorMes.reduce((a, v) => a + v, 0)
  const pctPlan   = totalAnual > 0 ? Math.round((realTotal / totalAnual) * 100) : 0
  const mesActual = new Date().getMonth()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Estadísticas {AÑO}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen del equipo de ventas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total cotizaciones"    value={stats.total}    sub={`${AÑO}`}/>
        <KpiCard label="Ganadas"               value={stats.ganadas}  sub={`${stats.conversion}% conversión`} color="#28a745"/>
        <KpiCard label="En espera / revisión"  value={stats.espera + stats.revision}
          sub={`${stats.espera} en espera · ${stats.revision} en revisión`} color="#ffc107"/>
        <KpiCard
          label="Facturado acum. (USD)"
          value={`$${Math.round(stats.totalFacturado).toLocaleString('es-AR')}`}
          sub={totalAnual > 0 ? `${pctPlan}% del plan ${AÑO}` : 'OC entregadas'}
          color="#1b4332"
        />
      </div>

      {/* Por vendedor */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Rendimiento por vendedor</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Vendedor</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">Total</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">Ganadas</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">Revisión</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">Perdidas</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Conversión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {Object.entries(stats.porVendedor).map(([vId, v]) => {
              const conv = v.total > 0 ? Math.round((v.ganadas / v.total) * 100) : 0
              return (
                <tr key={vId} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{v.nombre}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{v.total}</td>
                  <td className="px-4 py-2.5 text-center font-semibold text-[#28a745]">{v.ganadas}</td>
                  <td className="px-4 py-2.5 text-center text-[#ffc107]">{v.revision}</td>
                  <td className="px-4 py-2.5 text-center text-[#dc3545]">{v.perdidas}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-semibold ${conv >= 50 ? 'text-[#28a745]' : conv >= 30 ? 'text-[#ffc107]' : 'text-[#dc3545]'}`}>{conv}%</span>
                  </td>
                </tr>
              )
            })}
            {Object.keys(stats.porVendedor).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Sin datos este año</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cumplimiento del plan */}
      {totalAnual > 0 ? (
        <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Cumplimiento del plan {AÑO}</h2>
            <span className="text-xs text-gray-400">Real OC vs Plan mensual</span>
          </div>

          {/* Barra de avance anual */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs text-gray-500 w-24 flex-shrink-0">Avance anual</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(pctPlan, 100)}%`,
                    backgroundColor: pctPlan >= 90 ? '#28a745' : pctPlan >= 60 ? '#1b4332' : pctPlan >= 30 ? '#ffc107' : '#dc3545',
                  }}
                />
              </div>
              <span className={`text-sm font-bold w-12 text-right flex-shrink-0 ${pctPlan >= 90 ? 'text-[#28a745]' : pctPlan >= 60 ? 'text-[#1b4332]' : pctPlan >= 30 ? 'text-[#ffc107]' : 'text-[#dc3545]'}`}>
                {pctPlan}%
              </span>
            </div>
            <p className="text-xs text-gray-400 text-right">
              Real: USD {Math.round(realTotal).toLocaleString('es-AR')} / Plan: USD {totalAnual.toLocaleString('es-AR')}
            </p>
          </div>

          {/* Tabla mes a mes */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Mes</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 w-36">Plan</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 w-36">Real OC</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 w-20">%</th>
                <th className="px-4 py-2.5 font-medium text-gray-500 w-40">Progreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MESES.map((mes, i) => {
                const plan     = planMensual[i]
                const real     = stats.ocPorMes[i]
                const pct      = plan > 0 ? Math.round((real / plan) * 100) : null
                const esFuturo = i > mesActual
                const clrText  = pct == null ? 'text-gray-400' : pct >= 100 ? 'text-[#28a745]' : pct >= 70 ? 'text-[#ffc107]' : esFuturo ? 'text-gray-400' : 'text-[#dc3545]'
                const clrBar   = pct == null ? '#e5e7eb' : pct >= 100 ? '#28a745' : pct >= 70 ? '#ffc107' : esFuturo ? '#e5e7eb' : '#dc3545'
                return (
                  <tr key={i} className={`hover:bg-gray-50 ${esFuturo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{mes} {AÑO}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">
                      {plan > 0 ? `USD ${plan.toLocaleString('es-AR')}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                      {real > 0 ? `USD ${Math.round(real).toLocaleString('es-AR')}` : '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${clrText}`}>
                      {pct != null ? `${pct}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(pct ?? 0, 100)}%`, backgroundColor: clrBar }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-gray-700">Total {AÑO}</td>
                <td className="px-4 py-3 text-right text-gray-600">USD {totalAnual.toLocaleString('es-AR')}</td>
                <td className="px-4 py-3 text-right text-gray-800">USD {Math.round(realTotal).toLocaleString('es-AR')}</td>
                <td className={`px-4 py-3 text-right ${pctPlan >= 90 ? 'text-[#28a745]' : pctPlan >= 60 ? 'text-[#1b4332]' : 'text-[#ffc107]'}`}>{pctPlan}%</td>
                <td className="px-4 py-3">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(pctPlan, 100)}%`, backgroundColor: pctPlan >= 90 ? '#28a745' : pctPlan >= 60 ? '#1b4332' : '#ffc107' }}
                    />
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-[10px] shadow-card p-8 text-center">
          <p className="text-gray-400 text-sm">
            No hay plan cargado para {AÑO}.{' '}
            <a href="/vendedor/plan" className="text-[#1b4332] hover:underline font-medium">Ir a Plan de Ventas →</a>
          </p>
        </div>
      )}
    </div>
  )
}
