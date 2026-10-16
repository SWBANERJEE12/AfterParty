import './loadEnv.ts'
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { AVATAR_COLORS } from '../src/shared/avatarColors.ts'
import { EMPTY_VOTE_STATE, type MovieMeta, type VoteState } from '../src/shared/movies.ts'
import type {
  ClientToServerEvents,
  JoinedRoomPayload,
  PlayerSnapshot,
  RoomErrorCode,
  ServerToClientEvents,
  WorldLocation,
} from '../src/shared/protocol.ts'
import { MAX_ROOM_PLAYERS } from '../src/shared/protocol.ts'
import { LAYOUTS, resolveSpawn } from '../src/game/world/layouts.ts'
import { CATALOG_IMDB_IDS } from './movieCatalog.ts'
import { fetchByImdbId } from './omdb.ts'
import { getBlockbusterShelfMovies } from './omdb.ts'
import { searchMovies } from './tmdb.ts'
import { issueLivekitToken, livekitStatus } from './livekit.ts'
import { createRateLimiter } from './rateLimit.ts'
import { logServerConfigOnStartup } from './serverConfig.ts'
import { trailerByImdbId, trailerReportEmbedFailure, trailerStatus } from './trailers.ts'
import { omdbRow, omdbSearch, omdbStatus, omdbTitle } from './watchMovies.ts'

const PORT = Number(process.env.PORT) || 3001
const SHORTLIST_MAX = 5

type RoomPlayer = PlayerSnapshot & { slot: number }

type Room = {
  code: string
  players: Map<string, RoomPlayer>
  vote: VoteState
}

const rooms = new Map<string, Room>()

function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 4) return null
  return code
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  if (rooms.has(out)) return randomCode()
  return out
}

function snapshotList(room: Room): PlayerSnapshot[] {
  return [...room.players.values()].map(({ slot: _slot, ...player }) => player)
}

function nextSlot(room: Room): number | null {
  const used = new Set(room.players.values().map((p) => p.slot))
  for (let i = 0; i < MAX_ROOM_PLAYERS; i++) {
    if (!used.has(i)) return i
  }
  return null
}

function joinPayload(room: Room, selfId: string): JoinedRoomPayload {
  return {
    roomCode: room.code,
    selfId,
    players: snapshotList(room),
    vote: room.vote,
  }
}

function fail(error: RoomErrorCode) {
  return { error }
}

function recomputeWinner(vote: VoteState) {
  let bestId: number | null = null
  let bestCount = 0
  for (const movie of vote.shortlist) {
    const count = vote.votes[String(movie.id)]?.length ?? 0
    if (count > bestCount) {
      bestCount = count
      bestId = movie.id
    }
  }
  vote.winnerId = bestCount > 0 ? bestId : null
}

function spawnFor(location: WorldLocation, from?: WorldLocation) {
  const layout = LAYOUTS[location]
  const s = resolveSpawn(layout, from)
  return { x: s.x, z: s.z, yaw: s.yaw }
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '32kb' }))
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/time', (_req, res) => {
  res.json({ serverMs: Date.now() })
})

app.get('/api/omdb/status', omdbStatus)
app.get('/api/omdb/search', omdbSearch)
app.get('/api/omdb/title/:imdbId', omdbTitle)
app.get('/api/omdb/row/:rowId', omdbRow)

const trailerLimiter = createRateLimiter({ windowMs: 60_000, max: 45 })
app.get('/api/trailers/status', trailerStatus)
app.get('/api/trailers/:imdbId', trailerLimiter, trailerByImdbId)
app.post('/api/trailers/report-embed-failure', trailerLimiter, trailerReportEmbedFailure)

app.get('/api/livekit/status', livekitStatus)
app.post('/api/livekit/token', issueLivekitToken)

app.get('/api/movies/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  try {
    const results = await searchMovies(q)
    res.json({ results })
  } catch {
    res.status(500).json({ results: [] })
  }
})

app.get('/api/movies/shelf', async (_req, res) => {
  try {
    const movies = await getBlockbusterShelfMovies()
    res.json({ movies })
  } catch {
    res.status(500).json({ movies: [] })
  }
})

app.get('/api/movies/catalog', async (req, res) => {
  const page = Math.max(0, Number(req.query.page) || 0)
  const pageSize = 20
  const slice = CATALOG_IMDB_IDS.slice(page * pageSize, (page + 1) * pageSize)
  try {
    const movies = []
    for (const id of slice) {
      const m = await fetchByImdbId(id)
      if (m) movies.push(m)
    }
    res.json({
      movies,
      page,
      pageSize,
      total: CATALOG_IMDB_IDS.length,
      hasMore: (page + 1) * pageSize < CATALOG_IMDB_IDS.length,
    })
  } catch {
    res.status(500).json({ movies: [], page, pageSize, total: 0, hasMore: false })
  }
})

const httpServer = createServer(app)
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true },
})

