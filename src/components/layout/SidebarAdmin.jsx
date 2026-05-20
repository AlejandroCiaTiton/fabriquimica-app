import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

const db = supabaseAdmin ?? supabase

const ICONOS = {
  precios:      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  stock:        'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  clientes:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  solicitudes:  'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  usuarios:     'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  contratipos:  'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
}

function usePendientesAdminCount() {
  return useQuery({
    queryKey: ['admin', 'pendientes_count'],
    queryFn: async () => {
      const [{ count: sol }, { count: cli }] = await Promise.all([
        db.from('solicitudes_alta').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        db.from('clientes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      ])
      return (sol ?? 0) + (cli ?? 0)
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  })
}

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[#004a99] text-white' : 'text-gray-600 hover:bg-gray-100'}`
    }>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONOS[icon]}/>
      </svg>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#dc3545] text-white text-[10px] font-bold px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

export default function SidebarAdmin() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const { data: pendientesCount = 0 } = usePendientesAdminCount()

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <div className="px-5 py-4 border-b border-green-900 bg-[#1b4332]">
        <img src="/logo_fabriquimica.png" alt="Fabriquímica" className="h-8 object-contain" />
        <p className="text-xs text-green-200 mt-0.5">Administración</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/admin/precios"          icon="precios"     label="Precios" />
        <NavItem to="/admin/stock"            icon="stock"       label="Stock" />
        <NavItem to="/admin/clientes"         icon="clientes"    label="Clientes" />
        <NavItem to="/admin/solicitudes-alta" icon="solicitudes" label="Solicitudes de alta" badge={pendientesCount} />
        <NavItem to="/admin/usuarios"         icon="usuarios"    label="Admins" />
        <NavItem to="/admin/contratipos"      icon="contratipos" label="Contratipos" />
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre || 'Admin'}</p>
        <button onClick={async () => { await logout(); navigate('/login') }}
          className="mt-2 text-xs text-gray-500 hover:text-[#dc3545]">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
