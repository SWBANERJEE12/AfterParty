import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useSupabaseConnection } from '../hooks/useSupabaseConnection'
import { createRoomInSupabase, roomExists } from '../hooks/useWatchRoom'
import { generateRoomId, isValidRoomId, normalizeRoomId } from '../lib/roomId'
import { getStoredNickname, isValidNicknameInput, setStoredNickname } from '../lib/session'
import { useRoomSession } from '../room/RoomSessionContext'

export function LandingPage({ mode: initialMode = 'create' }: { mode?: 'create' | 'join' }) {
  const navigate = useNavigate()
  const { enterRoom } = useRoomSession()
  const { profile } = useAuth()
  const supabaseConnection = useSupabaseConnection()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'create' | 'join'>(initialMode)

  useEffect(() => {
    const stored = getStoredNickname()
    if (stored && !nickname) setNickname(stored)
  }, [nickname])

  useEffect(() => {
    if (profile?.display_name && !nickname && !getStoredNickname()) setNickname(profile.display_name)
  }, [profile?.display_name, nickname])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseReady = supabaseConnection.phase === 'connected'

  const goRoom = (roomId: string, name: string) => {
    setStoredNickname(name)
    enterRoom(roomId)
    navigate(`/room/${roomId}`)
  }

  const validateNickname = (): string | null => {
    const name = nickname.trim()
    if (!isValidNicknameInput(name)) {
      setError('Enter a nickname (1–24 characters, not only spaces).')
      return null
    }
    return name
  }

  const handleCreate = async () => {
    const name = validateNickname()
    if (!name) return
    setError(null)
    if (!supabaseReady) {
      setError('Supabase must be configured and reachable before creating a room. See SETUP.md.')
      return
    }
    setLoading(true)
    try {
      const roomId = generateRoomId(12)
      const res = await createRoomInSupabase(roomId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      goRoom(roomId, name)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    const name = validateNickname()
    if (!name) return
    const roomId = normalizeRoomId(joinCode)
    setError(null)
    if (!isValidRoomId(roomId)) {
      setError('Enter a valid room code from your invite link.')
      return
    }
    if (!supabaseReady) {
      setError('Supabase must be configured and reachable before joining a room. See SETUP.md.')
      return
    }
    setLoading(true)
    try {
      const exists = await roomExists(roomId)
      if (!exists) {
        setError('Room not found. Ask your host for a new invite link.')
        return
      }
      goRoom(roomId, name)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <p className="mb-3 text-center text-xs font-medium tracking-[0.25em] text-[var(--color-accent)] uppercase">
          Watch together
        </p>
        <h1 className="text-center text-4xl font-semibold tracking-tight text-white">Afterparty</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-[var(--color-muted)]">
          Private rooms for movies with friends. Synced playback and voice chat arrive in later phases.
        </p>

        {supabaseConnection.phase === 'misconfigured' && (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
            Supabase is not configured. Add <code className="text-amber-200">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-amber-200">VITE_SUPABASE_PUBLISHABLE_KEY</code> to{' '}
            <code className="text-amber-200">.env.local</code> — see <code className="text-amber-200">SETUP.md</code>.
          </div>
        )}
        {supabaseConnection.phase === 'checking' && (
          <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-muted)]">
            Checking Supabase connection…
          </div>
        )}
        {supabaseConnection.phase === 'error' && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            Supabase credentials are set but the project is not reachable: {supabaseConnection.message}. Run migrations
            and <code className="text-red-100">npm run check:supabase</code>.
          </div>
        )}
        {supabaseConnection.phase === 'connected' && (
          <div className="mt-6 rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100/90">
            Supabase connected — you can create or join rooms.
          </div>
        )}

        <div className="mt-8 flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition ${
              mode === 'create' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)] hover:text-white'
            }`}
            onClick={() => {
              setMode('create')
              setError(null)
            }}
          >
            Create room
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition ${
              mode === 'join' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)] hover:text-white'
            }`}
            onClick={() => {
              setMode('join')
              setError(null)
            }}
          >
            Join room
          </button>
        </div>

        <label className="mt-6 block text-xs text-[var(--color-muted)]">
          Nickname
          <input
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-white outline-none ring-[var(--color-accent)]/40 focus:ring-2"
            placeholder="Your name"
            maxLength={24}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>

        {mode === 'join' && (
          <label className="mt-4 block text-xs text-[var(--color-muted)]">
            Room code
            <input
              className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 font-mono text-sm tracking-wider text-white outline-none ring-[var(--color-accent)]/40 focus:ring-2"
              placeholder="Paste code from invite link"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
          </label>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <button
          type="button"
          disabled={loading || !supabaseReady}
          className="mt-6 w-full rounded-lg bg-[var(--color-accent)] py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          onClick={mode === 'create' ? handleCreate : handleJoin}
        >
          {loading ? 'Please wait…' : mode === 'create' ? 'Create room' : 'Join room'}
        </button>
      </div>
    </div>
  )
}
