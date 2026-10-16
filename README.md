# Afterparty

Afterparty is a synchronized movie watch-party web app. Create or join a private room, browse an OMDb-powered catalogue, preview YouTube trailers, propose titles to the room, and keep the session alive in a floating mini-player while you explore Discover.

## Features

- **Watch rooms** — Create/join rooms (guest nickname or signed-in user), up to **10** participants, invite links and room codes.
- **Persistent session** — Leave the room page for Discover; the room stays connected with a bottom-right **mini-player** (expand / leave).
- **Synchronized playback** — Host-authoritative playback state (trailers, YouTube, local file via WebRTC file transfer).
- **Discover** — OMDb catalogue rows, search, **Recommended for You** WebGL carousel, trailer modal (YouTube IFrame API), propose-to-room voting.
- **Chat & voice** — Room chat over Supabase Realtime; peer voice (WebRTC) with optional TURN configuration.
- **Accounts (optional)** — Username/password auth, profile, friends, lists, and history when Supabase auth migrations are applied.

## Screenshots

<!-- Add repository-relative paths when available, e.g. -->
<!-- ![Discover](docs/screenshots/discover.png) -->

_Screenshots not included in this repository yet._

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7 |
| Backend | Express 5 (OMDb, YouTube trailers, legacy Socket.IO game routes) |
| Data / realtime | Supabase (Postgres, Auth, Realtime, RLS) |
| Media | YouTube IFrame API, WebRTC (voice + host file transfer), `ogl` (Discover carousel) |

## Prerequisites

- **Node.js** 20+ (LTS recommended) and **npm** 10+
- A **Supabase** project (URL + anon/publishable key)
- **OMDB_API_KEY** and **YOUTUBE_API_KEY** on the Express server for catalogue and trailers

## Installation

```bash
git clone <your-repo-url>
cd AfterParty
npm install
```

## Environment variables

Copy `.env.example` to `.env.local` (client) and set server keys in `.env` or `.env.local` at the project root. **Never commit real secrets.**

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | Anon/publishable key (not service role) |
| `VITE_WEBRTC_ICE_SERVERS` | Client | Optional JSON ICE servers (add TURN for production voice) |
| `PORT` | Server | Express port (default `3001`) |
| `OMDB_API_KEY` | Server | Movie search and catalogue |
| `YOUTUBE_API_KEY` | Server | Trailer lookup (server-only; no `VITE_` prefix) |

See [SETUP.md](./SETUP.md) and `npm run check:server-env`.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run migrations from `supabase/migrations/` **in numeric order** (see [supabase/README.md](./supabase/README.md)).
3. Minimum for guest watch parties: `001`–`007`, **`014`** (join RPC + cap), **`015`**/`016` (playback), **`017`** (10-person cap), **`018`** (vote polls) as needed.
4. For **signed-in users / profile**: apply **`008_profiles_auth.sql`** (`profiles` table + `handle_new_user` trigger). Without it, Profile shows a migration notice; **Discover and rooms still work for guests**.
5. Enable **Realtime** for tables used by chat and room features (migrations document publication steps).

Verify client connectivity:

```bash
npm run check:supabase
```

## Development

```bash
npm run dev
```

Runs Vite (`http://localhost:5173`) and Express (`http://localhost:3001`) with `/api` proxied to the server.

## Build & tests

```bash
npm run build
npm run test:playback-sync
npm run test:room-navigation
npm run test:discover-recommendations
npm run test:vote-rules
npm run test:room-capacity
```

Other scripts are listed in `package.json` (`test:host-local-video`, `test:file-transfer`, etc.).

## Using a watch room

1. **Create or join** — `/party/create` or `/party/join` (sidebar). Enter a nickname (required).
2. **Room page** — Synced player, chat, voice, invite actions. Use **Discover** in the sidebar or header to browse while the room stays active.
3. **Mini-player** — On Discover, use **Expand** to return to the same room URL and session; **Leave** ends membership and cleans up.
4. **Proposals** — From Discover details or trailer modal, **Propose to room** starts the room vote flow (requires migration `018`).

## Known limitations

- Voice reliability depends on network/NAT; configure TURN for production.
- Host local file sync uses P2P transfer; very large files and some browsers may be slow.
- Signed-in features (friends, profile) require auth migrations (`008+`) and RLS.
- Legacy 3D Socket.IO game: `npm run dev:legacy` (separate from the watch-party UI).

## Security

- Keep **service role** and API keys out of the client and git.
- Room access uses unguessable room IDs and RLS/RPC membership checks — nicknames are not authorization.
- Local media stays on the host until transferred to viewers over WebRTC; do not expose copyrighted files publicly.
- User-generated chat and nicknames are stored in Supabase while rooms exist.

## Contributing

Issues and pull requests are welcome. Run `npm run build` and relevant tests before submitting.

## License

No license file is included in this repository yet. All rights reserved by the project owner until a license is added.
