import { BrowserRouter } from 'react-router-dom'
import { RoomSessionProvider } from './room/RoomSessionContext'
import { HistoryLocationSync } from './room/HistoryLocationSync'
import { AppRoutes } from './room/AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <HistoryLocationSync />
      <RoomSessionProvider>
        <AppRoutes />
      </RoomSessionProvider>
    </BrowserRouter>
  )
}
