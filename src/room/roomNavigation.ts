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

/** Full player portal on the room URL whenever a session is active (ignore mini-player viewMode). */
export function shouldShowFullRoomPlayer(activeRoomId: string | null, pathname: string): boolean {
  if (!activeRoomId || !isRoomRoute(pathname)) return false
  return true
}

/** Hidden off-screen player keeps sync alive only when away from the room page. */
export function shouldRunBackgroundRoomPlayer(
  activeRoomId: string | null,
  pathname: string,
  viewMode: RoomViewMode,
): boolean {
  if (!activeRoomId || viewMode !== 'minimized') return false
  return !isRoomRoute(pathname)
}
