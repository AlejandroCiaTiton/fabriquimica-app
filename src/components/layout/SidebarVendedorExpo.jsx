import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePedidosExpo } from '../../hooks/useExpo'

const ICONOS = {
  cotizaciones: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  nueva:        'M12 4v16m8-8H4',
  globo:        'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive ? 'bg-[#004a99] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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

export default function SidebarVendedorExpo() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const { data: pedidos = [] } = usePedidosExpo()
  const cotizadosPendientes = pedidos.filter(p => p.estado === 'cotizado').length

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-gray-100">
        <span className="text-lg font-bold text-[#004a99]">Fabriquímica</span>
        <p className="text-xs text-gray-400 mt-0.5">Exportaciones</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/expo/cotizaciones"   icon="cotizaciones" label="Mis cotizaciones" badge={cotizadosPendientes} />
        <NavItem to="/expo/nueva"          icon="nueva"        label="Nueva cotización EXPO" />
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Vendedor EXPO'}</p>
        <p className="text-xs text-gray-400">Exportaciones</p>
        <button onClick={async () => { await logout(); navigate('/login') }}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545] transition-colors">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
