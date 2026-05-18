import { Outlet } from 'react-router-dom'
import SidebarCliente from '../../components/layout/SidebarCliente'
import { useCotizacionesCliente } from '../../hooks/useCotizacionesCliente'

export default function ClienteLayout() {
  const { data: cotizaciones = [] } = useCotizacionesCliente()
  const pendientes = cotizaciones.filter(c => c.estado === 'espera').length

  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <SidebarCliente badgeCotizaciones={pendientes} />
      <main className="ml-60 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