io.on('connection', (socket) => {
  let roomCode: string | null = null

  const leaveCurrentRoom = () => {
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) {
      roomCode = null
      return
    }
    room.players.delete(socket.id)
    socket.leave(roomCode)
    io.to(roomCode).emit('playerLeft', socket.id)
    if (room.players.size === 0) {
      rooms.delete(roomCode)
    }
    roomCode = null
  }

  const broadcastVote = (room: Room) => {
    io.to(room.code).emit('voteState', room.vote)
  }

  socket.on('createRoom', (name, ack) => {
    const trimmed = name.trim().slice(0, 16)
    if (!trimmed) {
      ack(fail('NAME_REQUIRED'))
      return
    }
    leaveCurrentRoom()

    const code = randomCode()
    const slot = 0
    const spawn = spawnFor('home')
    const room: Room = {
      code,
      players: new Map(),
      vote: { ...EMPTY_VOTE_STATE, shortlist: [], votes: {} },
    }
    const player: RoomPlayer = {
      id: socket.id,
      name: trimmed,
      color: AVATAR_COLORS[slot],
      x: spawn.x,
      z: spawn.z,
      yaw: spawn.yaw,
      moving: false,
      location: 'home',
      slot,
    }
    room.players.set(socket.id, player)
    rooms.set(code, room)
    roomCode = code
    socket.join(code)
    ack(joinPayload(room, socket.id))
  })

  socket.on('joinRoom', ({ code: raw, name }, ack) => {
    const trimmed = name.trim().slice(0, 16)
    if (!trimmed) {
      ack(fail('NAME_REQUIRED'))
      return
    }
    const code = normalizeCode(raw)
    if (!code) {
      ack(fail('INVALID_CODE'))
      return
    }
    const room = rooms.get(code)
    if (!room) {
      ack(fail('ROOM_NOT_FOUND'))
      return
    }
    if (room.players.size >= MAX_ROOM_PLAYERS) {
      ack(fail('ROOM_FULL'))
      return
    }

    leaveCurrentRoom()

    const slot = nextSlot(room)
    if (slot === null) {
      ack(fail('ROOM_FULL'))
      return
    }

    const spawn = spawnFor('home')
    const player: RoomPlayer = {
      id: socket.id,
      name: trimmed,
      color: AVATAR_COLORS[slot],
      x: spawn.x,
      z: spawn.z,
      yaw: spawn.yaw,
      moving: false,
      location: 'home',
      slot,
    }
    room.players.set(socket.id, player)
    roomCode = code
    socket.join(code)
    ack(joinPayload(room, socket.id))
    const { slot: _s, ...joined } = player
    socket.to(code).emit('playerJoined', joined)
    io.to(code).emit('roomPlayers', snapshotList(room))
  })

  socket.on('playerState', (state) => {
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player) return
    player.x = state.x
    player.z = state.z
    player.yaw = state.yaw
    player.moving = state.moving
    player.location = state.location
    socket.to(roomCode).emit('playerMotion', {
      id: socket.id,
      ...state,
    })
  })

  socket.on('travel', ({ to, from }) => {
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player) return
    if (!LAYOUTS[to]) return
    const spawn = spawnFor(to, from)
    player.location = to
    player.x = spawn.x
    player.z = spawn.z
    player.yaw = spawn.yaw
    player.moving = false
    socket.to(roomCode).emit('playerMotion', {
      id: socket.id,
      x: player.x,
      z: player.z,
      yaw: player.yaw,
      moving: false,
      location: to,
    })
  })

  socket.on('shortlistAdd', (movie, ack) => {
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    if (room.vote.shortlist.length >= SHORTLIST_MAX) {
      ack(fail('SHORTLIST_FULL'))
      return
    }
    if (room.vote.shortlist.some((m) => m.id === movie.id)) {
      ack({ ok: true })
      return
    }
    room.vote.shortlist.push(movie)
    room.vote.votes[String(movie.id)] = []
    recomputeWinner(room.vote)
    broadcastVote(room)
    ack({ ok: true })
  })

  socket.on('shortlistRemove', (movieId) => {
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    room.vote.shortlist = room.vote.shortlist.filter((m) => m.id !== movieId)
    delete room.vote.votes[String(movieId)]
    recomputeWinner(room.vote)
    broadcastVote(room)
  })

  socket.on('castVote', (movieId) => {
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    if (!room.vote.shortlist.some((m) => m.id === movieId)) return
    const key = String(movieId)
    for (const ids of Object.values(room.vote.votes)) {
      const idx = ids.indexOf(socket.id)
      if (idx >= 0) ids.splice(idx, 1)
    }
    const bucket = room.vote.votes[key] ?? []
    if (!bucket.includes(socket.id)) bucket.push(socket.id)
    room.vote.votes[key] = bucket
    recomputeWinner(room.vote)
    broadcastVote(room)
  })

  socket.on('disconnect', () => {
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    room.players.delete(socket.id)
    for (const ids of Object.values(room.vote.votes)) {
      const idx = ids.indexOf(socket.id)
      if (idx >= 0) ids.splice(idx, 1)
    }
    recomputeWinner(room.vote)
    io.to(roomCode).emit('playerLeft', socket.id)
    broadcastVote(room)
    if (room.players.size === 0) {
      rooms.delete(roomCode)
    }
  })
})

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[afterparty] Port ${PORT} is already in use. Stop the other process (e.g. an old dev:server) or set PORT to a free port.`,
    )
  } else {
    console.error('[afterparty] HTTP server error:', err)
  }
  process.exit(1)
})

httpServer.listen(PORT, () => {
  console.log(`Afterparty server listening on http://localhost:${PORT}`)
  logServerConfigOnStartup()
})
