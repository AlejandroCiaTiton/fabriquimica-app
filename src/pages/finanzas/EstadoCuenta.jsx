import { useState } from 'react'
import {
  useEstadoCuenta,
  useActualizarEstadoPago,
  usePagosOC,
  useRegistrarPago,
  useActualizarVencimientoFactura,
} from '../../hooks/useFinanzas'
import { useComprobantesOC } from '../../hooks/useOrdenes'
import { useAuth } from '../../context/AuthContext'
import { fmtFecha } from '../../utils/calc'

function fmtMoneda(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(n ?? 0)
}

const PAGO_CONFIG = {
  pagado:   { label: 'Pagado',   cls: 'bg-green-100 text-green-700' },
  parcial:  { label: 'Parcial',  cls: 'bg-yellow-100 text-yellow-700' },
  pendiente:{ label: 'Pendiente',cls: 'bg-red-100 text-red-600' },
}

const TIPO_PAGO_CONFIG = {
  anticipo: { label: 'Anticipo',     cls: 'bg-purple-100 text-purple-700' },
  parcial:  { label: 'Parcial',      cls: 'bg-blue-100 text-blue-700' },
  total:    { label: 'Pago total',   cls: 'bg-green-100 text-green-700' },
}

function diasVencimiento(fecha) {
  if (!fecha) return null
  return Math.floor((new Date() - new Date(fecha + 'T00:00:00')) / 86400000)
}

// ── Vencimiento inline editable ───────────────────────────────────────────────
function VencimientoInline({ oc, puedeCambiar }) {
  const actualizar = useActualizarVencimientoFactura()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(oc.fecha_vencimiento_factura ?? '')
  const dias = diasVencimiento(val)

  function handleBlur() {
    actualizar.mutate({ ocId: oc.id, fechaVencimiento: val || null })
    setEditing(false)
  }

  if (editing) {
    return (
      <input type="date" value={val} onChange={e => setVal(e.target.value)}
        onBlur={handleBlur} autoFocus
        className="text-[10px] border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none"/>
    )
  }

  return (
    <span className="flex items-center gap-1 flex-wrap">
      {val ? (
        <>
          <span className="text-gray-500 text-[10px]">Vto. {fmtFecha(val)}</span>
          {dias > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              Vencida {dias}d
            </span>
          )}
          {dias !== null && dias <= 0 && dias > -7 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
              Vence en {-dias}d
            </span>
          )}
        </>
      ) : (
        puedeCambiar && (
          <button onClick={() => setEditing(true)}
            className="text-[10px] text-gray-300 hover:text-[#004a99] transition-colors">
            + Agregar vencimiento
          </button>
        )
      )}
      {val && puedeCambiar && (
        <button onClick={() => setEditing(true)}
          className="text-[10px] text-gray-400 hover:text-[#004a99] ml-0.5">✏</button>
      )}
    </span>
  )
}

