# Afterparty setup

## Dev

```bash
npm install
npm run dev
```

Runs **Vite** (watch-party UI) and **Express** (OMDb) with API proxied at `/api`.

## Client env (`.env.local`)

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Optional WebRTC voice (ICE servers):

```env
# JSON array of RTCIceServer objects — include TURN for production (see Voice section below)
# VITE_WEBRTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]
```

Get Supabase values from **Project Settings** → **API** (Project URL + **publishable** key). Never put `service_role` in `VITE_*` vars.

## Server env (`.env` or `.env.local`)

Loaded when the Express server starts (`import './loadEnv.ts'` runs first in `server/index.ts`):

- **Location:** project root — same directory as `package.json` — files **`.env`** and/or **`.env.local`** (`.env.local` overrides `.env`).
- **Restart:** after changing server vars, stop and run **`npm run dev`** again (or restart the `api` process from `concurrently`).
- **Verify (no secrets printed):** `npm run check:server-env`

`npm run dev:server` no longer uses `--env-file=.env` only; both files above are merged by `loadEnv.ts`.

| Variable | Purpose |
|----------|---------|
| `OMDB_API_KEY` | Movie search/details on `/api/omdb/*` |
| `YOUTUBE_API_KEY` | Trailer lookup on `/api/trailers/*` (server-only; never use `VITE_`) |

**LiveKit is optional and unused by the watch-room voice UI.** Legacy routes `/api/livekit/*` remain if you set `LIVEKIT_*` and `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).

See `.env.example`.

## Vercel (production)

The Vite app is static; **movie metadata runs on serverless API** (`api/index.ts` → shared `server/apiApp.ts`). `vercel.json` rewrites `/api/*` to that function and serves the SPA from `dist/`.

1. Import the GitHub repo in [Vercel](https://vercel.com) (default build: `npm run build`, output: `dist`).
2. **Project → Settings → Environment Variables** — add for **Production** (and Preview if you want):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (client build-time)
   - `OMDB_API_KEY` (server-only; **no** `VITE_` prefix)
   - `YOUTUBE_API_KEY` (server-only; trailers)
3. **Redeploy** after changing env vars (Vercel does not inject new secrets into old deployments).
4. Smoke test: `GET https://<your-deployment>/api/omdb/status` → `{"configured":true}` when the key is set.

Socket.IO / legacy blockbuster rooms still require a long-running Node server (`npm run dev` or a separate host); they are not available on Vercel serverless.

## Supabase migrations (run in order)

Dashboard → **SQL** → run each file in `supabase/migrations/` (see `supabase/README.md`).

Verify:

```bash
npm run check:supabase
```

## Voice (WebRTC audio only)

Watch rooms use **native WebRTC** for microphone audio. **Supabase Realtime** (`watch:{roomId}`) carries **signaling only** (offers, answers, ICE) — not audio.

### Requirements

1. Join the watch room first (`membershipReady`), then **Join voice** in the sidebar.
2. Allow microphone access when prompted.
3. Realtime must be enabled in Supabase (same channel as presence/chat).

### STUN / TURN

- Default: public **STUN** (`stun.l.google.com`) — fine for some LANs; **not reliable on all networks**.
- **TURN** relays media when direct peer connections fail (common on mobile/corporate Wi‑Fi). Configure via `VITE_WEBRTC_ICE_SERVERS` with your TURN provider credentials.
- TURN is often **paid** or **quota-limited** (Twilio, Metered, Cloudflare, self-hosted `coturn`). Budget and test accordingly.
- Afterparty does **not** claim voice works everywhere without TURN — test on your target networks.

### Manual voice tests

1. Two browsers, same room, both **Join voice** — confirm you hear each other.
2. **Mute** / **Leave voice** — tracks and peer connections should clean up (check DevTools console in dev: `[afterparty:voice]`).
3. Per-participant **volume** and **mute locally** affect only your device.
4. Chat and movie player should still work alongside voice.

## OMDb

Get a key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx) → `OMDB_API_KEY` in server env.

## YouTube trailers

Trailers use **YouTube Data API v3** on the Express server only (`/api/trailers/:imdbId`). The client never sees your API key.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Enable **YouTube Data API v3**.
3. Create an API key (restrict by IP or HTTP referrer in production).
4. Add to server env (`.env` or `.env.local`):

```env
YOUTUBE_API_KEY=your_key_here
```

Restart `npm run dev` after changing server env. **Watch Trailer** on Home and Discover calls the backend, which matches OMDb title/year to an embeddable official-style trailer. Results are cached server-side to reduce quota use.

If the key is missing, **Watch Trailer** still opens the modal with **Trailer unavailable** (buttons stay usable on movie cards).

### Trailer errors and caching

| Case | Behavior |
|------|----------|
| No match | Modal: **Trailer unavailable** — no video id is guessed |
| Quota / invalid key / network | Clear message; if a **previous successful** lookup exists in server memory, that cached trailer may still be returned |
| Embed blocked / removed | Use **Video won't play?** in the modal to invalidate cache; close modal stops playback (iframe unmounted) |

Server cache: successful trailers ~24h, misses ~6h, in-process only (resets on server restart). Each lookup may use 1–4 YouTube search calls plus a `videos.list` status check per candidate.

### Local trailer tests

```bash
npm run test:trailer-matching   # offline scoring (no API key)
npm run dev                   # then open Discover → Watch Trailer
```

Manual checks: popular title (e.g. Shawshank), similar titles/years, title with no trailer, missing `YOUTUBE_API_KEY`, close modal (audio stops).

## Synchronized playback (watch room)

1. Apply migrations through **`016_repair_proposals_and_playback.sql`** if you see missing `room_movie_proposals` or `get_room_playback_state` errors (includes 005+015 objects). Minimum: **005**, **015**, or run **016** alone after **001–014**.
2. Host must be the room **host** (`rooms.host_member_key`) to control playback.
3. **Trailer mode:** host picks from room shortlist (propose titles in Discover first) or uses OMDb + existing YouTube trailer API.
4. **Host file mode:** host selects a local video; other participants receive a **WebRTC** stream (star topology from host). Configure `VITE_WEBRTC_ICE_SERVERS` with **TURN** for restrictive networks.
5. Optional: `VITE_PLAYBACK_SYNC_TARGET=10` (WebRTC viewer target; **does not** raise `rooms.max_members` from migration 014).

Tests (mock / unit — not proof of multi-browser sync):

```bash
npm run test:playback-sync
npm run test:playback-latency-sim
```

## Manual integration tests

- **Chat:** two browsers, same room; history after refresh; isolated rooms.
- **Voice:** WebRTC join from two clients; mute; leave cleans up peers.
- **Discover:** search, detail modal, propose from room-linked Discover.

## Deploy

`npm run build` → static `dist/` + run Express (or separate API host) with server env vars.
