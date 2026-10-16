import { NavLink } from 'react-router-dom'
import { useOptionalRoomSession } from '../../room/RoomSessionContext'

type Props = {
  className: (args: { isActive: boolean }) => string
  onNavigate?: () => void
}

export function DiscoverNavLink({ className, onNavigate }: Props) {
  const roomSession = useOptionalRoomSession()

  return (
    <NavLink
      to="/discover"
      className={className}
      onClick={() => {
        if (roomSession?.activeRoomId && roomSession.viewMode === 'full') {
          roomSession.minimizeRoom()
        }
        onNavigate?.()
      }}
    >
      Discover
    </NavLink>
  )
}
