import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { useAuth } from '../../context/AuthContext'

// supabaseAdmin bypasses RLS — el jefe necesita ver vendedores y clientes de otros
const db = supabaseAdmin ?? supabase

// ─── hooks ────────────────────────────────────────────────────────────────────

function useVendedores() {
  return useQuery({
    queryKey: ['vendedores', 'lista'],
    queryFn: async () => {
      const { data, error } = await db
        .from('vendedores')
        .select('id, rol, perfiles(nombre)')
        .order('id')
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

function useClientesPorVendedor(vendedorId) {
  return useQuery({
    queryKey: ['clientes', 'por_vendedor', vendedorId],
    queryFn: async () => {
      if (!vendedorId) return []
      const { data, error } = await db
        .from('clientes')
        .select('id, razon_social, cuit, estado')
        .eq('vendedor_id', vendedorId)
        .eq('estado', 'activo')
        .order('razon_social')
      if (error) throw error
      return data ?? []
    },
    enabled: !!vendedorId,
  })
}

function useDelegacionesActivas() {
  return useQuery({
    queryKey: ['delegaciones', 'activas'],
    queryFn: async () => {
      const { data, error } = await db
        .from('delegaciones_clientes')
        .select(`
          id, motivo, creado_en,
          clientes(id, razon_social),
          vendedor_desde:vendedores!delegaciones_clientes_vendedor_desde_id_fkey(id, perfiles(nombre)),
          vendedor_hacia:vendedores!delegaciones_clientes_vendedor_hacia_id_fkey(id, perfiles(nombre))
        `)
        .eq('activa', true)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 0,
  })
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function Delegacion() {
  const { isJefeVentas } = useAuth()
  const qc = useQueryClient()

  const { data: vendedores = [] }    = useVendedores()
  const { data: delegaciones = [], isLoading: loadDel } = useDelegacionesActivas()

  const [desdeId, setDesdeId]     = useState('')
  const [haciaId, setHaciaId]     = useState('')
  const [seleccionados, setSel]   = useState(new Set())
  const [motivo, setMotivo]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [ok, setOk]               = useState('')

  const { data: clientesDesde = [], isLoading: loadCli } = useClientesPorVendedor(desdeId ? parseInt(desdeId) : null)

  const vendedoresSinJefe = useMemo(() => vendedores.filter(v => v.rol !== 'jefe'), [vendedores])

  function toggleSel(id) {
    setSel(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarTodos() {
    if (seleccionados.size === clientesDesde.length) setSel(new Set())
    else setSel(new Set(clientesDesde.map(c => c.id)))
  }

  async function delegar() {
    if (!desdeId || !haciaId) { setError('Seleccioná ambos vendedores'); return }
    if (desdeId === haciaId) { setError('El vendedor origen y destino no pueden ser el mismo'); return }
    if (seleccionados.size === 0) { setError('Seleccioná al menos un cliente'); return }

    setLoading(true)
    setError('')
    setOk('')
    try {
      const ids = Array.from(seleccionados)

      // Crear registros de delegación
      const delegRows = ids.map(clienteId => ({
        cliente_id:        clienteId,
        vendedor_desde_id: parseInt(desdeId),
        vendedor_hacia_id: parseInt(haciaId),
        motivo:            motivo.trim() || null,
        activa:            true,
      }))
      const { error: ed } = await db.from('delegaciones_clientes').insert(delegRows)
      if (ed) throw ed

      // Actualizar vendedor_id en clientes
      const { error: ec } = await db
        .from('clientes')
        .update({ vendedor_id: parseInt(haciaId) })
        .in('id', ids)
      if (ec) throw ec

      const nombreDesde = vendedores.find(v => v.id === parseInt(desdeId))?.perfiles?.nombre ?? desdeId
      const nombreHacia = vendedores.find(v => v.id === parseInt(haciaId))?.perfiles?.nombre ?? haciaId
      setOk(`${ids.length} cliente${ids.length !== 1 ? 's' : ''} delegado${ids.length !== 1 ? 's' : ''} de ${nombreDesde} → ${nombreHacia}`)
      setSel(new Set())
      setMotivo('')
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['delegaciones'] })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function revertir(delegacion) {
    if (!confirm(`¿Revertir delegación de "${delegacion.clientes?.razon_social}"?`)) return
    try {
      // Restaurar vendedor original
      await db
        .from('clientes')
        .update({ vendedor_id: delegacion.vendedor_desde?.id })
        .eq('id', delegacion.clientes?.id)

      // Marcar delegación como inactiva
      await db
        .from('delegaciones_clientes')
        .update({ activa: false })
        .eq('id', delegacion.id)

      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['delegaciones'] })
    } catch (e) {
      alert('Error al revertir: ' + e.message)
    }
  }

  if (!isJefeVentas) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 text-sm">Esta sección es solo para el jefe de ventas.</p>
      </div>
    )
  }

  const SELECT = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] bg-white'

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Delegación de clientes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Reasigná clientes temporalmente cuando un vendedor no esté disponible</p>
      </div>

      {/* Selector de vendedores */}
      <div className="bg-white rounded-[10px] shadow-card p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Configurar delegación</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Vendedor ausente</label>
            <select className={`${SELECT} w-full`} value={desdeId}
              onChange={e => { setDesdeId(e.target.value); setSel(new Set()); setError(''); setOk('') }}>
              <option value="">Seleccioná un vendedor…</option>
              {vendedoresSinJefe.map(v => (
                <option key={v.id} value={v.id}>{v.perfiles?.nombre ?? `Vendedor ${v.id}`}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
              <span className="text-xs">delegar a</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Vendedor reemplazante</label>
            <select className={`${SELECT} w-full`} value={haciaId}
              onChange={e => { setHaciaId(e.target.value); setError(''); setOk('') }}>
              <option value="">Seleccioná un vendedor…</option>
              {vendedoresSinJefe.filter(v => v.id !== parseInt(desdeId)).map(v => (
                <option key={v.id} value={v.id}>{v.perfiles?.nombre ?? `Vendedor ${v.id}`}</option>
              ))}
            </select>
          </div>
        </div>
        {desdeId && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Motivo (opcional)</label>
            <input type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99]"
              placeholder="Ej: Vacaciones, licencia médica…"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Lista de clientes */}
      {desdeId && (
        <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">
              Clientes de {vendedores.find(v => v.id === parseInt(desdeId))?.perfiles?.nombre ?? '—'}
            </h2>
            {clientesDesde.length > 0 && (
              <button onClick={seleccionarTodos}
                className="text-xs text-[#004a99] hover:underline font-medium">
                {seleccionados.size === clientesDesde.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            )}
          </div>

          {loadCli
            ? <div className="p-8 flex justify-center"><div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
            : clientesDesde.length === 0
            ? <div className="p-8 text-center text-sm text-gray-400">Este vendedor no tiene clientes activos</div>
            : (
              <ul className="divide-y divide-gray-50">
                {clientesDesde.map(c => (
                  <li key={c.id}
                    onClick={() => toggleSel(c.id)}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${seleccionados.has(c.id) ? 'bg-blue-50' : ''}`}>
                    <input type="checkbox" readOnly checked={seleccionados.has(c.id)}
                      className="rounded accent-[#004a99] w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.razon_social}</p>
                      {c.cuit && <p className="text-xs text-gray-400">CUIT {c.cuit}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )
          }

          {clientesDesde.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500">
                {seleccionados.size} de {clientesDesde.length} cliente{clientesDesde.length !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3">
                {error && <p className="text-sm text-red-600">{error}</p>}
                {ok && <p className="text-sm text-green-700">{ok}</p>}
                <button onClick={delegar} disabled={loading || seleccionados.size === 0 || !haciaId}
                  className="px-5 py-2 bg-[#004a99] text-white text-sm font-medium rounded-lg hover:bg-[#003a7a] disabled:opacity-50 flex items-center gap-2">
                  {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  Delegar {seleccionados.size > 0 ? seleccionados.size : ''} cliente{seleccionados.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delegaciones activas */}
      <div className="bg-white rounded-[10px] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Delegaciones activas</h2>
          <p className="text-xs text-gray-400 mt-0.5">Clientes con asignación temporal. Revertí cuando el vendedor original vuelva.</p>
        </div>

        {loadDel
          ? <div className="p-8 flex justify-center"><div className="w-6 h-6 border-4 border-[#004a99] border-t-transparent rounded-full animate-spin"/></div>
          : delegaciones.length === 0
          ? <div className="p-8 text-center text-sm text-gray-400">No hay delegaciones activas</div>
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Vendedor original</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Asignado a</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Desde</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Motivo</th>
                  <th className="w-24 px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {delegaciones.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{d.clientes?.razon_social ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.vendedor_desde?.perfiles?.nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[#004a99] font-medium">{d.vendedor_hacia?.perfiles?.nombre ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(d.creado_en).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.motivo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => revertir(d)}
                        className="text-xs font-medium text-[#dc3545] hover:underline">
                        Revertir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}
