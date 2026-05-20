import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useClientesConDeuda, useOCsPendientesFactura, useNotasPendientesCount } from '../../hooks/useFinanzas'

const ICONOS = {
  facturas:      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  emitidas:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  notas:         'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
  estado_cuenta: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  historico:     'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  directorio:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
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

export default function SidebarFinanzas() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const { data: pendientes = [] } = useOCsPendientesFactura()
  const { data: deudaCount  = 0 } = useClientesConDeuda()
  const notasPendientes            = useNotasPendientesCount()

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-green-900 bg-[#1b4332]">
        <div className="bg-white rounded-lg px-3 py-2 inline-block"><img src="/logo_fabriquimica.png" alt="Fabriquímica" className="h-7 object-contain" /></div>
        <p className="text-xs text-green-200 mt-0.5">Finanzas</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/finanzas/facturar"      icon="facturas"      label="Facturar órdenes"  badge={pendientes.length} />
        <NavItem to="/finanzas/emitidas"      icon="emitidas"      label="Facturas emitidas" />
        <NavItem to="/finanzas/notas"         icon="notas"         label="NC / ND"            badge={notasPendientes} />
        <NavItem to="/finanzas/estado-cuenta" icon="estado_cuenta" label="Estado de cuenta"  badge={deudaCount} />
        <NavItem to="/finanzas/historico"     icon="historico"     label="Histórico de compras" />
        <NavItem to="/finanzas/directorio"    icon="directorio"    label="Directorio de clientes" />
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Finanzas'}</p>
        <p className="text-xs text-gray-400">Finanzas</p>
        <button onClick={async () => { await logout(); navigate('/login') }}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545] transition-colors">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
