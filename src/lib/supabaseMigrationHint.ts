/** Map PostgREST / schema-cache errors to migration file hints for the Supabase SQL editor. */
export function migrationHintForSupabaseError(message: string): string | null {
  const m = message.toLowerCase()
  if (m.includes('my_list_items') || m.includes('watch_history')) {
    return 'Apply supabase/migrations/010_library.sql in the Supabase SQL Editor (requires 008_profiles_auth.sql first).'
  }
  if (m.includes('friend_requests') || m.includes('friendships')) {
    return 'Apply supabase/migrations/009_friends.sql in the Supabase SQL Editor (requires 008_profiles_auth.sql first).'
  }
  if (m.includes('profiles') && (m.includes('schema cache') || m.includes('does not exist'))) {
    return 'Apply supabase/migrations/008_profiles_auth.sql in the Supabase SQL Editor.'
  }
  return null
}
