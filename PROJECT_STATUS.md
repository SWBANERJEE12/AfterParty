# Afterparty — Project Status

## Audit summary (pre-transform)

| Area | State before this work |
|------|-------------------------|
| Stack | Vite + React + Express; Supabase client; OMDb via `/api/omdb/*`; LiveKit token route |
| Rooms/chat | `001`–`007` migrations; guest `member_key` + RPC chat |
| Entry | Landing create/join only |
| Auth | None (`persistSession: false`) |

## Implemented in this pass (phased foundation)

### Phase 1 — Accounts & profiles ✅ (code)

- Supabase Auth with **username + password** (synthetic email `username@auth.afterparty.local`)
- `AuthProvider`, sign-up/in/out, profile edit, password update
- **Persistent sessions** (`persistSession: true`)
- Migration **`008_profiles_auth.sql`** — `profiles` + trigger on `auth.users`

### Phase 2 — Welcome, gradient, home, sidebar ✅ (code)

- Required gradient via `.afterparty-gradient` + CSS variables (`index.css`)
- `/welcome` cinematic intro (skips when session → `/home`)
- `/home` streaming-style hub (OMDb rows when API key set)
- `MainLayout` + collapsible sidebar navigation
- Routes: sign-in, sign-up, settings, legal, help

### Phase 3 — Friends 🟡 (partial)

- Migration **`009_friends.sql`** — requests + friendships + RLS
- `/friends` — username search + send request (accept/reject UI TODO)
- Online presence / room invites TODO

### Phase 4 — Library 🟡 (partial)

- Migration **`010_library.sql`** — `my_list_items`, `watch_history` + owner RLS
- List/history pages read DB; **writing** from Discover/playback TODO
- Room voting documented; proposals remain in watch room

### Phase 5 — Legal & theme ✅ (draft)

- Privacy / Terms / Help pages (transparent drafts)
- Light/dark/system theme in Settings (gradient dark per spec)

### Watch party — preserved ✅

- Guest: `/party/create`, `/party/join`, `/room/:id` (no account required)
- Chat RPCs **unchanged** — still require **`007_repair_chat_rpc_functions.sql`**
- Voice: **WebRTC audio** via `VoiceChannelPanel` + Supabase Realtime signaling (Jitsi removed)

### Phase 2 — Room core (host, cap, UX) ✅ (code)

- Migration **`014_room_core_host_cap.sql`** — max 4 members, host columns, join/leave/transfer RPCs
- Client joins via **`join_room_member`** / leaves via **`leave_room_member`** (`useWatchRoom`)
- **`useRoomParty`** — party state, host badge, transfer host, `party_state` realtime refresh
- **Floating chat** FAB with unread badge; **copy room code** + invite link in header

---

## Locked product decisions (2026-03-16)

| Topic | Decision |
|--------|-----------|
| **Host / upload** | **Signed-in only** — no anonymous guest host. Host = `rooms.created_by` (must be logged in to create room with host powers). Guests may still join/watch/chat/voice per existing guest flow. |
| **Movie storage** | **No paid cloud storage** (no Supabase Storage bucket / billing). Synced watch-party file delivery will use **host-mediated P2P** (or sample/demo URL) — host must stay online; document reliability limits. |
| **Host leave** | **Auto host promotion** when current host disconnects (`014` + `leave_room_member`). Manual transfer via Voice panel (signed-in target only). |
| **Proposals vs playlist** | Keep **`room_movie_proposals`** as-is for Discover “suggest”; add **room playlist queue** separately and allow promoting proposals into the queue (no forced merge of old data). |

---

## Supabase migrations to apply (in order)

1. `001` – `007` (rooms, chat RPCs — **007 required for chat**)
2. **`008_profiles_auth.sql`**
3. **`009_friends.sql`**
4. **`010_library.sql`**
5. **`011_rooms_authenticated_rls.sql`**
6. **`012_fix_room_members_rls_recursion.sql`**
7. **`013_ensure_chat_rpc_text_member_key.sql`** (if chat schema cache errors)
8. **`014_room_core_host_cap.sql`** (**required for room join after this client update**)

**Auth dashboard:** Consider disabling email confirmation for local dev, or confirm email after sign-up.

---

## Env (do not commit `.env.local`)

| Variable | Where |
|----------|--------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Client |
| `OMDB_API_KEY` | Express |
| `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_*` (legacy) | Express only |
| `VITE_WEBRTC_ICE_SERVERS` (optional TURN) | Client voice |

---

## Outstanding / not claimed as done

- Friend accept/reject/cancel UI + mutual friendship rows on accept
- Room invitations to friends + in-app notifications
- Persist My List / history from Discover and real video progress
- Synced video playback (not invented)
- Friend online status (Realtime — no fake offline/online)
- Full mobile polish; sidebar icons (text labels only)
- Automated E2E tests across two accounts

---

## Commands

```bash
npm run dev      # Vite + Express
npm run build
npm run check:supabase
```

---

## Verification checklist (manual)

- [ ] Apply SQL migrations including 008–010
- [ ] Register → sign in → session survives refresh
- [ ] `/home` loads; guest `/party/join` works without login
- [ ] Chat still works after 007
- [ ] Friends search after 009 (two accounts)
- [ ] Theme persists across pages
