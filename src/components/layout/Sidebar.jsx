import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useVendedorAlertas } from '../../hooks/useAlertas'
import { useClientesConDeuda } from '../../hooks/useFinanzas'
import { usePedidosExpo } from '../../hooks/useExpo'
import { useSolicitudesPendientesCount } from '../../hooks/useMuestras'

const iconos = {
  stock:         'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  estado_cuenta: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  solicitudes:  'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  cotizaciones: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  ordenes:      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  historico:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  directorio:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  estadisticas: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  plan:          'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  alta_vendedor: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  delegacion:          'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  confirmacion_clientes: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  asignacion_clientes:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  expo_cotizaciones:     'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
  expo_nueva:            'M12 4v16m8-8H4',
  alta_empresa:          'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  muestras:              'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
}

function NavItem({ to, icon, label, soon, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[#004a99] text-white'
            : soon
            ? 'text-gray-400 cursor-not-allowed pointer-events-none'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={iconos[icon]} />
      </svg>
      <span className="flex-1">{label}</span>
      {soon && <span className="ml-auto text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">pronto</span>}
      {badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#dc3545] text-white text-[10px] font-bold px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { perfil, isJefeVentas, logout } = useAuth()
  const isVendedorExpo = perfil?.tipo === 'vendedor_expo'
  const navigate = useNavigate()
  const { data: alertas }    = useVendedorAlertas()
  const { data: deudaCount } = useClientesConDeuda()
  const { data: pedidosExpo = [] } = usePedidosExpo({ enabled: isVendedorExpo })
  const expoCount     = pedidosExpo.filter(p => p.estado === 'cotizado').length
  const muestrasCount = useSolicitudesPendientesCount()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-green-900 bg-[#1b4332]">
        <div className="bg-white rounded-lg px-3 py-2 inline-block">
          <img src="/logo_fabriquimica.png" alt="Fabriquímica" className="h-7 object-contain" />
        </div>
        <p className="text-xs text-green-200 mt-1">Sistema de Gestión</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {isVendedorExpo ? (
          <>
            <NavItem to="/vendedor/stock"              icon="stock"              label="Stock" />
            <NavItem to="/vendedor/expo-cotizaciones"  icon="expo_cotizaciones"  label="Cotizaciones EXPO" badge={expoCount} />
            <NavItem to="/vendedor/expo-nueva"         icon="expo_nueva"         label="Nueva cotización EXPO" />
            <NavItem to="/vendedor/ordenes"            icon="ordenes"            label="Órdenes de compra" badge={alertas?.ordenes} />
            <NavItem to="/vendedor/muestras"           icon="muestras"           label="Muestras" badge={muestrasCount} />
            <NavItem to="/vendedor/alta-empresa"       icon="alta_empresa"       label="Alta de empresa" />
          </>
        ) : (
          <>
            <NavItem to="/vendedor/stock"          icon="stock"         label="Stock" />
            <NavItem to="/vendedor/estado-cuenta" icon="estado_cuenta" label="Estado de cuenta" badge={deudaCount} />
            <NavItem to="/vendedor/solicitudes"  icon="solicitudes"   label="Solicitudes"  badge={alertas?.solicitudes} />
            <NavItem to="/vendedor/cotizaciones" icon="cotizaciones" label="Cotizaciones" badge={alertas?.cotizaciones} />
            <NavItem to="/vendedor/ordenes"      icon="ordenes"      label="Órdenes"      badge={alertas?.ordenes} />
            <NavItem to="/vendedor/muestras"     icon="muestras"     label="Muestras"     badge={muestrasCount} />
            <NavItem to="/vendedor/alta-empresa" icon="alta_empresa" label="Alta de empresa" />
            <NavItem to="/vendedor/historico"    icon="historico"    label="Histórico de compras" />
            <NavItem to="/vendedor/directorio"   icon="directorio"   label="Directorio de clientes" />
            {isJefeVentas && (
              <>
                <NavItem to="/vendedor/confirmacion-clientes" icon="confirmacion_clientes" label="Confirmación clientes" badge={alertas?.solicitudesAlta} />
                <NavItem to="/vendedor/plan"           icon="plan"          label="Plan de ventas" />
                <NavItem to="/vendedor/estadisticas"   icon="estadisticas"  label="Estadísticas" />
                <NavItem to="/vendedor/alta-vendedor"  icon="alta_vendedor" label="Alta vendedor" />
                <NavItem to="/vendedor/delegacion"          icon="delegacion"           label="Delegación" />
                <NavItem to="/vendedor/asignacion-clientes" icon="asignacion_clientes"  label="Asignación de clientes" />
              </>
            )}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Usuario'}</p>
        <p className="text-xs text-gray-400 capitalize">{(Array.isArray(perfil?.vendedores) ? perfil.vendedores[0] : perfil?.vendedores)?.rol || perfil?.tipo}</p>
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
