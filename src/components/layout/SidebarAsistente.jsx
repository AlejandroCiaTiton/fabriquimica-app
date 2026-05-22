import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ICONOS = {
  ordenes:   'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  historico: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  directorio:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
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
      <span>{label}</span>
    </NavLink>
  )
}

export default function SidebarAsistente() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-gray-100">
        <img src="/logo.jpg" alt="Fabriquímica" className="h-8 object-contain" />
        <p className="text-xs text-gray-400 mt-0.5">Asistente de ventas</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/asistente/ordenes"    icon="ordenes"    label="Órdenes de compra" />
        <NavItem to="/asistente/historico"  icon="historico"  label="Histórico de compras" />
        <NavItem to="/asistente/directorio" icon="directorio" label="Directorio de clientes" />
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Usuario'}</p>
        <p className="text-xs text-gray-400">Asistente de ventas</p>
        <button onClick={async () => { await logout(); navigate('/login') }}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545] transition-colors">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
