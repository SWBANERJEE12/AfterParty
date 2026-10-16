import { getSupabase, isSupabaseConfigured } from './client'

export type SupabaseConnectionStatus =
  | { state: 'misconfigured' }
  | { state: 'connected' }
  | { state: 'error'; message: string }

/**
 * Lightweight API check — confirms credentials reach your Supabase project and `rooms` is readable.
 * Does not imply Realtime or chat are enabled; run migrations first.
 */
export async function verifySupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!isSupabaseConfigured) {
    return { state: 'misconfigured' }
  }

  const supabase = getSupabase()
  if (!supabase) {
    return { state: 'misconfigured' }
  }

  const { error } = await supabase.from('rooms').select('id').limit(1)

  if (error) {
    return { state: 'error', message: error.message }
  }

  return { state: 'connected' }
}
