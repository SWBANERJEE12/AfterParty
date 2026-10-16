import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, authConfigured } = useAuth()
  const location = useLocation()

  if (!authConfigured) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-center text-sm text-[var(--color-muted)]">
        Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>.
      </div>
    )
  }

  if (loading) {
    return <div className="flex min-h-full items-center justify-center text-sm text-[var(--color-muted)]">Loading…</div>
  }

  if (!session) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  }

  return children
}
