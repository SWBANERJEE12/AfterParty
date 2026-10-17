export type SidebarNavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  badge?: boolean
}

export const primarySidebarLinks: SidebarNavItem[] = [{ to: '/home', label: 'Home', icon: '⌂', end: true }]

export const sidebarLinks: SidebarNavItem[] = [
  { to: '/party/create', label: 'Create Room', icon: '＋' },
  { to: '/party/join', label: 'Join Room', icon: '↪' },
  { to: '/friends', label: 'Friends', icon: '👥', badge: true },
  { to: '/voting', label: 'Voting', icon: '✓' },
  { to: '/my-list', label: 'My List', icon: '☰' },
  { to: '/history', label: 'Watch History', icon: '◷' },
  { to: '/profile', label: 'Profile', icon: '◎' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
  { to: '/legal/privacy', label: 'Privacy', icon: '🔒' },
  { to: '/legal/terms', label: 'Terms', icon: '§' },
  { to: '/help', label: 'Help', icon: '?' },
]

export const discoverNavItem: SidebarNavItem = { to: '/discover', label: 'Discover', icon: '🔍' }
