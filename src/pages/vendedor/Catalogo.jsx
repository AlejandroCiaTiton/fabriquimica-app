import { useState, useMemo } from 'react'
import { useProductos } from '../../hooks/useProductos'

const LISTAS = [
  { key: 'lista1_may', label: 'MAY', title: 'Mayorista' },
  { key: 'lista4_std', label: 'STD', title: 'Estándar' },
  { key: 'lista3_min', label: 'MIN', title: 'Minorista' },
]

function getPrecio(producto, listaKey) {
  const precios = Array.isArray(producto.precios_actuales)
    ? producto.precios_actuales[0]
    : producto.precios_actuales
  return precios?.[listaKey] ?? null
}

function getStock(producto) {
  const s = Array.isArray(producto.stock_actual)
    ? producto.stock_actual[0]
    : producto.stock_actual
  return s?.cantidad ?? null
}

function formatUSD(val) {
  if (val == null) return <span className="text-gray-300">—</span>
  return (
    <span>
      <span className="text-gray-400 text-xs mr-0.5">USD</span>
      {Number(val).toFixed(2)}
    </span>
  )
}

export default function Catalogo() {
  const { data: productos = [], isLoading, error } = useProductos()
  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState('lista4_std')

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return productos
    return productos.filter(p =>
      p.nombre?.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) ||
      p.presentacion?.toLowerCase().includes(q)
    )
  }, [productos, busqueda])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Catálogo de Productos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isLoading ? 'Cargando…' : `${filtrados.length} productos${busqueda ? ` de ${productos.length}` : ''}`}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#004a99] focus:border-transparent"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Chips de lista de precios */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {LISTAS.map(l => (
            <button
              key={l.key}
              onClick={() => setLista(l.key)}
              title={l.title}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                lista === l.key
                  ? 'bg-[#004a99] text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {error && (
          <div className="p-6 text-center text-[#dc3545] text-sm">
            Error al cargar productos: {error.message}
          </div>
        )}

        {isLoading && (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Cargando catálogo…</p>
          </div>
        )}

        {!isLoading && !error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-40">Presentación</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">
                  {LISTAS.find(l => l.key === lista)?.title}
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    No se encontraron productos para "{busqueda}"
                  </td>
                </tr>
              ) : (
                filtrados.map(p => {
                  const stock = getStock(p)
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.codigo}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-500">{p.presentacion || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                        {formatUSD(getPrecio(p, lista))}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {stock == null ? (
                          <span className="text-gray-300">—</span>
                        ) : stock === 0 ? (
                          <span className="text-[#dc3545] text-xs font-medium">Sin stock</span>
                        ) : (
                          <span className="text-[#28a745] text-xs font-medium">{stock}</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
