import { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useContratipos, useCrearContratype, useEliminarContratype } from '../../hooks/useLaboratorio'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

const db = supabaseAdmin ?? supabase

function parsearArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const buf = e.target.result
        const isCsv = file.name.toLowerCase().endsWith('.csv')
        let fs = ','
        if (isCsv) {
          const firstLine = new TextDecoder().decode(new Uint8Array(buf).slice(0, 500))
          fs = firstLine.includes(';') ? ';' : ','
        }
        const wb = XLSX.read(buf, { type: 'array', FS: fs })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) { resolve([]); return }
        const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        function col(row, ...names) {
          const normNames = names.map(norm)
          const key = Object.keys(row).find(k => normNames.includes(norm(k)))
          return key !== undefined && row[key] !== '' ? String(row[key]).trim() : ''
        }
        const parsed = rows
          .map(r => ({
            nombre_fq: col(r,
              'nombre fabriquimica', 'nombre_fabriquimica', 'nombrefabriquimica',
              'nombre_fq', 'nombrefq', 'fq', 'nombre fq', 'producto fq', 'productofq',
            ),
            marca: col(r, 'marca', 'nombre comercial', 'nombrecomercial', 'nombre marca', 'nombredemarca', 'product name'),
            productor: col(r, 'productor', 'fabricante', 'manufacturer', 'producer', 'empresa'),
          }))
          .filter(r => r.nombre_fq && r.marca)
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function ModalImportar({ onClose, onImport }) {
  const [filas, setFilas]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setError('')
    try {
      const rows = await parsearArchivo(file)
      if (rows.length === 0) throw new Error('No se encontraron filas válidas. Verificá que el archivo tenga columnas nombre_fq y marca.')
      setFilas(rows)
    } catch (err) {
      setError('No se pudo leer el archivo: ' + err.message)
    }
  }

  async function handleImportar() {
    if (!filas?.length) return
    setLoading(true)
    try {
      await onImport(filas)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[10px] shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Importar contratipos</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          {!filas ? (
            <div>
              <p className="text-sm text-gray-600 mb-1">
                Columnas esperadas: <strong>NOMBRE FABRIQUIMICA</strong>, <strong>PRODUCTOR</strong>, <strong>MARCA</strong>.
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Compatible con CSV separado por punto y coma (;) o coma, y con archivos XLS/XLSX.
              </p>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-[#004a99]/50 transition-colors"
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                <p className="text-sm text-gray-500">Arrastrá o hacé clic para elegir</p>
                <p className="text-xs text-gray-400 mt-1">CSV, XLS, XLSX</p>
              </div>
              <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Se encontraron <strong className="text-[#004a99]">{filas.length}</strong> filas válidas. Vista previa:
              </p>
              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Marca / Nombre comercial</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Productor</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">→ Producto FQ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filas.slice(0, 50).map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-900">{f.marca}</td>
                        <td className="px-3 py-1.5 text-gray-500">{f.productor || '—'}</td>
                        <td className="px-3 py-1.5 font-medium text-[#004a99]">{f.nombre_fq}</td>
                      </tr>
                    ))}
                    {filas.length > 50 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center text-gray-400">
                          …y {filas.length - 50} registros más
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {filas ? (
            <>
              <button onClick={() => setFilas(null)} className="text-sm text-gray-500 hover:text-gray-700">
                ← Cambiar archivo
              </button>
              <button
                onClick={handleImportar}
                disabled={loading}
                className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Importar {filas.length} registros
              </button>
            </>
          ) : (
            <button onClick={onClose} className="ml-auto text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ContratiposLaboratorio() {
  const qc = useQueryClient()
  const { data: contratipos = [], isLoading } = useContratipos()
  const crearContratype   = useCrearContratype()
  const eliminarContratype = useEliminarContratype()

  const [busqueda, setBusqueda]         = useState('')
  const [showImportar, setShowImportar] = useState(false)
  const [form, setForm]                 = useState({ nombre_fq: '', marca: '', productor: '' })
  const [saving, setSaving]             = useState(false)
  const [formError, setFormError]       = useState('')
  const [ok, setOk]                     = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return contratipos
    return contratipos.filter(c =>
      c.marca?.toLowerCase().includes(q) ||
      c.productor?.toLowerCase().includes(q) ||
      c.nombre_fq?.toLowerCase().includes(q)
    )
  }, [contratipos, busqueda])

  async function handleAgregar(e) {
    e.preventDefault()
    if (!form.nombre_fq.trim() || !form.marca.trim()) {
      setFormError('Nombre FQ y Marca son obligatorios')
      return
    }
    setSaving(true)
    setFormError('')
    setOk('')
    try {
      await crearContratype.mutateAsync(form)
      setForm({ nombre_fq: '', marca: '', productor: '' })
      setOk('Contratipo agregado.')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este contratipo?')) return
    try {
      await eliminarContratype.mutateAsync(id)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleImport(filas) {
    for (let i = 0; i < filas.length; i += 500) {
      const chunk = filas.slice(i, i + 500)
      const { error } = await db.from('contratipos').insert(
        chunk.map(f => ({
          nombre_fq: f.nombre_fq,
          marca:     f.marca,
          productor: f.productor || null,
        }))
      )
      if (error) throw error
    }
    qc.invalidateQueries({ queryKey: ['laboratorio', 'contratipos'] })
    qc.invalidateQueries({ queryKey: ['admin', 'contratipos'] })
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contratipos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Correlación de marcas comerciales con el catálogo Fabriquímica
          </p>
        </div>
        <button
          onClick={() => setShowImportar(true)}
          className="flex items-center gap-2 bg-[#004a99] hover:bg-[#003d80] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3m0 0l3-3m-3 3V8"/>
          </svg>
          Importar CSV / Excel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-[10px] shadow-card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Agregar contratipo</h2>
          <form onSubmit={handleAgregar} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Producto Fabriquímica <span className="text-red-500">*</span>
              </label>
              <input
                value={form.nombre_fq}
                onChange={e => setForm(f => ({ ...f, nombre_fq: e.target.value }))}
                placeholder="Ej: Ácido clorhídrico 33%"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Marca / Nombre comercial <span className="text-red-500">*</span>
              </label>
              <input
                value={form.marca}
                onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                placeholder="Ej: Muriático Listo"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Productor / Fabricante</label>
              <input
                value={form.productor}
                onChange={e => setForm(f => ({ ...f, productor: e.target.value }))}
                placeholder="Ej: QuimicaSA (opcional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              />
            </div>
            {formError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{formError}</p>
            )}
            {ok && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">{ok}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#004a99] hover:bg-[#003d80] disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              Agregar
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[10px] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Filtrar por marca, productor o nombre FQ…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              />
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{filtrados.length.toLocaleString()} registros</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : filtrados.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {contratipos.length === 0
                  ? 'Sin contratipos. Importá un archivo o agregá uno manualmente.'
                  : 'Sin resultados para esa búsqueda.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Marca</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Productor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">→ Producto FQ</th>
                    <th className="w-10"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrados.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.marca}</td>
                      <td className="px-4 py-2.5 text-gray-500">{c.productor || '—'}</td>
                      <td className="px-4 py-2.5 text-[#004a99] font-medium">{c.nombre_fq}</td>
                      <td className="px-2 py-2.5">
                        <button
                          onClick={() => handleEliminar(c.id)}
                          className="p-1 text-gray-300 hover:text-[#dc3545] rounded transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showImportar && (
        <ModalImportar
          onClose={() => setShowImportar(false)}
          onImport={handleImport}
        />
      )}
    </div>
  )
}
