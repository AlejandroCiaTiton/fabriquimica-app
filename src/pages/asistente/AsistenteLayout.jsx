import { Outlet } from 'react-router-dom'
import SidebarAsistente from '../../components/layout/SidebarAsistente'

export default function AsistenteLayout() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <SidebarAsistente />
      <main className="ml-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
