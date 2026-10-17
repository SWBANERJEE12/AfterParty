import { useLocation } from 'react-router-dom'

/** Pathname for layout/session logic when the address bar and router context diverge. */
export function useEffectivePathname(): string {
  const { pathname } = useLocation()
  if (typeof window === 'undefined') return pathname
  const browserPath = window.location.pathname
  return browserPath !== pathname ? browserPath : pathname
}
