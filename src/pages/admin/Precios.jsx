import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

// ─── hooks ────────────────────────────────────────────────────────────────────

function useProductosAdmin() {
  return useQuery({
    queryKey: ['admin', 'productos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, codigo, nombre, presentacion, activo, precios_actuales(producto_id, lista1_may, lista4_std, lista3_min)')
        .order('nombre')
      if (error) throw error
      return data
    },
    staleTime: 0,
  })
}

function useActualizarPrecio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ precioId, campo, valor }) => {
      const { error } = await supabase
        .from('precios_actuales')
        .update({ [campo]: parseFloat(valor) || null })
        .eq('producto_id', precioId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'productos'] }),
  })
}

// ─── PrecioCell ───────────────────────────────────────────────────────────────

function PrecioCell({ value, precioId, campo }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value ?? '')
  const actualizar            = useActualizarPrecio()

  function handleBlur() {
    setEditing(false)
    if (parseFloat(val) !== parseFloat(value ?? 0)) {
      actualizar.mutate({ precioId, campo, valor: val })
    }
  }

  if (editing) {
    return (
      <input type="number" step="0.01" value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => e.key === 'Enter' && handleBlur()}
        className="w-24 text-right text-sm border border-[#1b4332] rounded px-2 py-0.5 focus:outline-none"
      />
    )
  }

  return (
    <span onClick={() => { setEditing(true); setVal(value ?? '') }}
      className={`cursor-pointer hover:bg-blue-50 px-2 py-0.5 rounded block text-right ${value == null ? 'text-gray-300' : 'text-gray-800 font-medium'}`}>
      {value != null ? Number(value).toFixed(2) : '—'}
    </span>
  )
}

// ─── importación Excel ────────────────────────────────────────────────────────

const COL_MAP = {
  codigo:     ['codigo', 'código', 'code'],
  lista1_may: ['lista1_may', 'lista may', 'mayorista', 'may', 'lista1'],
  lista4_std: ['lista4_std', 'lista std', 'estandar', 'estándar', 'std', 'lista4'],
  lista3_min: ['lista3_min', 'lista min', 'minorista', 'min', 'lista3'],
}

function detectarColumna(headers, aliases) {
  return headers.findIndex(h => aliases.includes(String(h ?? '').toLowerCase().trim()))
}

function parsearExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (rows.length < 2) { reject(new Error('El archivo no tiene datos')); return }

        const headers = rows[0].map(h => String(h ?? '').toLowerCase().trim())
        const iCod  = detectarColumna(headers, COL_MAP.codigo)
        const iMay  = detectarColumna(headers, COL_MAP.lista1_may)
        const iStd  = detectarColumna(headers, COL_MAP.lista4_std)
        const iMin  = detectarColumna(headers, COL_MAP.lista3_min)

        if (iCod === -1) { reject(new Error('No se encontró la columna "Código". Asegurate de que el encabezado sea "Codigo" o "Código".')); return }
        if (iMay === -1 && iStd === -1 && iMin === -1) {
          reject(new Error('No se encontró ninguna columna de precios. Usá encabezados como "Lista MAY", "Lista STD", "Lista MIN".'))
          return
        }

        const parsed = rows.slice(1)
          .filter(r => String(r[iCod] ?? '').trim())
          .map(r => ({
            codigo:     String(r[iCod] ?? '').trim().toUpperCase(),
            lista1_may: iMay !== -1 && r[iMay] !== '' ? parseFloat(r[iMay]) || null : undefined,
            lista4_std: iStd !== -1 && r[iStd] !== '' ? parseFloat(r[iStd]) || null : undefined,
            lista3_min: iMin !== -1 && r[iMin] !== '' ? parseFloat(r[iMin]) || null : undefined,
          }))
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsBinaryString(file)
  })
}

