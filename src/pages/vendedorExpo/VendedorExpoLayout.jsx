import { Outlet } from 'react-router-dom'
import SidebarVendedorExpo from '../../components/layout/SidebarVendedorExpo'

export default function VendedorExpoLayout() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <SidebarVendedorExpo />
      <main className="ml-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
