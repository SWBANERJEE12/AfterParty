import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export function ProfilePage() {
  const { profile, profileLoadIssue, session, loading, refreshProfile, updateProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [msg, setMsg] = useState<string | null>(null)

  if (loading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading profile…</p>
  }

  if (!session) {
    return <p className="text-sm text-[var(--color-muted)]">Sign in to view your profile.</p>
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold">Profile</h1>
        {profileLoadIssue === 'missing_table' ? (
          <>
            <p className="text-sm text-amber-100/90">
              The <code className="text-amber-200">profiles</code> table is missing in Supabase. Apply migration{' '}
              <code className="text-amber-200">008_profiles_auth.sql</code> from{' '}
              <code className="text-amber-200">supabase/migrations/</code> in the SQL Editor, then refresh.
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              Migration 008 creates <code>public.profiles</code>, RLS policies, and the{' '}
              <code>handle_new_user</code> trigger for new sign-ups.
            </p>
          </>
        ) : profileLoadIssue === 'not_found' ? (
          <p className="text-sm text-[var(--color-muted)]">
            No profile row for this account. Sign out and sign up again after migration 008 is applied, or insert a
            profile row for your user id in Supabase.
          </p>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Profile could not be loaded. Check Supabase connection.</p>
        )}
        <button
          type="button"
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          onClick={() => void refreshProfile()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="glass-panel rounded-xl p-4">
        <p className="text-xs text-[var(--color-muted)]">@{profile.username}</p>
        <p className="text-xs text-[var(--color-muted)]">Joined {new Date(profile.created_at).toLocaleDateString()}</p>
        <label className="mt-4 block text-xs text-[var(--color-muted)]">
          Display name
          <input
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--color-muted)]">
          Avatar URL
          <input
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="mt-4 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm text-white"
          onClick={async () => {
            const res = await updateProfile({
              display_name: displayName.trim() || profile.display_name,
              avatar_url: avatarUrl.trim() || null,
            })
            setMsg(res.ok ? 'Saved.' : res.error)
          }}
        >
          Save
        </button>
        {msg && <p className="mt-2 text-xs text-[var(--color-muted)]">{msg}</p>}
      </div>
    </div>
  )
}
