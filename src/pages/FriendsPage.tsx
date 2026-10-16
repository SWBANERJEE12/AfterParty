import { useCallback, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getSupabase } from '../lib/supabase'
import type { Profile } from '../auth/types'

export function FriendsPage() {
  const { profile } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const search = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase not configured.')
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, created_at, preferences')
      .ilike('username', `${q}%`)
      .limit(10)
    setLoading(false)
    if (err) {
      setError(err.message.includes('does not exist') ? 'Apply migration 008_profiles_auth.sql in Supabase.' : err.message)
      return
    }
    setResults((data as Profile[]).filter((p) => p.id !== profile?.id))
  }, [query, profile?.id])

  const sendRequest = async (toUserId: string) => {
    setMessage(null)
    const supabase = getSupabase()
    if (!supabase || !profile) return
    const { error: err } = await supabase.from('friend_requests').insert({
      from_user_id: profile.id,
      to_user_id: toUserId,
      status: 'pending',
    })
    if (err) setError(err.message)
    else setMessage('Friend request sent.')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Friends</h1>
      <p className="text-sm text-[var(--color-muted)]">Search by unique username. Requires migrations 008 and 009.</p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Username"
          className="flex-1 rounded-lg border border-[var(--color-border)] glass-panel px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void search()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>
      {loading && <p className="text-sm text-[var(--color-muted)]">Searching…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      <ul className="space-y-2">
        {results.map((p) => (
          <li key={p.id} className="glass-panel flex items-center justify-between rounded-xl p-3">
            <div>
              <p className="font-medium">{p.display_name}</p>
              <p className="text-xs text-[var(--color-muted)]">@{p.username}</p>
            </div>
            <button
              type="button"
              onClick={() => void sendRequest(p.id)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs"
            >
              Add friend
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
