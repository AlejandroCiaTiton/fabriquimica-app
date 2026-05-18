import { Outlet } from 'react-router-dom'
import SidebarLaboratorio from '../../components/layout/SidebarLaboratorio'

export default function LaboratorioLayout() {
  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <SidebarLaboratorio />
      <main className="ml-60 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
