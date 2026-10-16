import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { GradientShell } from '../components/GradientShell'

export function SignInPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn(username, password)
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    navigate('/home', { replace: true })
  }

  return (
    <GradientShell className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={onSubmit} className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Use your Afterparty username and password.</p>
        <label className="mt-6 block text-xs text-[var(--color-muted)]">
          Username
          <input
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-black/20 px-3 py-2.5 text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/40 focus:ring-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="mt-4 block text-xs text-[var(--color-muted)]">
          Password
          <input
            type="password"
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-black/20 px-3 py-2.5 text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/40 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[var(--color-accent)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
          New here? <Link to="/sign-up" className="text-[var(--color-accent)]">Create account</Link>
        </p>
      </form>
    </GradientShell>
  )
}
