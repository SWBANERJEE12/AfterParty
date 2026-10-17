import { Navigate, Route, Routes } from 'react-router-dom'
import { useRoutingLocation } from './useRoutingLocation'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { MainLayout } from '../layouts/MainLayout'
import { DiscoverPage } from '../pages/DiscoverPage'
import { FriendsPage } from '../pages/FriendsPage'
import { HomePage } from '../pages/HomePage'
import { MyListPage, VotingPage, WatchHistoryPage } from '../pages/LibraryPages'
import { PrivacyPolicyPage, HelpPage, TermsPage } from '../pages/legal/LegalPages'
import { ProfilePage } from '../pages/ProfilePage'
import { SettingsPage } from '../pages/SettingsPage'
import { SignInPage } from '../pages/SignInPage'
import { SignUpPage } from '../pages/SignUpPage'
import { WatchRoomPage } from '../pages/WatchRoomPage'
import { WatchPartyCreatePage, WatchPartyJoinPage } from '../pages/WatchPartyHubPage'
import { WelcomePage } from '../pages/WelcomePage'
import { RoomRouteErrorBoundary } from './RoomRouteErrorBoundary'
import { useOptionalRoomSession } from './RoomSessionContext'
import { RoomSessionShell } from './RoomSessionShell'

export function AppRoutes() {
  // Re-match routes when room session changes (e.g. minimize while URL already moved).
  useOptionalRoomSession()
  const routeLocation = useRoutingLocation()
  return (
    <Routes location={routeLocation}>
      <Route element={<RoomSessionShell />}>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />

        <Route element={<MainLayout />}>
          <Route path="/party" element={<Navigate to="/party/create" replace />} />
          <Route path="/party/create" element={<WatchPartyCreatePage />} />
          <Route path="/party/join" element={<WatchPartyJoinPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route
            path="/room/:roomId"
            element={
              <RoomRouteErrorBoundary>
                <WatchRoomPage />
              </RoomRouteErrorBoundary>
            }
          />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/voting" element={<VotingPage />} />
          <Route path="/my-list" element={<MyListPage />} />
          <Route path="/history" element={<WatchHistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Route>
    </Routes>
  )
}
