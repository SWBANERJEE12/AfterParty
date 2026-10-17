import { BrowserRouter } from 'react-router-dom'
import { RoomSessionProvider } from './room/RoomSessionContext'
import { AppRoutes } from './room/AppRoutes'
import { RouterLocationSync } from './room/RouterLocationSync'

export default function App() {
  return (
    <BrowserRouter>
      <RouterLocationSync />
      <RoomSessionProvider>
        <AppRoutes />
      </RoomSessionProvider>
    </BrowserRouter>
  )
}
