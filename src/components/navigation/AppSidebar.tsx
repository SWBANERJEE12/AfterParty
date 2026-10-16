import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getSupabase } from '../../lib/supabase'
import { DiscoverNavLink } from './DiscoverNavLink'

type NavLinkItem = { to: string; label: string; end?: boolean; badge?: boolean }

const primaryLinks: NavLinkItem[] = [{ to: '/home', label: 'Home', end: true }]

const links: NavLinkItem[] = [
  { to: '/party/create', label: 'Create Room' },
  { to: '/party/join', label: 'Join Room' },
  { to: '/friends', label: 'Friends', badge: true },
  { to: '/voting', label: 'Voting' },
  { to: '/my-list', label: 'My List' },
  { to: '/history', label: 'Watch History' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
  { to: '/legal/privacy', label: 'Privacy' },
  { to: '/legal/terms', label: 'Terms' },
  { to: '/help', label: 'Help' },
]

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { profile, session, signOut } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase || !profile?.id) return
    void (async () => {
      const { count } = await supabase
        .from('friend_requests')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', profile.id)
        .eq('status', 'pending')
      setPendingCount(count ?? 0)
    })()
  }, [profile?.id])

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm transition ${
      isActive
        ? 'bg-[var(--color-accent)]/20 text-[var(--color-fg)] font-medium'
        : 'text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]'
    }`

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
      <aside
        className={`glass-panel fixed z-50 flex h-full w-64 flex-col border-r border-[var(--color-border)] p-4 transition-transform md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="mb-6">
          <p className="text-lg font-semibold text-[var(--color-fg)]">Afterparty</p>
          {profile && (
            <p className="text-xs text-[var(--color-muted)]">@{profile.username}</p>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {primaryLinks.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass} onClick={onClose}>
              {item.label}
            </NavLink>
          ))}
          <DiscoverNavLink className={navClass} onNavigate={onClose} />
          {links.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass} onClick={onClose}>
              <span className="flex items-center justify-between gap-2">
                {item.label}
                {item.badge && pendingCount > 0 && (
                  <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] text-white">
                    {pendingCount}
                  </span>
                )}
              </span>
            </NavLink>
          ))}
        </nav>
        {session ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            Log out
          </button>
        ) : (
          <Link
            to="/sign-in"
            className="mt-4 block rounded-lg bg-[var(--color-accent)] px-3 py-2 text-center text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        )}
      </aside>
    </>
  )
}
