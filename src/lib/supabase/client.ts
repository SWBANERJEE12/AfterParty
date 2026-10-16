import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser-only Supabase client. Uses the publishable (anon) key — never the service role.
 * @see SETUP.md for where to obtain these values.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim()

const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseEnv = {
  url: url ?? '',
  hasUrl: Boolean(url),
  hasPublishableKey: Boolean(publishableKey),
}

/** True when both URL and publishable key are present in the environment. Not a live connection test. */
export const isSupabaseConfigured = supabaseEnv.hasUrl && supabaseEnv.hasPublishableKey

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !publishableKey) return null
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    })
  }
  return client
}
