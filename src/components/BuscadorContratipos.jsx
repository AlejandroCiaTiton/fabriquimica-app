import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

function useContratIposAll() {
  return useQuery({
    queryKey: ['contratipos', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratipos')
        .select('nombre_fq, productor, marca')
        .order('productor', { nullsFirst: false })
        .order('marca')
        .limit(5000)
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

function matchProducto(productos, nombreFQ) {
  if (!nombreFQ) return null
  const q = nombreFQ.toLowerCase()
  return (
    productos.find(p => p.nombre?.toLowerCase() === q) ||
    productos.find(p => p.nombre?.toLowerCase().startsWith(q)) ||
    productos.find(p => p.codigo?.toLowerCase() === q) ||
    productos.find(p => p.nombre?.toLowerCase().includes(q))
  )
}

export default function BuscadorContratipos({
  productos = [],
  idsExcluir = new Set(),
  onAgregar,
  cantDefault = 100,
  listaDefault = null,
}) {
  const { data: contratipos = [], isLoading, error } = useContratIposAll()

  const [fabricante, setFabricante] = useState('')
  const [marca, setMarca]           = useState('')

  // Unique fabricantes sorted
  const fabricantes = useMemo(() => {
    const set = new Set()
    contratipos.forEach(c => { if (c.productor) set.add(c.productor) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [contratipos])

  // Products (marcas) for selected fabricante, deduplicated
  const marcasDelFabricante = useMemo(() => {
    if (!fabricante) return []
    const seen = new Set()
    return contratipos
      .filter(c => c.productor === fabricante && !seen.has(c.marca) && seen.add(c.marca))
      .map(c => c.marca)
      .sort((a, b) => a.localeCompare(b, 'es'))
  }, [contratipos, fabricante])

  // Reset marca when fabricante changes
  useEffect(() => { setMarca('') }, [fabricante])

  // Contratipo entry for selected combination
  const contratipo = useMemo(() => {
    if (!fabricante || !marca) return null
    return contratipos.find(c => c.productor === fabricante && c.marca === marca) ?? null
  }, [contratipos, fabricante, marca])

  // FQ product match
  const productoFQ = useMemo(
    () => (contratipo ? matchProducto(productos, contratipo.nombre_fq) : null),
    [contratipo, productos]
  )

  function handleAgregar() {
    if (!productoFQ) return
    const p  = productoFQ
    const pr = Array.isArray(p.precios_actuales) ? p.precios_actuales[0] : p.precios_actuales
    if (listaDefault) {
      onAgregar({
        producto_id:     p.id,
        codigo:          p.codigo,
        nombre:          p.nombre,
        presentacion:    p.presentacion ?? '',
        cantidad:        cantDefault,
        precio_unitario: pr?.[listaDefault] ?? 0,
        lista_usada:     listaDefault,
        lista1_may:      pr?.lista1_may ?? null,
        lista4_std:      pr?.lista4_std ?? null,
        lista3_min:      pr?.lista3_min ?? null,
      })
    } else {
      onAgregar({
        producto_id:  p.id,
        nombre:       p.nombre,
        presentacion: p.presentacion ?? '',
        codigo:       p.codigo,
        cantidad:     cantDefault,
      })
    }
    setFabricante('')
    setMarca('')
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
        <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-[#004a99] rounded-full animate-spin"/>
        Cargando fabricantes…
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-red-500 py-2">Error al cargar: {error.message}</p>
  }

  if (fabricantes.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-2">Sin contratipos cargados.</p>
  }

  const SELECT = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white'

  return (
    <div className="space-y-2">

      {/* 1. Fabricante */}
      <select value={fabricante} onChange={e => setFabricante(e.target.value)} className={SELECT}>
        <option value="">— Seleccionar fabricante —</option>
        {fabricantes.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* 2. Producto del fabricante */}
      {fabricante && (
        <select value={marca} onChange={e => setMarca(e.target.value)} className={SELECT}>
          <option value="">— Seleccionar producto —</option>
          {marcasDelFabricante.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}

      {/* 3. Equivalente FQ */}
      {contratipo && (
        <div className="border border-[#004a99]/20 rounded-lg p-3 bg-blue-50/40 space-y-2">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-[#004a99] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
            <div className="flex-1 min-w-0">
              {productoFQ ? (
                <>
                  <p className="text-sm font-semibold text-[#004a99] leading-snug">{productoFQ.nombre}</p>
                  {productoFQ.presentacion && (
                    <p className="text-xs text-gray-400 mt-0.5">{productoFQ.presentacion}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  Sin producto en catálogo para "{contratipo.nombre_fq}"
                </p>
              )}
            </div>
          </div>

          {productoFQ && !idsExcluir.has(productoFQ.id) && (
            <button
              onClick={handleAgregar}
              className="w-full flex items-center justify-center gap-1.5 bg-[#004a99] hover:bg-[#003d80] text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Agregar
            </button>
          )}
          {productoFQ && idsExcluir.has(productoFQ.id) && (
            <p className="text-xs text-center text-gray-400">Ya agregado</p>
          )}
        </div>
      )}

    </div>
  )
}
