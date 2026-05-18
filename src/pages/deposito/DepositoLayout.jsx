import { Outlet } from 'react-router-dom'
import SidebarDeposito from '../../components/layout/SidebarDeposito'

export default function DepositoLayout() {
  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      <SidebarDeposito />
      <main className="ml-60 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
