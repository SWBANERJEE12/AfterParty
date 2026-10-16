# Supabase migrations

Apply **in numeric order** via Supabase Dashboard → SQL (or Supabase CLI `db push` if you link the project).

| Migration | Tables / behavior |
|-----------|-------------------|
| `001_watch_party.sql` | `rooms`, `room_members`, RLS for anon guests |
| `002_room_chat_realtime.sql` | `room_messages`, RLS, `supabase_realtime` publication |
| `003_chat_membership_rls.sql` | Membership-gated chat writes; history RPC |
| `004_post_room_message_rpc.sql` | `post_room_message` RPC |
| `005_room_movie_proposals.sql` | Room movie shortlist + RPC |
| **`008_profiles_auth.sql`** | **`profiles` table, RLS, `handle_new_user` trigger (signed-in Profile page)** |
| `006_fix_chat_rpc_schema_reload.sql` | Superseded — use **007** instead |
| **`007_repair_chat_rpc_functions.sql`** | Chat RPC repair + `room_messages` insert RLS (full repair) |
| **`013_ensure_chat_rpc_text_member_key.sql`** | **Apply if chat error: `fetch_room_messages` not in schema cache** |
| **`011_rooms_authenticated_rls.sql`** | **Signed-in room create/join (RLS for `authenticated`)** |
| **`012_fix_room_members_rls_recursion.sql`** | **Fix `room_members` RLS infinite recursion (apply after 011)** |
| **`014_room_core_host_cap.sql`** | **4-member cap, host columns, `join_room_member` / `leave_room_member` / `transfer_room_host` / `get_room_party_state`** |
| **`015_room_playback_sync.sql`** | **Synced playback state + `get_room_playback_state` / `apply_playback_action` (host-only writes)** |
| **`016_repair_proposals_and_playback.sql`** | **Idempotent repair if 005/015 were never applied** (proposals table + playback RPCs + `propose_room_movie`) |

Room IDs are unguessable shared secrets; RLS is intentionally broad for anonymous Phase 1 guests. Tighten policies when you add authenticated hosts.

**Phase 2 client:** watch rooms join via `join_room_member` (not direct `room_members` insert). If join fails with “schema cache” / missing RPC, apply **014**.
