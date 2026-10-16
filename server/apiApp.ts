import cors from 'cors'
import express from 'express'
import { CATALOG_IMDB_IDS } from './movieCatalog.ts'
import { fetchByImdbId, getBlockbusterShelfMovies } from './omdb.ts'
import { searchMovies } from './tmdb.ts'
import { issueLivekitToken, livekitStatus } from './livekit.ts'
import { createRateLimiter } from './rateLimit.ts'
import { trailerByImdbId, trailerReportEmbedFailure, trailerStatus } from './trailers.ts'
import { omdbRow, omdbSearch, omdbStatus, omdbTitle } from './watchMovies.ts'

/** HTTP API only (no Socket.IO). Used by local Express and Vercel serverless. */
export function createApiApp() {
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

  return app
}
