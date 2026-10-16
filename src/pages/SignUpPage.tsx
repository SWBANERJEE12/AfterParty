import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { GradientShell } from '../components/GradientShell'

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    const res = await signUp({ username, password, displayName: displayName || username })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setInfo('Account created. If email confirmation is enabled in Supabase, confirm before signing in.')
    navigate('/sign-in', { replace: true })
  }

  return (
    <GradientShell className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={onSubmit} className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">Create account</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Username and password only — no social login.</p>
        <label className="mt-6 block text-xs text-[var(--color-muted)]">
          Username
          <input
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-black/20 px-3 py-2.5 text-[var(--color-fg)]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="mt-4 block text-xs text-[var(--color-muted)]">
          Display name
          <input
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-black/20 px-3 py-2.5 text-[var(--color-fg)]"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-xs text-[var(--color-muted)]">
          Password
          <input
            type="password"
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-black/20 px-3 py-2.5 text-[var(--color-fg)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {info && <p className="mt-4 text-sm text-[var(--color-muted)]">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[var(--color-accent)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
          Already have an account? <Link to="/sign-in" className="text-[var(--color-accent)]">Sign in</Link>
        </p>
      </form>
    </GradientShell>
  )
}
