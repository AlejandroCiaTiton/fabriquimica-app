import { Outlet } from 'react-router-dom'
import SidebarChofer from '../../components/layout/SidebarChofer'

export default function ChoferLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarChofer />
      <main className="ml-60 flex-1 min-h-screen overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
