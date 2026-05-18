import { Outlet } from 'react-router-dom'
import SidebarProduccion from '../../components/layout/SidebarProduccion'

export default function ProduccionLayout() {
  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <SidebarProduccion />
      <main className="ml-60 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
