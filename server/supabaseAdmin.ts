import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | null = null

export function supabaseAdminConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return Boolean(url && key)
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdminConfigured()) return null
  if (!admin) {
    const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return admin
}

export async function verifyRoomMember(roomId: string, memberKey: string): Promise<boolean> {
  const client = getSupabaseAdmin()
  if (!client) return false
  const { data } = await client
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('member_key', memberKey)
    .maybeSingle()
  return Boolean(data)
}