function descargarPlantilla(productos) {
  const rows = [
    ['Codigo', 'Nombre', 'Lista MAY', 'Lista STD', 'Lista MIN'],
    ...productos.map(p => {
      const pr = Array.isArray(p.precios_actuales) ? p.precios_actuales[0] : p.precios_actuales
      return [p.codigo, p.nombre, pr?.lista1_may ?? '', pr?.lista4_std ?? '', pr?.lista3_min ?? '']
    }),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Precios')
  XLSX.writeFile(wb, `precios_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─── modal importación ────────────────────────────────────────────────────────

function ModalImportar({ productos, onClose }) {
  const qc          = useQueryClient()
  const fileRef     = useRef()
  const [drag, setDrag]       = useState(false)
  const [filas, setFilas]     = useState(null)   // parsed rows
  const [error, setError]     = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const productoMap = useMemo(() => {
    const m = {}
    for (const p of productos) m[p.codigo?.toUpperCase()] = p
    return m
  }, [productos])

  const preview = useMemo(() => {
    if (!filas) return null
    return filas.map(f => {
      const prod = productoMap[f.codigo]
      const pr   = prod ? (Array.isArray(prod.precios_actuales) ? prod.precios_actuales[0] : prod.precios_actuales) : null
      return { ...f, prod, pr, encontrado: !!prod }
    })
  }, [filas, productoMap])

  const encontrados = preview?.filter(r => r.encontrado).length ?? 0
  const noEncontrados = preview ? preview.length - encontrados : 0

  async function procesarArchivo(file) {
    if (!file) return
    setError(null)
    setFilas(null)
    setResultado(null)
    try {
      const rows = await parsearExcel(file)
      setFilas(rows)
    } catch (e) {
      setError(e.message)
    }
  }

  async function aplicar() {
    const validos = preview.filter(r => r.encontrado && r.pr)
    if (!validos.length) return
    setGuardando(true)
    let ok = 0, fail = 0
    for (const r of validos) {
      const update = {}
      if (r.lista1_may !== undefined) update.lista1_may = r.lista1_may
      if (r.lista4_std !== undefined) update.lista4_std = r.lista4_std
      if (r.lista3_min !== undefined) update.lista3_min = r.lista3_min
      if (!Object.keys(update).length) continue
      const { error } = await supabase.from('precios_actuales').update(update).eq('producto_id', r.pr.producto_id)
      if (error) fail++ ; else ok++
    }
    setGuardando(false)
    setResultado({ ok, fail })
    if (ok > 0) qc.invalidateQueries({ queryKey: ['admin', 'productos'] })
  }

  function onDrop(e) {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Importar precios desde Excel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* zona drop */}
          {!filas && !resultado && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                drag ? 'border-[#1b4332] bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => procesarArchivo(e.target.files[0])} />
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v8m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <p className="text-sm font-medium text-gray-700 mb-1">Arrastrá tu archivo o hacé clic para seleccionar</p>
              <p className="text-xs text-gray-400">Formatos: .xlsx · .xls · .csv</p>
            </div>
          )}

          {/* formato esperado */}
          {!filas && !resultado && (
            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 space-y-1.5">
              <p className="font-semibold text-gray-700 mb-2">Formato esperado del archivo:</p>
              <div className="font-mono bg-white border border-gray-100 rounded p-3 text-xs overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Codigo','Nombre (opcional)','Lista MAY','Lista STD','Lista MIN'].map(h => (
                        <th key={h} className="pr-6 py-1 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="pr-6 py-1">ALC-001</td><td className="pr-6 py-1">Alcohol 96°</td><td className="pr-6 py-1">12.50</td><td className="pr-6 py-1">14.00</td><td className="pr-6 py-1">16.50</td></tr>
                    <tr><td className="pr-6 py-1">CIT-002</td><td className="pr-6 py-1">Ácido cítrico</td><td className="pr-6 py-1">8.00</td><td className="pr-6 py-1">9.50</td><td className="pr-6 py-1">11.00</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-gray-400 mt-2">Podés dejar en blanco las celdas que no querés modificar.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* resultado final */}
          {resultado && (
            <div className={`rounded-lg p-5 text-center ${resultado.fail === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <p className="text-2xl font-bold text-gray-800 mb-1">{resultado.ok} producto{resultado.ok !== 1 ? 's' : ''} actualizado{resultado.ok !== 1 ? 's' : ''}</p>
              {resultado.fail > 0 && <p className="text-sm text-red-600">{resultado.fail} error{resultado.fail !== 1 ? 'es' : ''} al guardar</p>}
              <button onClick={onClose} className="mt-4 px-5 py-2 bg-[#1b4332] text-white text-sm font-medium rounded-lg hover:bg-[#152e24]">
                Cerrar
              </button>
            </div>
          )}

          {/* preview tabla */}
          {preview && !resultado && (
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-gray-500">
                  <span className="font-semibold text-[#28a745]">{encontrados}</span> productos encontrados
                  {noEncontrados > 0 && <>, <span className="font-semibold text-[#dc3545]">{noEncontrados}</span> no encontrados (se ignorarán)</>}
                </span>
                <button onClick={() => { setFilas(null); setError(null) }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">
                  Cambiar archivo
                </button>
              </div>

              <div className="border border-gray-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500 w-8"/>
                      <th className="text-left px-3 py-2 font-medium text-gray-500 w-28">Código</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Producto</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Lista MAY</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Lista STD</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Lista MIN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((r, i) => (
                      <tr key={i} className={r.encontrado ? 'hover:bg-gray-50' : 'bg-red-50 opacity-60'}>
                        <td className="px-3 py-1.5 text-center">
                          {r.encontrado
                            ? <span className="text-[#28a745]">✓</span>
                            : <span className="text-[#dc3545]">✗</span>
                          }
                        </td>
                        <td className="px-3 py-1.5 font-mono text-gray-500">{r.codigo}</td>
                        <td className="px-3 py-1.5 text-gray-700">{r.prod?.nombre ?? <span className="text-red-400 italic">No encontrado</span>}</td>
                        {['lista1_may','lista4_std','lista3_min'].map(campo => (
                          <td key={campo} className="px-3 py-1.5 text-right">
                            {r[campo] !== undefined
                              ? <span className="font-medium text-[#1b4332]">{r[campo] != null ? Number(r[campo]).toFixed(2) : '—'}</span>
                              : <span className="text-gray-200">sin cambio</span>
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        {preview && !resultado && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Se actualizarán solo los productos encontrados</span>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={aplicar}
                disabled={guardando || encontrados === 0}
                className="px-5 py-2 bg-[#1b4332] text-white text-sm font-medium rounded-lg hover:bg-[#152e24] disabled:opacity-50 flex items-center gap-2"
              >
                {guardando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Aplicar {encontrados} cambio{encontrados !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function Precios() {
  const { data: productos = [], isLoading } = useProductosAdmin()
  const [busqueda, setBusqueda]   = useState('')
  const [pagina, setPagina]       = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const POR_PAG = 50

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return q ? productos.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)) : productos
  }, [productos, busqueda])

  const totalPags = Math.ceil(filtrados.length / POR_PAG)
  const paginados = filtrados.slice((pagina - 1) * POR_PAG, pagina * POR_PAG)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lista de Precios</h1>
          <p className="text-sm text-gray-400 mt-0.5">Hacé clic en un precio para editarlo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => descargarPlantilla(productos)}
            disabled={isLoading || productos.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Descargar plantilla
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1b4332] text-white rounded-lg hover:bg-[#152e24]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            Importar Excel
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
            placeholder="Buscar…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b4332]"/>
        </div>
        <span className="self-center text-sm text-gray-400">{filtrados.length} productos</span>
      </div>

      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        {isLoading
          ? <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin"/></div>
          : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Presentación</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">
                  <span className="text-[10px] text-gray-400 block">Mayorista</span>Lista MAY
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">
                  <span className="text-[10px] text-gray-400 block">Estándar</span>Lista STD
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">
                  <span className="text-[10px] text-gray-400 block">Minorista</span>Lista MIN
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginados.map(p => {
                const pr = Array.isArray(p.precios_actuales) ? p.precios_actuales[0] : p.precios_actuales
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-400">{p.codigo}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{p.nombre}</td>
                    <td className="px-4 py-2 text-gray-500">{p.presentacion}</td>
                    {pr
                      ? <>
                          <td className="px-4 py-1"><PrecioCell value={pr.lista1_may} precioId={pr.id} campo="lista1_may"/></td>
                          <td className="px-4 py-1"><PrecioCell value={pr.lista4_std} precioId={pr.id} campo="lista4_std"/></td>
                          <td className="px-4 py-1"><PrecioCell value={pr.lista3_min} precioId={pr.id} campo="lista3_min"/></td>
                        </>
                      : <td colSpan={3} className="px-4 py-2 text-gray-300 text-xs text-center">Sin precios</td>
                    }
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPags > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
          <span className="self-center text-sm text-gray-500">{pagina} / {totalPags}</span>
          <button onClick={() => setPagina(p => Math.min(totalPags, p + 1))} disabled={pagina === totalPags}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Siguiente →</button>
        </div>
      )}

      {modalOpen && <ModalImportar productos={productos} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
