const MEMBER_KEY = 'afterparty_member_key'
const NICKNAME_KEY = 'afterparty_nickname'
const NICKNAME_CHANGE_EVENT = 'afterparty:nickname-change'

export function getOrCreateMemberKey(): string {
  const existing = sessionStorage.getItem(MEMBER_KEY)
  if (existing) return existing
  const key = crypto.randomUUID()
  sessionStorage.setItem(MEMBER_KEY, key)
  return key
}

export function getStoredNickname(): string | null {
  return sessionStorage.getItem(NICKNAME_KEY)
}

export function subscribeNickname(onChange: () => void): () => void {
  const handler = () => onChange()
  window.addEventListener(NICKNAME_CHANGE_EVENT, handler)
  return () => window.removeEventListener(NICKNAME_CHANGE_EVENT, handler)
}

export function setStoredNickname(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  sessionStorage.setItem(NICKNAME_KEY, trimmed)
  window.dispatchEvent(new Event(NICKNAME_CHANGE_EVENT))
}

export function isValidNicknameInput(name: string): boolean {
  const t = name.trim()
  return t.length >= 1 && t.length <= 24
}
