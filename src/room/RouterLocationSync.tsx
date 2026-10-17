import { useLayoutEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Keeps React Router location aligned with the address bar when they diverge.
 * Does not patch history.pushState.
 */
export function RouterLocationSync() {
  const location = useLocation()
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const syncFromBrowser = () => {
      const browserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const routerPath = `${location.pathname}${location.search}${location.hash}`
      if (browserPath !== routerPath) {
        navigate(browserPath, { replace: true })
      }
    }
    syncFromBrowser()
  })

  useLayoutEffect(() => {
    const onPopState = () => {
      const browserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const routerPath = `${location.pathname}${location.search}${location.hash}`
      if (browserPath !== routerPath) {
        navigate(browserPath, { replace: true })
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [location.pathname, location.search, location.hash, navigate])

  return null
}
