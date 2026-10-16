import { useSyncExternalStore } from 'react'
import { getStoredNickname, subscribeNickname } from '../lib/session'

/** Live nickname from sessionStorage (updates when setStoredNickname runs). */
export function useStoredNickname() {
  const raw = useSyncExternalStore(subscribeNickname, getStoredNickname, () => null)
  const trimmed = raw?.trim() ?? ''
  const hasValid = trimmed.length > 0 && trimmed.length <= 24
  return {
    stored: hasValid ? trimmed : null,
    /** UI fallback only when no nickname has been saved. */
    displayName: hasValid ? trimmed : 'Guest',
  }
}
