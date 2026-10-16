import { useEffect, useState } from 'react'
import {
  isSupabaseConfigured,
  verifySupabaseConnection,
  type SupabaseConnectionStatus,
} from '../lib/supabase'

type ConnectionUiState =
  | { phase: 'misconfigured' }
  | { phase: 'checking' }
  | { phase: 'connected' }
  | { phase: 'error'; message: string }

export function useSupabaseConnection(): ConnectionUiState {
  const [state, setState] = useState<ConnectionUiState>(() =>
    isSupabaseConfigured ? { phase: 'checking' } : { phase: 'misconfigured' },
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({ phase: 'misconfigured' })
      return
    }

    let cancelled = false
    setState({ phase: 'checking' })

    verifySupabaseConnection().then((result: SupabaseConnectionStatus) => {
      if (cancelled) return
      if (result.state === 'misconfigured') setState({ phase: 'misconfigured' })
      else if (result.state === 'connected') setState({ phase: 'connected' })
      else setState({ phase: 'error', message: result.message })
    })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
