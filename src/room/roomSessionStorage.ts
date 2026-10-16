const ACTIVE_ROOM_KEY = 'afterparty_active_room'

export function getStoredActiveRoomId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_ROOM_KEY)
  } catch {
    return null
  }
}

export function setStoredActiveRoomId(roomId: string | null) {
  try {
    if (roomId) sessionStorage.setItem(ACTIVE_ROOM_KEY, roomId)
    else sessionStorage.removeItem(ACTIVE_ROOM_KEY)
  } catch {
    /* ignore */
  }
}
