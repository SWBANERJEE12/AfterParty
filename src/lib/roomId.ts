const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Cryptographically unpredictable room id (URL-safe, ~12 chars). */
export function generateRoomId(length = 12): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return id
}

export function normalizeRoomId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9]/g, '')
}

export function isValidRoomId(id: string): boolean {
  return id.length >= 8 && id.length <= 24
}

export function roomInviteUrl(roomId: string): string {
  const base = window.location.origin
  return `${base}/room/${encodeURIComponent(roomId)}`
}
