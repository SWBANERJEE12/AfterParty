import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { getStoredActiveRoomId, setStoredActiveRoomId } from './roomSessionStorage'

export type RoomViewMode = 'full' | 'minimized' | 'hidden'

type RoomSessionContextValue = {
  activeRoomId: string | null
  viewMode: RoomViewMode
  enterRoom: (roomId: string) => void
  minimizeRoom: () => void
  expandRoom: () => void
  leaveRoom: () => void
  leaveRequested: boolean
  acknowledgeLeave: () => void
}

const RoomSessionContext = createContext<RoomSessionContextValue | null>(null)

export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => getStoredActiveRoomId())
  const [viewMode, setViewMode] = useState<RoomViewMode>('full')
  const [leaveRequested, setLeaveRequested] = useState(false)

  const enterRoom = useCallback((roomId: string) => {
    setStoredActiveRoomId(roomId)
    setActiveRoomId(roomId)
    setViewMode('full')
    setLeaveRequested(false)
  }, [])

  const minimizeRoom = useCallback(() => {
    setViewMode('minimized')
  }, [])

  const expandRoom = useCallback(() => {
    setViewMode('full')
  }, [])

  const leaveRoom = useCallback(() => {
    setLeaveRequested(true)
  }, [])

  const acknowledgeLeave = useCallback(() => {
    setStoredActiveRoomId(null)
    setActiveRoomId(null)
    setViewMode('hidden')
    setLeaveRequested(false)
  }, [])

  const value = useMemo(
    () => ({
      activeRoomId,
      viewMode,
      enterRoom,
      minimizeRoom,
      expandRoom,
      leaveRoom,
      leaveRequested,
      acknowledgeLeave,
    }),
    [activeRoomId, viewMode, enterRoom, minimizeRoom, expandRoom, leaveRoom, leaveRequested, acknowledgeLeave],
  )

  return <RoomSessionContext.Provider value={value}>{children}</RoomSessionContext.Provider>
}

export function useRoomSession() {
  const ctx = useContext(RoomSessionContext)
  if (!ctx) throw new Error('useRoomSession requires RoomSessionProvider')
  return ctx
}

export function useOptionalRoomSession() {
  return useContext(RoomSessionContext)
}
