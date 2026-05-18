import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RecuperarContrasena() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/nueva-contrasena`,
      })
      if (error) throw error
      setEnviado(true)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el correo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
      <div className="bg-white rounded-[10px] shadow-md w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#004a99]">Fabriquímica</h1>
          <p className="text-gray-500 text-sm mt-1">Recuperar contraseña</p>
        </div>

        {enviado ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium">Revisá tu correo electrónico</p>
            <p className="text-xs text-gray-400">
              Si <strong>{email}</strong> tiene una cuenta, recibirás un link para resetear tu contraseña.
            </p>
            <Link to="/login" className="block text-sm font-semibold text-[#004a99] hover:underline mt-4">
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Ingresá tu email y te enviamos un link para crear una nueva contraseña.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] focus:border-transparent"
                placeholder="usuario@fabriquimica.com"
                required
              />
            </div>

            {error && (
              <p className="text-[#dc3545] text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Enviando…' : 'Enviar link de recuperación'}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="text-sm text-gray-500 hover:text-[#004a99]">
                ← Volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