// ── Formulario de pago ────────────────────────────────────────────────────────
function FormPago({ oc, saldoOC, onClose }) {
  const registrar = useRegistrarPago()
  const total = parseFloat(oc.cotizaciones?.total ?? 0)
  const [tipo,  setTipo]  = useState('parcial')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [nota,  setNota]  = useState('')
  const [err,   setErr]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    const montoN = parseFloat(monto)
    if (!montoN || montoN <= 0) { setErr('Ingresá un monto válido'); return }
    try {
      await registrar.mutateAsync({ ocId: oc.id, tipo, monto: montoN, fecha, nota, totalOC: total })
      onClose()
    } catch (ex) { setErr(ex.message) }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2 mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={tipo} onChange={e => setTipo(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#004a99]">
          <option value="anticipo">Anticipo</option>
          <option value="parcial">Pago parcial</option>
          <option value="total">Pago total</option>
        </select>
        <input type="number" placeholder={`Monto (saldo: ${fmtMoneda(saldoOC)})`}
          value={monto} onChange={e => setMonto(e.target.value)} min="0.01" step="0.01"
          className="w-52 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#004a99]"/>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#004a99]"/>
        <input type="text" placeholder="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)}
          className="flex-1 min-w-32 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#004a99]"/>
      </div>
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
        <button type="submit" disabled={registrar.isPending}
          className="text-xs bg-[#004a99] text-white px-3 py-1.5 rounded hover:bg-[#003d80] disabled:opacity-60">
          {registrar.isPending ? 'Guardando…' : 'Guardar pago'}
        </button>
      </div>
    </form>
  )
}

// ── Panel de pagos por OC ─────────────────────────────────────────────────────
function PagosPanel({ oc, ocPagos, puedeCambiar }) {
  const [showForm, setShowForm] = useState(false)
  const total = parseFloat(oc.cotizaciones?.total ?? 0)
  const totalPagado = ocPagos.reduce((s, p) => s + parseFloat(p.monto), 0)
  const saldo = total - totalPagado

  return (
    <div className="py-2 px-2 space-y-1.5">
      {ocPagos.length > 0 ? (
        <div className="space-y-1">
          {ocPagos.map(p => {
            const cfg = TIPO_PAGO_CONFIG[p.tipo] ?? TIPO_PAGO_CONFIG.parcial
            return (
              <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-gray-400 w-20 flex-shrink-0">{fmtFecha(p.fecha)}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${cfg.cls}`}>
                  {cfg.label}
                </span>
                <span className="font-semibold text-gray-900">{fmtMoneda(p.monto)}</span>
                {p.nota && <span className="text-gray-400 italic truncate">"{p.nota}"</span>}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 italic">Sin pagos registrados</p>
      )}

      {puedeCambiar && saldo > 0.01 && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="text-[10px] font-semibold text-[#004a99] hover:underline">
          + Registrar pago
        </button>
      )}
      {showForm && <FormPago oc={oc} saldoOC={saldo} onClose={() => setShowForm(false)}/>}
    </div>
  )
}

// ── Fila de pago (badge / selector estado) ────────────────────────────────────
function FilaPago({ oc }) {
  const cfg = PAGO_CONFIG[oc.estado_pago] ?? PAGO_CONFIG.pendiente
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Fila de cliente ───────────────────────────────────────────────────────────
function FilaCliente({ cliente, puedeCambiar, comprobanteMap, pagosByOcId }) {
  const [expandido,  setExpandido]  = useState(false)
  const [ocExpandida, setOcExpandida] = useState(null)

  const ocsConFactura = cliente.ocs.filter(oc => oc.numero_factura)

  const totalFacturado = ocsConFactura.reduce(
    (s, oc) => s + parseFloat(oc.cotizaciones?.total ?? 0), 0
  )
  const totalPagado = cliente.ocs.reduce((s, oc) => {
    return s + (pagosByOcId[oc.id] ?? []).reduce((ss, p) => ss + parseFloat(p.monto), 0)
  }, 0)
  const saldoPendiente = Math.max(totalFacturado - totalPagado, 0)
  const tieneDeuda = saldoPendiente > 0.01

  return (
    <>
      {/* Fila resumen cliente */}
      <tr
        onClick={() => setExpandido(v => !v)}
        className={`cursor-pointer hover:bg-gray-50 transition-colors ${tieneDeuda ? 'bg-red-50/30' : ''}`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${expandido ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
            <span className="font-medium text-gray-900">{cliente.razon_social}</span>
            {tieneDeuda && (
              <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                Deuda pendiente
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-gray-700">{fmtMoneda(totalFacturado)}</td>
        <td className="px-4 py-3 text-right text-[#28a745] font-medium">{fmtMoneda(totalPagado)}</td>
        <td className="px-4 py-3 text-right">
          <span className={`font-semibold ${saldoPendiente > 0 ? 'text-[#dc3545]' : 'text-gray-400'}`}>
            {fmtMoneda(saldoPendiente)}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-gray-400 text-xs" colSpan={2}>
          {ocsConFactura.length} factura{ocsConFactura.length !== 1 ? 's' : ''}
        </td>
      </tr>

      {/* Filas expandidas por OC */}
      {expandido && ocsConFactura.map(oc => {
        const comprobante  = comprobanteMap?.[oc.id]
        const ocPagos      = pagosByOcId[oc.id] ?? []
        const totalPagadoOC = ocPagos.reduce((s, p) => s + parseFloat(p.monto), 0)
        const saldoOC      = parseFloat(oc.cotizaciones?.total ?? 0) - totalPagadoOC
        const expanded     = ocExpandida === oc.id

        return (
          <>
            <tr key={oc.id} className="bg-gray-50/60 border-l-2 border-[#004a99]/20">
              <td className="pl-10 pr-4 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOcExpandida(expanded ? null : oc.id)}
                    className="text-gray-400 hover:text-[#004a99] transition-colors">
                    <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">#{oc.numero}</span>
                      {oc.numero_factura && (
                        <span className="font-mono text-[10px] text-gray-400">{oc.numero_factura}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-400">{fmtFecha(oc.creado_en)}</span>
                      <VencimientoInline oc={oc} puedeCambiar={puedeCambiar}/>
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-gray-700">
                {fmtMoneda(oc.cotizaciones?.total)}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-[#28a745] font-medium">
                {totalPagadoOC > 0 ? fmtMoneda(totalPagadoOC) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right text-sm">
                <span className={saldoOC > 0.01 ? 'text-[#dc3545] font-semibold' : 'text-gray-400'}>
                  {fmtMoneda(saldoOC)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                {comprobante
                  ? <a href={comprobante.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 hover:underline">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      Ver comprobante
                    </a>
                  : <span className="text-[10px] text-gray-300">Sin comprobante</span>
                }
              </td>
              <td className="px-4 py-2.5 text-right">
                <FilaPago oc={oc}/>
              </td>
            </tr>

            {/* Sub-fila de pagos */}
            {expanded && (
              <tr key={`${oc.id}-pagos`} className="bg-blue-50/40 border-l-2 border-[#004a99]/20">
                <td colSpan={6} className="pl-16 pr-4 py-1">
                  <PagosPanel oc={oc} ocPagos={ocPagos} puedeCambiar={puedeCambiar}/>
                </td>
              </tr>
            )}
          </>
        )
      })}

      {expandido && ocsConFactura.length === 0 && (
        <tr className="bg-gray-50/60">
          <td colSpan={6} className="pl-10 py-2 text-xs text-gray-400 italic">
            Sin facturas emitidas para este cliente
          </td>
        </tr>
      )}
    </>
  )
}

// ── Análisis de antigüedad ────────────────────────────────────────────────────
function BloqueAntigüedad({ label, monto, cls }) {
  return (
    <div className={`flex-1 min-w-28 rounded-lg border px-4 py-3 text-center ${cls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-base font-bold mt-0.5">{fmtMoneda(monto)}</p>
    </div>
  )
}

function AnálisisAntigüedad({ clientes, pagosByOcId }) {
  const hoy = new Date()
  const buckets = { corriente: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }

  for (const c of clientes) {
    for (const oc of c.ocs) {
      if (!oc.numero_factura) continue
      const total = parseFloat(oc.cotizaciones?.total ?? 0)
      const cobrado = (pagosByOcId[oc.id] ?? []).reduce((s, p) => s + parseFloat(p.monto), 0)
      const saldo = total - cobrado
      if (saldo <= 0.01) continue

      const vto = oc.fecha_vencimiento_factura
      if (!vto) { buckets.corriente += saldo; continue }
      const dias = Math.floor((hoy - new Date(vto + 'T00:00:00')) / 86400000)
      if (dias <= 0)  buckets.corriente += saldo
      else if (dias <= 30) buckets.d1_30   += saldo
      else if (dias <= 60) buckets.d31_60  += saldo
      else if (dias <= 90) buckets.d61_90  += saldo
      else                 buckets.d90plus += saldo
    }
  }

  const hayVencidas = buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90plus > 0
  if (!hayVencidas && buckets.corriente === 0) return null

  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Antigüedad de deuda
      </p>
      <div className="flex gap-2 flex-wrap">
        <BloqueAntigüedad label="Corriente / Sin vto." monto={buckets.corriente}
          cls="bg-gray-50 border-gray-200 text-gray-700"/>
        <BloqueAntigüedad label="1 – 30 días" monto={buckets.d1_30}
          cls={buckets.d1_30 > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-gray-50 border-gray-200 text-gray-400'}/>
        <BloqueAntigüedad label="31 – 60 días" monto={buckets.d31_60}
          cls={buckets.d31_60 > 0 ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-gray-50 border-gray-200 text-gray-400'}/>
        <BloqueAntigüedad label="61 – 90 días" monto={buckets.d61_90}
          cls={buckets.d61_90 > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-400'}/>
        <BloqueAntigüedad label="Más de 90 días" monto={buckets.d90plus}
          cls={buckets.d90plus > 0 ? 'bg-red-100 border-red-300 text-red-800 font-bold' : 'bg-gray-50 border-gray-200 text-gray-400'}/>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EstadoCuenta() {
  const { data: clientes = [], isLoading } = useEstadoCuenta()
  const { isFinanzas } = useAuth()
  const [busqueda,  setBusqueda]  = useState('')
  const [soloDeuda, setSoloDeuda] = useState(false)

  const todosOcIds = clientes.flatMap(c => c.ocs.map(o => o.id))
  const { data: comprobantes = [] } = useComprobantesOC(todosOcIds)
  const { data: pagos        = [] } = usePagosOC(todosOcIds)

  const comprobanteMap = Object.fromEntries(comprobantes.map(c => [c.oc_id, c]))
  const pagosByOcId    = pagos.reduce((acc, p) => {
    if (!acc[p.oc_id]) acc[p.oc_id] = []
    acc[p.oc_id].push(p)
    return acc
  }, {})

  // Recalcular saldos reales usando pagos
  const clientesConSaldo = clientes.map(c => {
    const ocsConFactura = c.ocs.filter(oc => oc.numero_factura)
    const totalFacturado = ocsConFactura.reduce((s, oc) => s + parseFloat(oc.cotizaciones?.total ?? 0), 0)
    const totalPagado    = c.ocs.reduce((s, oc) =>
      s + (pagosByOcId[oc.id] ?? []).reduce((ss, p) => ss + parseFloat(p.monto), 0), 0)
    const saldoPendiente = Math.max(totalFacturado - totalPagado, 0)
    return { ...c, totalFacturado, totalPagado, saldoPendiente, tieneDeuda: saldoPendiente > 0.01 }
  })

  const filtrados = clientesConSaldo
    .filter(c => !soloDeuda || c.tieneDeuda)
    .filter(c => !busqueda.trim() || c.razon_social?.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => b.saldoPendiente - a.saldoPendiente)

  const totalDeudores = clientesConSaldo.filter(c => c.tieneDeuda).length
  const saldoTotal    = clientesConSaldo.reduce((s, c) => s + c.saldoPendiente, 0)

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

      {/* Análisis por antigüedad (solo finanzas) */}
      {isFinanzas && !isLoading && (
        <AnálisisAntigüedad clientes={clientes} pagosByOcId={pagosByOcId}/>
      )}

      {/* Alerta deudores */}
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
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente / OC</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-36">Facturado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Cobrado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Saldo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-36">Comprobante</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(c => (
                <FilaCliente key={c.id} cliente={c} puedeCambiar={!!isFinanzas}
                  comprobanteMap={comprobanteMap} pagosByOcId={pagosByOcId}/>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isFinanzas && (
        <p className="text-xs text-gray-400 mt-3">
          Vista de solo lectura. El equipo de Finanzas gestiona el estado de pagos.
        </p>
      )}
    </div>
  )
}
