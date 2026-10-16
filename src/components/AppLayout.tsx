import { Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="afterparty-gradient min-h-dvh w-full text-[var(--color-fg)]">
      <Outlet />
    </div>
  )
}
