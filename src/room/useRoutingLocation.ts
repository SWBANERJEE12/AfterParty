import { useLocation, type Location } from 'react-router-dom'

/** When the address bar and React Router diverge, match routes from the address bar. */
export function useRoutingLocation(): Location {
  const location = useLocation()
  if (typeof window === 'undefined') return location

  const browserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const routerPath = `${location.pathname}${location.search}${location.hash}`
  if (browserPath === routerPath) return location

  return {
    ...location,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    key: `browser-sync-${browserPath}`,
  }
}
