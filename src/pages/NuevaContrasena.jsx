import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabaseAdmin'

export default function NuevaContrasena() {
  const navigate = useNavigate()
  const [pass, setPass]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [ok, setOk]           = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY once it processes the token in the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setSessionReady(true)
      }
    })
    // In case the session is already active (e.g. page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (pass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (pass !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password: pass })
      if (error) throw error

      // Limpiar flag de cambio obligatorio
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const db = supabaseAdmin ?? supabase
          await db.from('perfiles').update({ debe_cambiar_pass: false }).eq('id', user.id)
        }
      } catch { /* columna aún no migrada — ignorar */ }

      setOk(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
        <div className="bg-white rounded-[10px] shadow-md w-full max-w-sm p-8 text-center">
          <div className="w-8 h-8 border-4 border-[#1b4332] border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-sm text-gray-500">Verificando link…</p>
        </div>
      </div>
    )
  }

  if (ok) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
        <div className="bg-white rounded-[10px] shadow-md w-full max-w-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-800">¡Contraseña actualizada!</p>
          <p className="text-xs text-gray-400">Ingresando al sistema…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
      <div className="bg-white rounded-[10px] shadow-md w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1b4332]">Fabriquímica</h1>
          <p className="text-gray-500 text-sm mt-1">Nueva contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332] focus:border-transparent"
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332] focus:border-transparent"
              placeholder="Repetí la contraseña"
              required
            />
          </div>

          {error && (
            <p className="text-[#dc3545] text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1b4332] hover:bg-[#152e24] text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
            {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
