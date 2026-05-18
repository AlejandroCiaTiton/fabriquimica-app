import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Hooks ────────────────────────────────────────────────────────────────────

function useStockAdmin() {
  return useQuery({
    queryKey: ['admin', 'stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, codigo, nombre, presentacion, stock_actual(cantidad)')
        .order('nombre')
      if (error) throw error
      return data
    },
    staleTime: 0,
  })
}

function useActualizarStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productoId, cantidad }) => {
      const { error } = await supabase.from('stock_actual')
        .upsert({ producto_id: productoId, cantidad: parseFloat(cantidad) || 0 }, { onConflict: 'producto_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'stock'] }),
  })
}

function useMovimientos(productoId) {
  return useQuery({
    queryKey: ['admin', 'movimientos', productoId],
    enabled:  !!productoId,
    queryFn: async () => {
      const [{ data: rec }, { data: prod }] = await Promise.all([
        supabase.from('recepciones_mercaderia')
          .select('id, cantidad, fecha_recepcion, numero_lote, fecha_vencimiento, coa_url, creado_en')
          .eq('producto_id', productoId)
          .order('creado_en', { ascending: false }),
        supabase.from('producciones')
          .select('id, cantidad, fecha_produccion, numero_lote, fecha_vencimiento, coa_url, creado_en')
          .eq('producto_id', productoId)
          .order('creado_en', { ascending: false }),
      ])
      const movs = [
        ...(rec  ?? []).map(r => ({ ...r, tipo: 'recepcion',  fecha: r.fecha_recepcion })),
        ...(prod ?? []).map(p => ({ ...p, tipo: 'produccion', fecha: p.fecha_produccion })),
      ].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
      return movs
    },
    staleTime: 0,
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsearCSV(texto) {
  const lines   = texto.trim().split('\n')
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
  const codIdx  = headers.findIndex(h => ['cod','codigo','code'].includes(h))
  const cantIdx = headers.findIndex(h => ['cantidad','stock','qty','cant'].includes(h))
  if (codIdx === -1 || cantIdx === -1) return null
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
    return { codigo: cols[codIdx], cantidad: parseFloat(cols[cantIdx]) || 0 }
  }).filter(r => r.codigo)
}

function fmtFecha(str) {
  if (!str) return '—'
  return new Date(str + 'T00:00:00').toLocaleDateString('es-AR')
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StockCell({ productoId, cantidad }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(cantidad ?? 0)
  const actualizar            = useActualizarStock()

  function handleBlur() {
    setEditing(false)
    if (parseFloat(val) !== parseFloat(cantidad ?? 0))
      actualizar.mutate({ productoId, cantidad: val })
  }

  if (editing) return (
    <input type="number" min="0" step="1" value={val} autoFocus
      onChange={e => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => e.key === 'Enter' && handleBlur()}
      className="w-20 text-right text-sm border border-[#004a99] rounded px-2 py-0.5 focus:outline-none"
    />
  )

  return (
    <span onClick={e => { e.stopPropagation(); setEditing(true); setVal(cantidad ?? 0) }}
      title="Clic para editar"
      className={`cursor-pointer hover:bg-blue-50 px-2 py-0.5 rounded block text-right font-medium ${
        cantidad == null || cantidad === 0 ? 'text-[#dc3545]' : 'text-[#28a745]'
      }`}>
      {cantidad ?? 0}
    </span>
  )
}

function PanelDetalle({ producto, onClose }) {
  const sa  = Array.isArray(producto.stock_actual) ? producto.stock_actual[0] : producto.stock_actual
  const { data: movimientos = [], isLoading } = useMovimientos(producto.id)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-bold text-gray-900 text-base">{producto.nombre}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            {producto.codigo && <span className="font-mono text-xs text-gray-400">{producto.codigo}</span>}
            {producto.presentacion && <span className="text-xs text-gray-400">{producto.presentacion}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Stock actual</p>
            <p className={`text-xl font-bold ${!sa?.cantidad ? 'text-[#dc3545]' : 'text-[#28a745]'}`}>
              {sa?.cantidad ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1">kg/lt</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Movimientos */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Historial de lotes
            {movimientos.length > 0 && <span className="ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full normal-case font-medium">{movimientos.length}</span>}
          </p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
          </div>
        )}

        {!isLoading && movimientos.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">Sin movimientos registrados</div>
        )}

        {!isLoading && movimientos.length > 0 && (
          <div className="divide-y divide-gray-50">
            {movimientos.map((m, i) => (
              <div key={`${m.tipo}-${m.id}`} className="px-5 py-3 hover:bg-gray-50">
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
                          <span className={`text-xs ${new Date(m.fecha_vencimiento + 'T00:00:00') < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            Vto: {fmtFecha(m.fecha_vencimiento)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Stock() {
  const { data: productos = [], isLoading } = useStockAdmin()
  const actualizar = useActualizarStock()
  const qc         = useQueryClient()

  const [busqueda,    setBusqueda]    = useState('')
  const [csvStatus,   setCsvStatus]   = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return q ? productos.filter(p =>
      p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
    ) : productos
  }, [productos, busqueda])

  // Sync selected product data when cache refreshes
  const prodSel = seleccionado
    ? (productos.find(p => p.id === seleccionado.id) ?? seleccionado)
    : null

  async function handleCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const texto = await file.text()
    const rows  = parsearCSV(texto)
    if (!rows) { setCsvStatus('Error: el CSV debe tener columnas "codigo" y "cantidad"'); return }

    let ok = 0, err = 0
    for (const row of rows) {
      const prod = productos.find(p => p.codigo === row.codigo)
      if (!prod) { err++; continue }
      const sa = Array.isArray(prod.stock_actual) ? prod.stock_actual[0] : prod.stock_actual
      await actualizar.mutateAsync({ productoId: prod.id, cantidad: row.cantidad })
      ok++
    }
    qc.invalidateQueries({ queryKey: ['admin', 'stock'] })
    setCsvStatus(`✓ ${ok} productos actualizados${err > 0 ? ` · ${err} códigos no encontrados` : ''}`)
    e.target.value = ''
  }

  return (
    <div className="p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {seleccionado ? 'Clic en un producto para ver su historial' : 'Clic en la cantidad para editar · Clic en el nombre para ver historial'}
          </p>
        </div>
        <label className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Importar CSV
          <input type="file" accept=".csv,.txt" className="sr-only" onChange={handleCSV}/>
        </label>
      </div>

      {csvStatus && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${csvStatus.startsWith('✓') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {csvStatus}
        </div>
      )}

      <div className={`flex gap-5 ${prodSel ? 'items-start' : ''}`}>

        {/* ── Lista ─────────────────────────────────────────────────────── */}
        <div className={prodSel ? 'w-[480px] flex-shrink-0' : 'flex-1'}>
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"/>
          </div>

          {!prodSel && (
            <p className="text-xs text-gray-400 mb-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
              CSV formato: <code className="text-gray-600">codigo,cantidad</code> — Primera fila = encabezado
            </p>
          )}

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
                    const sa    = Array.isArray(p.stock_actual) ? p.stock_actual[0] : p.stock_actual
                    const activo = prodSel?.id === p.id
                    return (
                      <tr key={p.id}
                        onClick={() => setSeleccionado(activo ? null : p)}
                        className={`cursor-pointer transition-colors ${activo ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        {!prodSel && <td className="px-4 py-2 font-mono text-xs text-gray-400">{p.codigo}</td>}
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-900">{p.nombre}</p>
                          {prodSel && p.codigo && <p className="font-mono text-[10px] text-gray-400">{p.codigo}</p>}
                        </td>
                        {!prodSel && <td className="px-4 py-2 text-gray-500">{p.presentacion}</td>}
                        <td className="px-4 py-1" onClick={e => e.stopPropagation()}>
                          <StockCell productoId={p.id} cantidad={sa?.cantidad}/>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Detalle ───────────────────────────────────────────────────── */}
        {prodSel && (
          <div className="flex-1 bg-white rounded-[10px] shadow-card overflow-hidden" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            <PanelDetalle producto={prodSel} onClose={() => setSeleccionado(null)}/>
          </div>
        )}
      </div>
    </div>
  )
}
