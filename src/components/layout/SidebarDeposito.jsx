import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ICONOS = {
  cronograma: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive ? 'bg-[#1b4332] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`
    }>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONOS[icon]}/>
      </svg>
      {label}
    </NavLink>
  )
}

export default function SidebarDeposito() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-gray-100">
        <img src="/logo.jpg" alt="Fabriquímica" className="h-8 object-contain" />
        <p className="text-xs text-gray-400 mt-0.5">Depósito</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/deposito/cronograma" icon="cronograma" label="Cronograma de entregas" />
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Depósito'}</p>
        <button onClick={async () => { await logout(); navigate('/login') }}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545] transition-colors">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
