import { Outlet } from 'react-router-dom'
import SidebarFinanzas from '../../components/layout/SidebarFinanzas'

export default function FinanzasLayout() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <SidebarFinanzas />
      <main className="ml-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
