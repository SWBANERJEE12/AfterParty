import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getSupabase } from '../../lib/supabase'
import { discoverNavItem, primarySidebarLinks, sidebarLinks } from '../../layouts/sidebarNav'
import { DiscoverNavLink } from './DiscoverNavLink'

export function AppSidebar({
  mobileOpen,
  onClose,
  collapsed,
  onToggleCollapsed,
}: {
  mobileOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
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
    `flex items-center rounded-lg text-sm transition ${
      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
    } ${
      isActive
        ? 'bg-[var(--color-accent)]/20 text-[var(--color-fg)] font-medium'
        : 'text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]'
    }`

  const mobilePointer =
    mobileOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none -translate-x-full md:pointer-events-auto md:translate-x-0'

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
        className={`glass-panel fixed z-50 flex h-full shrink-0 flex-col border-r border-[var(--color-border)] transition-[width,transform] duration-200 md:static ${mobilePointer} ${
          collapsed ? 'w-14 p-2' : 'w-64 p-4'
        }`}
      >
        <div className={`mb-4 flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between gap-2'}`}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-lg font-semibold text-[var(--color-fg)]">Afterparty</p>
              {profile && <p className="text-xs text-[var(--color-muted)]">@{profile.username}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] md:inline-block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {primarySidebarLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={navClass}
              onClick={onClose}
              title={item.label}
            >
              <span aria-hidden className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="ml-2 truncate">{item.label}</span>}
              {collapsed && <span className="sr-only">{item.label}</span>}
            </NavLink>
          ))}
          <DiscoverNavLink
            className={navClass}
            onNavigate={onClose}
            collapsed={collapsed}
            icon={discoverNavItem.icon}
            label={discoverNavItem.label}
          />
          {sidebarLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={navClass}
              onClick={onClose}
              title={item.label}
            >
              {collapsed ? (
                <span className="relative" aria-hidden>
                  {item.icon}
                  {item.badge && pendingCount > 0 && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </span>
              ) : (
                <span className="flex w-full items-center justify-between gap-2">
                  <span>{item.label}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] text-white">
                      {pendingCount}
                    </span>
                  )}
                </span>
              )}
              {collapsed && <span className="sr-only">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        {session ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className={`mt-4 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] ${
              collapsed ? 'px-2 py-2' : 'px-3 py-2'
            }`}
            title="Log out"
          >
            {collapsed ? '⎋' : 'Log out'}
          </button>
        ) : (
          <Link
            to="/sign-in"
            className={`mt-4 block rounded-lg bg-[var(--color-accent)] text-center text-sm font-semibold text-white ${
              collapsed ? 'px-2 py-2' : 'px-3 py-2'
            }`}
            title="Sign in"
          >
            {collapsed ? '→' : 'Sign in'}
          </Link>
        )}
      </aside>
    </>
  )
}
