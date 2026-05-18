import { Outlet } from 'react-router-dom'
import SidebarAdmin from '../../components/layout/SidebarAdmin'

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <SidebarAdmin />
      <main className="ml-60 flex-1 min-w-0"><Outlet /></main>
    </div>
  )
}
