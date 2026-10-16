import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { GradientShell } from '../components/GradientShell'

export function WelcomePage() {
  const { loading, session, authConfigured } = useAuth()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (loading || session) return
    const seen = sessionStorage.getItem('afterparty_intro_seen')
    if (!seen) {
      setShowIntro(true)
      const t = window.setTimeout(() => {
        sessionStorage.setItem('afterparty_intro_seen', '1')
        setShowIntro(false)
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [loading, session])

  if (!authConfigured) {
    return (
      <GradientShell className="flex min-h-dvh items-center justify-center p-8">
        <p className="max-w-md text-center text-sm text-[var(--color-muted)]">
          Configure Supabase in <code>.env.local</code> to enable accounts. Watch-party guest flows remain available
          from Help.
        </p>
      </GradientShell>
    )
  }

  if (!loading && session) {
    return <Navigate to="/home" replace />
  }

  return (
    <GradientShell className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div
        className={`text-center transition-opacity duration-700 ${showIntro ? 'opacity-0' : 'opacity-100'}`}
        style={{ transitionProperty: 'opacity, transform' }}
      >
        <p className="text-xs font-medium tracking-[0.35em] text-[var(--color-accent)] uppercase">Watch together</p>
        <h1
          className={`mt-4 text-5xl font-semibold tracking-tight text-white md:text-6xl ${
            showIntro ? 'scale-95' : 'scale-100'
          } transition-transform duration-700`}
        >
          Afterparty
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
          Your cinematic home for discovery, friends, and private watch parties.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/sign-in"
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Sign in
          </Link>
          <Link
            to="/sign-up"
            className="rounded-lg border border-[var(--color-border)] glass-panel px-6 py-3 text-sm font-semibold text-[var(--color-fg)] transition hover:border-[var(--color-accent)]/50"
          >
            Create account
          </Link>
        </div>
        <p className="mt-8 text-xs text-[var(--color-muted)]">
          <Link to="/party" className="underline hover:text-[var(--color-accent)]">Join a watch party</Link> without an
          account (guest nickname).
        </p>
      </div>
    </GradientShell>
  )
}
