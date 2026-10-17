import { NavLink, useLocation, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <NavLink
      to="/discover"
      className={className}
      title={label}
      onClick={(e) => {
        e.preventDefault()
        if (roomSession?.activeRoomId && roomSession.viewMode === 'full') {
          roomSession.minimizeRoom()
        }
        if (location.pathname !== '/discover') {
          navigate('/discover')
        }
        onNavigate?.()
      }}
    >
      <span aria-hidden>{icon}</span>
      {collapsed ? <span className="sr-only">{label}</span> : <span className="ml-2">{label}</span>}
    </NavLink>
  )
}
