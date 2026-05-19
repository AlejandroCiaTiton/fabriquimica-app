import { Outlet } from 'react-router-dom'
import SidebarCliente from '../../components/layout/SidebarCliente'
import { useCotizacionesCliente } from '../../hooks/useCotizacionesCliente'
import { useClientePerfil } from '../../hooks/useClientePerfil'
import { useMuestrasClientePendientesCount } from '../../hooks/useMuestras'

export default function ClienteLayout() {
  const { data: cotizaciones = [] } = useCotizacionesCliente()
  const { data: perfil } = useClientePerfil()
  const badgeMuestras    = useMuestrasClientePendientesCount()
  const pendientes       = cotizaciones.filter(c => c.estado === 'espera').length
  const perfilIncompleto = perfil && !(perfil.afip_url && perfil.ingresos_brutos_url && perfil.horario_entrega && perfil.telefonos_recepcion)

  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <SidebarCliente
        badgeCotizaciones={pendientes}
        perfilIncompleto={!!perfilIncompleto}
        badgeMuestras={badgeMuestras}
      />
      <main className="ml-60 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
