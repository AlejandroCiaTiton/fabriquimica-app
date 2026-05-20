import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ICONOS = {
  mapa:           'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  plan:           'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  recepcion:      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  zonas:          'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  transportistas: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  cronograma:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive ? 'bg-[#004a99] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`
    }>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONOS[icon]}/>
      </svg>
      {label}
    </NavLink>
  )
}

export default function SidebarLogistica() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-green-900 bg-[#1b4332]">
        <div className="bg-white rounded-lg px-3 py-2 inline-block"><img src="/logo_fabriquimica.png" alt="Fabriquímica" className="h-7 object-contain" /></div>
        <p className="text-xs text-green-200 mt-0.5">Logística</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/logistica/mapa"           icon="mapa"           label="Mapa de entregas" />
        <NavItem to="/logistica/plan"           icon="plan"           label="Plan diario" />
        <NavItem to="/logistica/recepcion"      icon="recepcion"      label="Recepción" />
        <NavItem to="/logistica/zonas"          icon="zonas"          label="Zonas de entrega" />
        <NavItem to="/logistica/transportistas" icon="transportistas" label="Transportistas" />
        <NavItem to="/logistica/cronograma"     icon="cronograma"     label="Cronograma de envíos" />
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Logística'}</p>
        <button onClick={async () => { await logout(); navigate('/login') }}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545] transition-colors">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
