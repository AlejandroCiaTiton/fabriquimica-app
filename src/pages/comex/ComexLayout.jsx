import { Outlet } from 'react-router-dom'
import SidebarComex from '../../components/layout/SidebarComex'

export default function ComexLayout() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <SidebarComex />
      <main className="ml-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
