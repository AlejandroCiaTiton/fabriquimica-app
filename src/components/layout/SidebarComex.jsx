import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePedidosComexPendientesCount } from '../../hooks/useExpo'

const ICONOS = {
  solicitudes: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  historial:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
}

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive ? 'bg-[#1b4332] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`
    }>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONOS[icon]}/>
      </svg>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#dc3545] text-white text-[10px] font-bold px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

export default function SidebarComex() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const pendientes = usePedidosComexPendientesCount()

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-gray-100">
        <img src="/logo.jpg" alt="Fabriquímica" className="h-8 object-contain" />
        <p className="text-xs text-gray-400 mt-0.5">COMEX</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/comex/solicitudes" icon="solicitudes" label="Solicitudes" badge={pendientes} />
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'COMEX'}</p>
        <p className="text-xs text-gray-400">Comercio Exterior</p>
        <button onClick={async () => { await logout(); navigate('/login') }}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545] transition-colors">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
