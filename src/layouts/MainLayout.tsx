import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '../components/navigation/AppSidebar'
import { useOptionalRoomSession } from '../room/RoomSessionContext'

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const roomSession = useOptionalRoomSession()
  const manualExpandRoomRef = useRef<string | null>(null)
  const isRoom = /^\/room\/[^/]+/.test(location.pathname)

  useEffect(() => {
    const roomId = roomSession?.activeRoomId
    if (!roomId) {
      manualExpandRoomRef.current = null
      setCollapsed(false)
      return
    }
    if (manualExpandRoomRef.current === roomId) return
    setCollapsed(true)
  }, [roomSession?.activeRoomId])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (!next && roomSession?.activeRoomId) {
        manualExpandRoomRef.current = roomSession.activeRoomId
      }
      return next
    })
  }

  return (
    <div className="afterparty-gradient flex min-h-dvh w-full">
      <AppSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 md:px-6">
          <button
            type="button"
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            Menu
          </button>
        </header>
        <main className={`flex-1 overflow-auto ${isRoom ? 'p-0' : 'p-4 md:p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
