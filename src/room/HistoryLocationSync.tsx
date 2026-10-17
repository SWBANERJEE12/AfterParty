import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Reconcile React Router location when the address bar changes without a router transition. */
export function HistoryLocationSync() {
  const navigate = useNavigate()
  const location = useLocation()
  const applyingRef = useRef(false)

  useEffect(() => {
    const syncFromAddressBar = () => {
      if (applyingRef.current) return
      const browserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const routerPath = `${location.pathname}${location.search}${location.hash}`
      if (browserPath === routerPath) return
      applyingRef.current = true
      navigate(browserPath, { replace: true })
      queueMicrotask(() => {
        applyingRef.current = false
      })
    }

    window.addEventListener('popstate', syncFromAddressBar)

    const pushState = history.pushState.bind(history)
    const replaceState = history.replaceState.bind(history)

    history.pushState = (...args) => {
      pushState(...args)
      syncFromAddressBar()
    }
    history.replaceState = (...args) => {
      replaceState(...args)
      syncFromAddressBar()
    }

    return () => {
      window.removeEventListener('popstate', syncFromAddressBar)
      history.pushState = pushState
      history.replaceState = replaceState
    }
  }, [location.pathname, location.search, location.hash, navigate])

  return null
}
