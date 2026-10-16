import { Navigate } from 'react-router-dom'
import { LandingPage } from './LandingPage'

/** Watch party create/join — preserves existing Supabase room flow. */
export function WatchPartyCreatePage() {
  return <LandingPage mode="create" />
}

export function WatchPartyJoinPage() {
  return <LandingPage mode="join" />
}

export function WatchPartyHubPage() {
  return <Navigate to="/party/create" replace />
}
