import { NavLink } from 'react-router-dom'
import { useOptionalRoomSession } from '../../room/RoomSessionContext'

type Props = {
  className: (args: { isActive: boolean }) => string
  onNavigate?: () => void
  collapsed?: boolean
  icon?: string
  label?: string
}

export function DiscoverNavLink({
  className,
  onNavigate,
  collapsed = false,
  icon = '◎',
  label = 'Discover',
}: Props) {
  const roomSession = useOptionalRoomSession()

  return (
    <NavLink
      to="/discover"
      className={className}
      title={label}
      onClick={() => {
        if (roomSession?.activeRoomId && roomSession.viewMode === 'full') {
          roomSession.minimizeRoom()
        }
        onNavigate?.()
      }}
    >
      <span aria-hidden>{icon}</span>
      {collapsed ? <span className="sr-only">{label}</span> : <span className="ml-2">{label}</span>}
    </NavLink>
  )
}
