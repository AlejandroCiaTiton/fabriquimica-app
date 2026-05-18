import { Outlet } from 'react-router-dom'
import SidebarLogistica from '../../components/layout/SidebarLogistica'

export default function LogisticaLayout() {
  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <SidebarLogistica />
      <main className="ml-60 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
