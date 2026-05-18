import { useState } from 'react'
import { useEstadoCuenta, useActualizarEstadoPago } from '../../hooks/useFinanzas'
import { useAuth } from '../../context/AuthContext'

function fmtFecha(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-AR')
}

function fmtMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0)
}

const PAGO_CONFIG = {
  pagado:   { label: 'Pagado',   cls: 'bg-green-100 text-green-700' },
  parcial:  { label: 'Parcial',  cls: 'bg-yellow-100 text-yellow-700' },
  pendiente:{ label: 'Pendiente',cls: 'bg-red-100 text-red-600' },
}

function FilaPago({ oc, puedeCambiar }) {
  const actualizar = useActualizarEstadoPago()
  const cfg = PAGO_CONFIG[oc.estado_pago] ?? PAGO_CONFIG.pendiente

  if (!puedeCambiar) {
    return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
  }

  return (
    <select
      value={oc.estado_pago ?? 'pendiente'}
      onChange={e => actualizar.mutate({ ocId: oc.id, estadoPago: e.target.value })}
      disabled={actualizar.isPending}
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${cfg.cls}`}
    >
      <option value="pendiente">Pendiente</option>
      <option value="parcial">Parcial</option>
      <option value="pagado">Pagado</option>
    </select>
  )
}

function FilaCliente({ cliente, puedeCambiar }) {
  const [expandido, setExpandido] = useState(false)
  const ocsConFactura = cliente.ocs.filter(oc => oc.numero_factura)

  return (
    <>
      <tr
        onClick={() => setExpandido(v => !v)}
        className={`cursor-pointer hover:bg-gray-50 transition-colors ${cliente.tieneDeuda ? 'bg-red-50/30' : ''}`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${expandido ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
            <span className="font-medium text-gray-900">{cliente.razon_social}</span>
            {cliente.tieneDeuda && (
              <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Deuda pendiente</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-gray-700">{fmtMoneda(cliente.totalFacturado)}</td>
        <td className="px-4 py-3 text-right text-[#28a745] font-medium">{fmtMoneda(cliente.totalPagado)}</td>
        <td className="px-4 py-3 text-right">
          <span className={`font-semibold ${cliente.saldoPendiente > 0 ? 'text-[#dc3545]' : 'text-gray-400'}`}>
            {fmtMoneda(cliente.saldoPendiente)}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-gray-400 text-xs">{ocsConFactura.length} factura{ocsConFactura.length !== 1 ? 's' : ''}</td>
      </tr>

      {expandido && ocsConFactura.map(oc => (
        <tr key={oc.id} className="bg-gray-50/60 border-l-2 border-[#004a99]/20">
          <td className="pl-10 pr-4 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-500">#{oc.numero}</span>
              {oc.numero_factura && (
                <span className="font-mono text-[10px] text-gray-400">{oc.numero_factura}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(oc.creado_en)}</p>
          </td>
          <td className="px-4 py-2.5 text-right text-sm text-gray-700">{fmtMoneda(oc.cotizaciones?.total)}</td>
          <td className="px-4 py-2.5"/>
          <td className="px-4 py-2.5"/>
          <td className="px-4 py-2.5 text-right">
            <FilaPago oc={oc} puedeCambiar={puedeCambiar}/>
          </td>
        </tr>
      ))}

      {expandido && ocsConFactura.length === 0 && (
        <tr className="bg-gray-50/60">
          <td colSpan={5} className="pl-10 py-2 text-xs text-gray-400 italic">Sin facturas emitidas para este cliente</td>
        </tr>
      )}
    </>
  )
}

export default function EstadoCuenta() {
  const { data: clientes = [], isLoading } = useEstadoCuenta()
  const { isFinanzas } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)

  const filtrados = clientes
    .filter(c => !soloDeuda || c.tieneDeuda)
    .filter(c => !busqueda.trim() || c.razon_social?.toLowerCase().includes(busqueda.toLowerCase()))

  const totalDeudores = clientes.filter(c => c.tieneDeuda).length
  const saldoTotal    = clientes.reduce((s, c) => s + c.saldoPendiente, 0)

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Estado de cuenta</h1>
          <p className="text-sm text-gray-400 mt-0.5">Saldo por cliente basado en facturas emitidas</p>
        </div>
        {saldoTotal > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo total pendiente</p>
            <p className="text-xl font-bold text-[#dc3545]">{fmtMoneda(saldoTotal)}</p>
          </div>
        )}
      </div>

      {/* Alertas */}
      {totalDeudores > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span>
            <strong>{totalDeudores}</strong> cliente{totalDeudores !== 1 ? 's' : ''} con saldo pendiente
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={soloDeuda} onChange={e => setSoloDeuda(e.target.checked)}
            className="rounded border-gray-300 text-[#004a99]"/>
          Solo con deuda
        </label>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : filtrados.length === 0
          ? <div className="p-12 text-center text-sm text-gray-400">Sin clientes</div>
          : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-36">Total facturado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Cobrado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Pendiente</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Comprobantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(c => (
                <FilaCliente key={c.id} cliente={c} puedeCambiar={!!isFinanzas}/>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!isFinanzas && (
        <p className="text-xs text-gray-400 mt-3">Vista de solo lectura. El equipo de Finanzas gestiona el estado de pagos.</p>
      )}
    </div>
  )
}
