import { useState, useMemo, Fragment } from 'react'
import { useHistoricoCompras } from '../../hooks/useComercial'
import { fmtFecha } from '../../utils/calc'

const ESTADO_LABEL = {
  'recibida':       { label: 'Recibida',       cls: 'bg-blue-100 text-blue-700'    },
  'en-preparacion': { label: 'En preparación', cls: 'bg-yellow-100 text-yellow-700' },
  'listo-entrega':  { label: 'Listo',          cls: 'bg-green-100 text-green-700'  },
  'entregada':      { label: 'Entregada',      cls: 'bg-gray-100 text-gray-600'    },
}

const PAGO_LABEL = {
  pendiente: { label: 'Pago pendiente', cls: 'bg-red-100 text-red-700'      },
  parcial:   { label: 'Parcial',        cls: 'bg-yellow-100 text-yellow-800' },
  pagado:    { label: 'Pagado',         cls: 'bg-green-100 text-green-700'   },
}

const ESTADO_TABS = [
  ['todas',          'Todas'],
  ['recibida',       'Recibidas'],
  ['en-preparacion', 'En preparación'],
  ['listo-entrega',  'Listas'],
  ['entregada',      'Entregadas'],
]

function fmtMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0)
}

function Chevron({ open }) {
  return (
    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
    </svg>
  )
}

// ── Vista: lista plana de órdenes ─────────────────────────────────────────────

