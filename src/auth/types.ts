export type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
  preferences: Record<string, unknown>
}
