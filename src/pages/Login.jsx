import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, perfil } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
      <div className="bg-white rounded-[10px] shadow-md w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#004a99]">Fabriquímica</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de Gestión</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004a99] focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex justify-end">
            <Link to="/recuperar" className="text-xs text-[#004a99] hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {error && (
            <p className="text-[#dc3545] text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#004a99] hover:bg-[#003d80] text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 mb-1">¿Tu empresa aún no es cliente?</p>
          <Link to="/registro"
            className="text-sm font-semibold text-[#004a99] hover:underline">
            Registrate como nuevo cliente →
          </Link>
        </div>
      </div>
    </div>
  )
}