function VistaOrdenes({ ordenes }) {
  const [expandida, setExpandida] = useState(null)

  if (ordenes.length === 0)
    return <div className="p-12 text-center text-sm text-gray-400">Sin órdenes para estos filtros</div>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="w-8 px-3"/>
          <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Orden</th>
          <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
          <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Vendedor</th>
          <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Fecha</th>
          <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total</th>
          <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Estado</th>
          <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Pago</th>
          <th className="text-left px-4 py-3 font-medium text-gray-500 w-36">Factura</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {ordenes.map(oc => {
          const cliente   = oc.cotizaciones?.clientes?.razon_social ?? '—'
          const vendedor  = oc.cotizaciones?.vendedores?.perfiles?.nombre ?? '—'
          const estadoCfg = ESTADO_LABEL[oc.estado] ?? { label: oc.estado, cls: 'bg-gray-100 text-gray-500' }
          const pagoCfg   = PAGO_LABEL[oc.estado_pago]
          const items     = oc.cotizaciones?.cotizacion_items ?? []
          const abierta   = expandida === oc.id

          return (
            <Fragment key={oc.id}>
              <tr
                className={`cursor-pointer transition-colors ${abierta ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => setExpandida(abierta ? null : oc.id)}
              >
                <td className="px-3 py-3"><Chevron open={abierta}/></td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-[#004a99]">#{oc.numero}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{cliente}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{vendedor}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtFecha(oc.creado_en)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">{fmtMoneda(oc.cotizaciones?.total)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoCfg.cls}`}>
                    {estadoCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {pagoCfg
                    ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pagoCfg.cls}`}>{pagoCfg.label}</span>
                    : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {oc.numero_factura || <span className="text-gray-300">—</span>}
                </td>
              </tr>

              {abierta && items.length > 0 && (
                <tr className="bg-blue-50/50">
                  <td colSpan={9} className="px-6 pb-3 pt-0">
                    <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-white border-b border-gray-100">
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Producto</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 w-20">Código</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500 w-20">Cantidad</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 w-36">Lote</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {items.map(it => (
                          <tr key={it.id}>
                            <td className="px-3 py-2 font-medium text-gray-800">{it.productos?.nombre ?? '—'}</td>
                            <td className="px-3 py-2 font-mono text-gray-400">{it.productos?.codigo || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{it.cantidad}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">
                              {it.lote_aplicado || <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Vista: agrupado por cliente ───────────────────────────────────────────────

function VistaPorCliente({ ordenes, busqueda }) {
  const [expandido, setExpandido] = useState(null)

  const porCliente = useMemo(() => {
    const map = {}
    for (const oc of ordenes) {
      const c = oc.cotizaciones?.clientes
      if (!c) continue
      if (!map[c.id]) map[c.id] = { id: c.id, razon_social: c.razon_social, totalMonto: 0, ocs: [] }
      map[c.id].totalMonto += parseFloat(oc.cotizaciones?.total) || 0
      map[c.id].ocs.push(oc)
    }
    return Object.values(map).sort((a, b) => a.razon_social.localeCompare(b.razon_social))
  }, [ordenes])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return porCliente
    return porCliente.filter(c => c.razon_social.toLowerCase().includes(q))
  }, [porCliente, busqueda])

  if (filtrados.length === 0)
    return <div className="p-12 text-center text-sm text-gray-400">Sin clientes para este filtro</div>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="w-8 px-3"/>
          <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
          <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">Órdenes</th>
          <th className="text-right px-4 py-3 font-medium text-gray-500 w-36">Total comprado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {filtrados.map(cli => {
          const abierto = expandido === cli.id

          const productosMap = {}
          for (const oc of cli.ocs) {
            for (const it of oc.cotizaciones?.cotizacion_items ?? []) {
              const key = it.productos?.id ?? it.productos?.nombre
              if (!key) continue
              if (!productosMap[key]) productosMap[key] = {
                nombre: it.productos?.nombre ?? '—',
                codigo: it.productos?.codigo,
                cantidad: 0,
              }
              productosMap[key].cantidad += it.cantidad ?? 0
            }
          }
          const productos = Object.values(productosMap).sort((a, b) => a.nombre.localeCompare(b.nombre))

          return (
            <Fragment key={cli.id}>
              <tr
                className={`cursor-pointer transition-colors ${abierto ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => setExpandido(abierto ? null : cli.id)}
              >
                <td className="px-3 py-3"><Chevron open={abierto}/></td>
                <td className="px-4 py-3 font-medium text-gray-900">{cli.razon_social}</td>
                <td className="px-4 py-3 text-right text-gray-500">{cli.ocs.length}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">{fmtMoneda(cli.totalMonto)}</td>
              </tr>

              {abierto && (
                <tr className="bg-blue-50/50">
                  <td colSpan={4} className="px-6 pb-3 pt-0">
                    <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-white border-b border-gray-100">
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Producto</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">Código</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500 w-36">Total comprado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {productos.length === 0
                          ? <tr><td colSpan={3} className="px-3 py-3 text-center text-gray-300">Sin productos</td></tr>
                          : productos.map((p, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 font-medium text-gray-800">{p.nombre}</td>
                              <td className="px-3 py-2 font-mono text-gray-400">{p.codigo || '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{p.cantidad} kg/lt</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Vista: agrupado por producto ──────────────────────────────────────────────

function VistaPorProducto({ ordenes, busqueda }) {
  const [expandido, setExpandido] = useState(null)

  const porProducto = useMemo(() => {
    const map = {}
    for (const oc of ordenes) {
      const cliente = oc.cotizaciones?.clientes?.razon_social ?? '—'
      for (const it of oc.cotizaciones?.cotizacion_items ?? []) {
        const p = it.productos
        if (!p) continue
        const key = p.id ?? p.nombre
        if (!map[key]) map[key] = {
          id: p.id,
          nombre: p.nombre ?? '—',
          codigo: p.codigo,
          totalCantidad: 0,
          clientesSet: new Set(),
          compras: [],
        }
        map[key].totalCantidad += it.cantidad ?? 0
        map[key].clientesSet.add(cliente)
        map[key].compras.push({
          cliente,
          cantidad:   it.cantidad,
          lote:       it.lote_aplicado,
          oc_numero:  oc.numero,
          fecha:      oc.creado_en,
          estado:     oc.estado,
        })
      }
    }
    return Object.values(map)
      .map(p => ({ ...p, nClientes: p.clientesSet.size }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [ordenes])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return porProducto
    return porProducto.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q)
    )
  }, [porProducto, busqueda])

  if (filtrados.length === 0)
    return <div className="p-12 text-center text-sm text-gray-400">Sin productos para este filtro</div>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="w-8 px-3"/>
          <th className="text-left px-4 py-3 font-medium text-gray-500">Producto</th>
          <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Código</th>
          <th className="text-right px-4 py-3 font-medium text-gray-500 w-36">Total vendido</th>
          <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">Clientes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {filtrados.map(prod => {
          const key     = prod.id ?? prod.nombre
          const abierto = expandido === key

          return (
            <Fragment key={key}>
              <tr
                className={`cursor-pointer transition-colors ${abierto ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => setExpandido(abierto ? null : key)}
              >
                <td className="px-3 py-3"><Chevron open={abierto}/></td>
                <td className="px-4 py-3 font-medium text-gray-900">{prod.nombre}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{prod.codigo || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-700">{prod.totalCantidad} kg/lt</td>
                <td className="px-4 py-3 text-right text-gray-500">{prod.nClientes}</td>
              </tr>

              {abierto && (
                <tr className="bg-blue-50/50">
                  <td colSpan={5} className="px-6 pb-3 pt-0">
                    <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-white border-b border-gray-100">
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Cliente</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500 w-20">Cantidad</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">Orden</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">Fecha</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 w-28">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {prod.compras.map((c, i) => {
                          const estadoCfg = ESTADO_LABEL[c.estado] ?? { label: c.estado, cls: 'bg-gray-100 text-gray-500' }
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2 font-medium text-gray-800">{c.cliente}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{c.cantidad} kg/lt</td>
                              <td className="px-3 py-2 font-mono text-[#004a99]">#{c.oc_numero}</td>
                              <td className="px-3 py-2 text-gray-500">{fmtFecha(c.fecha)}</td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${estadoCfg.cls}`}>
                                  {estadoCfg.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function HistoricoCompras() {
  const { data: ordenes = [], isLoading, error } = useHistoricoCompras()
  const [busqueda,  setBusqueda]  = useState('')
  const [vista,     setVista]     = useState('ordenes')
  const [estadoTab, setEstadoTab] = useState('todas')

  const ordenesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return ordenes.filter(oc => {
      if (estadoTab !== 'todas' && oc.estado !== estadoTab) return false
      if (!q) return true
      const cliente = oc.cotizaciones?.clientes?.razon_social?.toLowerCase() ?? ''
      const nro     = oc.numero?.toString() ?? ''
      return cliente.includes(q) || nro.includes(q)
    })
  }, [ordenes, busqueda, estadoTab])

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Histórico de compras</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? 'Cargando…' : `${ordenes.length} órdenes en total`}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Selector de vista */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[['ordenes', 'Órdenes'], ['clientes', 'Por cliente'], ['productos', 'Por producto']].map(([v, l]) => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                vista === v ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder={
              vista === 'productos' ? 'Buscar por producto…' :
              vista === 'clientes'  ? 'Buscar por cliente…' :
              'Buscar por cliente o N° orden…'
            }
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
        </div>

        {/* Tabs de estado — sólo en vista Órdenes */}
        {vista === 'ordenes' && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
            {ESTADO_TABS.map(([val, lbl]) => (
              <button key={val} onClick={() => setEstadoTab(val)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  estadoTab === val ? 'bg-white text-[#004a99] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {lbl}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-mono">
          Error: {error.message}
        </div>
      )}

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : vista === 'ordenes'
            ? <VistaOrdenes ordenes={ordenesFiltradas} />
            : vista === 'clientes'
            ? <VistaPorCliente ordenes={ordenes} busqueda={busqueda} />
            : <VistaPorProducto ordenes={ordenes} busqueda={busqueda} />
        }
      </div>
    </div>
  )
}
