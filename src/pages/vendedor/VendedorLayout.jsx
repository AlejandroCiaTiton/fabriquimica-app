import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'

export default function VendedorLayout() {
  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <Sidebar />
      <main className="ml-60 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
