import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { fmtFecha } from '../../utils/calc'

const db = supabaseAdmin ?? supabase

function useStockVendedor() {
  return useQuery({
    queryKey: ['vendedor', 'stock'],
    queryFn: async () => {
      const { data, error } = await db
        .from('productos')
        .select('id, codigo, nombre, presentacion, ficha_tecnica_url, tds_url, hoja_seguridad_url, stock_actual(cantidad)')
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60,
  })
}

function useMovimientos(productoId) {
  return useQuery({
    queryKey: ['vendedor', 'movimientos', productoId],
    enabled:  !!productoId,
    queryFn: async () => {
      const [{ data: rec }, { data: prod }] = await Promise.all([
        db.from('recepciones_mercaderia')
          .select('id, cantidad, fecha_recepcion, numero_lote, fecha_vencimiento, coa_url, creado_en')
          .eq('producto_id', productoId)
          .order('creado_en', { ascending: false }),
        db.from('producciones')
          .select('id, cantidad, fecha_produccion, numero_lote, fecha_vencimiento, coa_url, creado_en')
          .eq('producto_id', productoId)
          .order('creado_en', { ascending: false }),
      ])
      return [
        ...(rec  ?? []).map(r => ({ ...r, tipo: 'recepcion',  fecha: r.fecha_recepcion })),
        ...(prod ?? []).map(p => ({ ...p, tipo: 'produccion', fecha: p.fecha_produccion })),
      ].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
    },
    staleTime: 1000 * 60,
  })
}

function estaVencido(fecha) {
  return fecha && new Date(fecha + 'T00:00:00') < new Date()
}

function PanelDetalle({ producto, onClose }) {
  const sa = Array.isArray(producto.stock_actual) ? producto.stock_actual[0] : producto.stock_actual
  const { data: movimientos = [], isLoading } = useMovimientos(producto.id)

  const hayVencidos = movimientos.some(m => estaVencido(m.fecha_vencimiento))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900 text-base leading-tight">{producto.nombre}</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {producto.codigo && <span className="font-mono text-xs text-gray-400">{producto.codigo}</span>}
            {producto.presentacion && <span className="text-xs text-gray-400">{producto.presentacion}</span>}
            {hayVencidos && (
              <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                Lotes vencidos
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Stock actual</p>
            <p className={`text-xl font-bold ${!sa?.cantidad ? 'text-[#dc3545]' : 'text-[#28a745]'}`}>
              {sa?.cantidad ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1">kg/lt</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Documentos del producto */}
      {(producto.ficha_tecnica_url || producto.tds_url || producto.hoja_seguridad_url) && (
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Docs</span>
          {producto.ficha_tecnica_url && (
            <a href={producto.ficha_tecnica_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:opacity-80">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              Ficha Técnica
            </a>
          )}
          {producto.tds_url && (
            <a href={producto.tds_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:opacity-80">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              TDS
            </a>
          )}
          {producto.hoja_seguridad_url && (
            <a href={producto.hoja_seguridad_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:opacity-80">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              Hoja de Seguridad
            </a>
          )}
        </div>
      )}

      {/* Movimientos */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Historial de lotes
          </p>
          {movimientos.length > 0 && (
            <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full font-medium">
              {movimientos.length}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        )}

        {!isLoading && movimientos.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">Sin lotes registrados</div>
        )}

        {!isLoading && movimientos.length > 0 && (
          <div className="divide-y divide-gray-50">
            {movimientos.map(m => {
              const vencido = estaVencido(m.fecha_vencimiento)
              return (
                <div key={`${m.tipo}-${m.id}`} className={`px-5 py-3 hover:bg-gray-50 ${vencido ? 'bg-red-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`mt-0.5 flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        m.tipo === 'recepcion'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {m.tipo === 'recepcion' ? 'Recepción' : 'Producción'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{m.cantidad} kg/lt</span>
                          <span className="text-xs text-gray-400">{fmtFecha(m.fecha)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {m.numero_lote && (
                            <span className="font-mono text-xs text-gray-500">Lote: {m.numero_lote}</span>
                          )}
                          {m.fecha_vencimiento && (
                            <span className={`text-xs font-medium ${vencido ? 'text-red-600' : 'text-gray-400'}`}>
                              Vto: {fmtFecha(m.fecha_vencimiento)}
                              {vencido && (
                                <span className="ml-1 bg-red-100 text-red-600 text-[10px] px-1 py-0.5 rounded-full">Vencido</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {m.coa_url && (
                      <a href={m.coa_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-[#004a99] hover:underline">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                        </svg>
                        COA
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StockVendedor() {
  const { data: productos = [], isLoading } = useStockVendedor()
  const [busqueda,     setBusqueda]     = useState('')
  const [seleccionado, setSeleccionado] = useState(null)

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return q
      ? productos.filter(p =>
          p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
        )
      : productos
  }, [productos, busqueda])

  const prodSel = seleccionado
    ? (productos.find(p => p.id === seleccionado.id) ?? seleccionado)
    : null

  return (
    <div className="p-6 h-full">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Stock</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {prodSel
            ? 'Lotes y vencimientos del producto seleccionado'
            : 'Clic en un producto para ver sus lotes y vencimientos'}
        </p>
      </div>

      <div className={`flex gap-5 ${prodSel ? 'items-start' : ''}`}>

        {/* ── Lista ──────────────────────────────────────────────────── */}
        <div className={prodSel ? 'w-[440px] flex-shrink-0' : 'flex-1'}>
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"
            />
          </div>

          <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
            {isLoading
              ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
              : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {!prodSel && <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Código</th>}
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Producto</th>
                    {!prodSel && <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Presentación</th>}
                    <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrados.map(p => {
                    const sa     = Array.isArray(p.stock_actual) ? p.stock_actual[0] : p.stock_actual
                    const activo = prodSel?.id === p.id
                    return (
                      <tr key={p.id}
                        onClick={() => setSeleccionado(activo ? null : p)}
                        className={`cursor-pointer transition-colors ${activo ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        {!prodSel && <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{p.codigo || '—'}</td>}
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{p.nombre}</p>
                          {prodSel && p.codigo && <p className="font-mono text-[10px] text-gray-400">{p.codigo}</p>}
                        </td>
                        {!prodSel && <td className="px-4 py-2.5 text-gray-500 text-xs">{p.presentacion || '—'}</td>}
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-medium ${!sa?.cantidad ? 'text-[#dc3545]' : 'text-[#28a745]'}`}>
                            {sa?.cantidad ?? 0}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {filtrados.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                        Sin resultados para "{busqueda}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Detalle ────────────────────────────────────────────────── */}
        {prodSel && (
          <div
            className="flex-1 bg-white rounded-[10px] shadow-card overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            <PanelDetalle producto={prodSel} onClose={() => setSeleccionado(null)} />
          </div>
        )}
      </div>
    </div>
  )
}
