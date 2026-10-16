import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export function SettingsPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="glass-panel rounded-xl p-4">
        <h2 className="text-sm font-semibold">Password</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="mt-3 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm text-white"
          onClick={async () => {
            const res = await updatePassword(password)
            setMsg(res.ok ? 'Password updated.' : res.error)
          }}
        >
          Update password
        </button>
        {msg && <p className="mt-2 text-xs text-[var(--color-muted)]">{msg}</p>}
      </section>
    </div>
  )
}
