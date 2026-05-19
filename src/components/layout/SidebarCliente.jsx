import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ICONOS = {
  solicitar:   'M12 4v16m8-8H4',
  cotizaciones:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  encurso:     'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  historial:   'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  empresa:     'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  muestras:    'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
}

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[#004a99] text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONOS[icon]} />
      </svg>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="bg-[#ffc107] text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

export default function SidebarCliente({ badgeCotizaciones = 0, perfilIncompleto = false, badgeMuestras = 0 }) {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-gray-100">
        <span className="text-lg font-bold text-[#004a99]">Fabriquímica</span>
        <p className="text-xs text-gray-400 mt-0.5">Portal de Clientes</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavItem to="/cliente/nueva-solicitud" icon="solicitar"    label="Nueva Solicitud" />
        <NavItem to="/cliente/cotizaciones"    icon="cotizaciones" label="Mis Cotizaciones" badge={badgeCotizaciones} />
        <NavItem to="/cliente/oc-en-curso"     icon="encurso"      label="OC en Curso" />
        <NavItem to="/cliente/oc-completadas"  icon="historial"    label="OC Completadas" />
        <NavItem to="/cliente/muestras"        icon="muestras"     label="Muestras"       badge={badgeMuestras} />
        <NavItem to="/cliente/mi-empresa"      icon="empresa"      label="Mi Empresa"     badge={perfilIncompleto ? '!' : 0} />
      </nav>

      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Usuario'}</p>
        <p className="text-xs text-gray-400">Cliente</p>
        <button
          onClick={handleLogout}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545] transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
