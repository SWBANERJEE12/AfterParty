import type { RoomViewMode } from './RoomSessionContext'

const ROOM_PATH = /^\/room\/[^/]+/

export function isRoomRoute(pathname: string): boolean {
  return ROOM_PATH.test(pathname)
}

/** When leaving the room URL while still in full view, switch to mini-player mode. */
export function shouldAutoMinimizeRoom(
  activeRoomId: string | null,
  pathname: string,
  viewMode: RoomViewMode,
): boolean {
  if (!activeRoomId || viewMode !== 'full') return false
  return !isRoomRoute(pathname)
}

/** Full player portal only on the room page (not on Discover, etc.). */
export function shouldShowFullRoomPlayer(
  activeRoomId: string | null,
  pathname: string,
  viewMode: RoomViewMode,
): boolean {
  if (!activeRoomId || !isRoomRoute(pathname)) return false
  return viewMode === 'full' || viewMode === 'hidden'
}
