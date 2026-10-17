/**
 * Verifies Supabase env + API reachability (reads .env.local, then .env).
 * Never prints secret values. Safe for local CI-style checks.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(filename: string): Record<string, string> {
  const path = resolve(process.cwd(), filename)
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local') }

const url = env.VITE_SUPABASE_URL?.trim()
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? env.VITE_SUPABASE_ANON_KEY?.trim()

if (!url || !key) {
  console.error(
    'Supabase check: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
  )
  process.exit(1)
}

if (env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'Warning: service role key found in env file — remove it from frontend env files; use server-only secrets.',
  )
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { error } = await supabase.from('rooms').select('id').limit(1)

if (error) {
  console.error('Supabase check failed:', error.message)
  console.error('Ensure migrations in supabase/migrations/ are applied in the SQL editor.')
  process.exit(1)
}

// RPC must exist as (text, text, integer) — see 013 / 007. Membership error means the function is present.
const { error: rpcError } = await supabase.rpc('fetch_room_messages', {
  p_room_id: '__afterparty_rpc_probe__',
  p_member_key: '00000000-0000-0000-0000-000000000000',
  p_limit: 1,
})

if (rpcError) {
  const msg = rpcError.message ?? ''
  if (msg.includes('Could not find the function') || msg.includes('schema cache')) {
    console.error('Supabase check failed: fetch_room_messages RPC missing or wrong signature.')
    console.error('Apply supabase/migrations/013_ensure_chat_rpc_text_member_key.sql in the SQL Editor.')
    process.exit(1)
  }
  if (
    !msg.includes('not a room member') &&
    !msg.includes('invalid room id') &&
    !msg.includes('invalid member_key')
  ) {
    console.warn('Supabase RPC probe unexpected message (function may still exist):', msg)
  }
}

const probes: { name: string; ok: boolean; hint?: string }[] = []

{
  const { error: propErr } = await supabase.rpc('fetch_room_proposals', {
    p_room_id: '__afterparty_rpc_probe__',
    p_member_key: '00000000-0000-0000-0000-000000000000',
  })
  const msg = propErr?.message ?? ''
  const missing =
    msg.includes('Could not find the function') ||
    msg.includes('schema cache') ||
    msg.includes('room_movie_proposals')
  probes.push({
    name: 'fetch_room_proposals',
    ok: !missing,
    hint: missing ? 'Apply 005 or 016_repair_proposals_and_playback.sql' : undefined,
  })
}

{
  const { error: pbErr } = await supabase.rpc('get_room_playback_state', {
    p_room_id: '__afterparty_rpc_probe__',
    p_member_key: '00000000-0000-0000-0000-000000000000',
  })
  const msg = pbErr?.message ?? ''
  const missing =
    msg.includes('Could not find the function') || msg.includes('schema cache')
  probes.push({
    name: 'get_room_playback_state(p_room_id, p_member_key)',
    ok: !missing,
    hint: missing ? 'Apply 015 or 016_repair_proposals_and_playback.sql' : undefined,
  })
}

{
  const { error: profErr } = await supabase.from('profiles').select('id').limit(0)
  const msg = profErr?.message ?? ''
  probes.push({
    name: 'profiles',
    ok: !msg.includes('schema cache') && !msg.includes('does not exist'),
    hint: msg ? 'Apply 008_profiles_auth.sql' : undefined,
  })
}

{
  const { error: listErr } = await supabase.from('my_list_items').select('id').limit(0)
  const msg = listErr?.message ?? ''
  probes.push({
    name: 'my_list_items',
    ok: !msg.includes('schema cache') && !msg.includes('does not exist'),
    hint: msg ? 'Apply 010_library.sql (after 008)' : undefined,
  })
}

{
  const { error: frErr } = await supabase.from('friend_requests').select('id').limit(0)
  const msg = frErr?.message ?? ''
  probes.push({
    name: 'friend_requests',
    ok: !msg.includes('schema cache') && !msg.includes('does not exist'),
    hint: msg ? 'Apply 009_friends.sql (after 008)' : undefined,
  })
}

const failed = probes.filter((p) => !p.ok)
if (failed.length > 0) {
  console.error('Supabase check failed — missing database objects:')
  for (const f of failed) {
    console.error(`  - ${f.name}: ${f.hint ?? 'not found'}`)
  }
  console.error('Run the migration SQL in Supabase Dashboard → SQL Editor, then re-run npm run check:supabase')
  process.exit(1)
}

console.log(
  'Supabase check OK: rooms, fetch_room_messages, fetch_room_proposals, get_room_playback_state present.',
)
