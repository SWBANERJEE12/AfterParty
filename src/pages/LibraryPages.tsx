import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getSupabase } from '../lib/supabase'

export function MyListPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<{ id: string; title: string; poster_url: string | null }[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const supabase = getSupabase()
    if (!supabase) return
    void supabase
      .from('my_list_items')
      .select('id, title, poster_url')
      .eq('user_id', profile.id)
      .order('added_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setItems(data ?? [])
      })
  }, [profile])

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">My List</h1>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {items.length === 0 && <p className="mt-4 text-sm text-[var(--color-muted)]">No saved titles yet. Add from Discover.</p>}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {items.map((i) => (
          <li key={i.id} className="glass-panel rounded-lg p-2">
            {i.poster_url && <img src={i.poster_url} alt="" className="aspect-[2/3] w-full rounded object-cover" />}
            <p className="mt-2 text-xs font-medium">{i.title}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WatchHistoryPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<{ id: string; title: string; last_watched_at: string }[]>([])

  useEffect(() => {
    if (!profile) return
    const supabase = getSupabase()
    if (!supabase) return
    void supabase
      .from('watch_history')
      .select('id, title, last_watched_at')
      .eq('user_id', profile.id)
      .order('last_watched_at', { ascending: false })
      .then(({ data }) => setItems(data ?? []))
  }, [profile])

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Watch history</h1>
      <p className="text-sm text-[var(--color-muted)]">Recorded when playback progress is saved (migration 010).</p>
      {items.length === 0 && <p className="mt-4 text-sm text-[var(--color-muted)]">No history yet.</p>}
      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="glass-panel rounded-lg px-4 py-3 text-sm">
            {i.title}
            <span className="ml-2 text-xs text-[var(--color-muted)]">
              {new Date(i.last_watched_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function VotingPage() {
  return (
    <div className="mx-auto max-w-lg glass-panel rounded-xl p-6">
      <h1 className="text-xl font-semibold">Room voting</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Movie proposals and voting happen inside an active watch room (room shortlist). Open a party from Create/Join
        Room, then use Discover → Propose to room.
      </p>
    </div>
  )
}
