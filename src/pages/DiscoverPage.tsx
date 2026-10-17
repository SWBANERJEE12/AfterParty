import Fuse from 'fuse.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { WatchTrailerButton } from '../components/movie/WatchTrailerButton'
import { TrailerModal } from '../components/movie/TrailerModal'
import { useTrailerModal } from '../hooks/useTrailerModal'
import { fetchOmdbRow, fetchOmdbStatus, fetchOmdbTitle, fetchTrailerStatus, searchOmdb } from '../lib/api'
import { proposeMovieToRoom } from '../lib/roomProposal'
import { getOrCreateMemberKey } from '../lib/session'
import { useStoredNickname } from '../hooks/useStoredNickname'
import { useOptionalRoomSession } from '../room/RoomSessionContext'
import { RecommendedForYouSection } from '../components/discover/RecommendedForYouSection'
import { pickRecommendedMovies } from '../lib/discoverRecommendations'
import type { MovieMeta } from '../shared/movies'

const ROWS = [
  { id: 'popular', label: 'Popular searches' },
  { id: 'action', label: 'Action' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'thriller', label: 'Thriller' },
  { id: 'scifi', label: 'Sci-Fi' },
  { id: 'recent', label: 'Recently discovered' },
] as const

function posterSrc(movie: MovieMeta) {
  return movie.posterUrl ?? 'https://via.placeholder.com/342x513/1a1a1a/fe4401?text=No+Poster'
}

function MovieCard({
  movie,
  onSelect,
  onWatchTrailer,
  trailerLoading,
  trailersConfigured,
}: {
  movie: MovieMeta
  onSelect: (m: MovieMeta) => void
  onWatchTrailer: (m: MovieMeta) => void
  trailerLoading: boolean
  trailersConfigured: boolean | null
}) {
  return (
    <div className="group w-36 shrink-0 snap-start text-left">
      <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] transition group-hover:-translate-y-1 group-hover:border-[var(--color-accent)]/50">
        <button
          type="button"
          onClick={() => onSelect(movie)}
          className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <img
            src={posterSrc(movie)}
            alt=""
            className="aspect-[2/3] w-full object-cover"
            loading="lazy"
          />
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-8 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="pointer-events-auto flex justify-center">
            <WatchTrailerButton
              movie={movie}
              size="sm"
              loading={trailerLoading}
              trailersConfigured={trailersConfigured}
              onWatch={onWatchTrailer}
              className="w-full max-w-[9.5rem]"
            />
          </div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-medium text-[var(--color-fg)]">{movie.title}</p>
      <p className="text-[10px] text-[var(--color-muted)]">
        {movie.releaseYear} · {movie.mediaType ?? 'movie'}
      </p>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-52 w-36 shrink-0 animate-pulse rounded-lg bg-[var(--color-surface-elevated)]" />
      ))}
    </div>
  )
}

export function DiscoverPage() {
  const navigate = useNavigate()
  const roomSession = useOptionalRoomSession()
  const { stored: nicknameStored } = useStoredNickname()
  const roomContext = roomSession?.activeRoomId ?? null

  const [omdbOk, setOmdbOk] = useState<boolean | null>(null)
  const [omdbIssue, setOmdbIssue] = useState<'not_configured' | 'api_unreachable' | null>(null)
  const [omdbHttpStatus, setOmdbHttpStatus] = useState<number | null>(null)
  const [rows, setRows] = useState<Record<string, MovieMeta[]>>({})
  const [rowLoading, setRowLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MovieMeta[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [detail, setDetail] = useState<MovieMeta | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [proposeMsg, setProposeMsg] = useState<string | null>(null)
  const [trailersConfigured, setTrailersConfigured] = useState<boolean | null>(null)
  const [recommendedFocus, setRecommendedFocus] = useState<MovieMeta | null>(null)
  const trailer = useTrailerModal()

  const recommendedMovies = useMemo(
    () => pickRecommendedMovies(rows, ROWS.map((r) => r.id)),
    [rows],
  )

  useEffect(() => {
    if (!recommendedFocus && recommendedMovies[0]) setRecommendedFocus(recommendedMovies[0])
  }, [recommendedMovies, recommendedFocus])

  useEffect(() => {
    fetchOmdbStatus().then((s) => {
      if (s.configured) {
        setOmdbOk(true)
        setOmdbIssue(null)
        setOmdbHttpStatus(null)
      } else {
        setOmdbOk(false)
        setOmdbIssue(s.reason)
        setOmdbHttpStatus(s.httpStatus ?? null)
      }
    })
    fetchTrailerStatus().then((s) => setTrailersConfigured(s.configured))
  }, [])

  useEffect(() => {
    if (!omdbOk) return
    setRowLoading(true)
    Promise.all(ROWS.map((r) => fetchOmdbRow(r.id).then((res) => ({ id: r.id, movies: res.movies }))))
      .then((loaded) => {
        const map: Record<string, MovieMeta[]> = {}
        for (const row of loaded) map[row.id] = row.movies
        setRows(map)
      })
      .finally(() => setRowLoading(false))
  }, [omdbOk])

  const searchTimer = useRef<number | undefined>(undefined)
  const debouncedSearch = useCallback((q: string) => {
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(async () => {
      if (!q.trim()) {
        setSearchResults([])
        setSearchError(null)
        return
      }
      setSearchLoading(true)
      setSearchError(null)
      const res = await searchOmdb(q)
      setSearchLoading(false)
      if (res.error) setSearchError(res.error)
      setSearchResults(res.results)
    }, 350)
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    debouncedSearch(query)
  }, [query, searchOpen, debouncedSearch])

  const fuse = useMemo(
    () =>
      new Fuse(searchResults, {
        keys: ['title', 'overview', 'genre', 'director'],
        threshold: 0.4,
      }),
    [searchResults],
  )

  const filteredResults = useMemo(() => {
    if (!query.trim()) return searchResults
    return fuse.search(query).map((r) => r.item)
  }, [fuse, query, searchResults])

  const openDetail = useCallback(async (movie: MovieMeta) => {
    if (!movie.imdbId) {
      setDetail(movie)
      return
    }
    setDetailLoading(true)
    const res = await fetchOmdbTitle(movie.imdbId)
    setDetailLoading(false)
    setDetail(res.movie ?? movie)
  }, [])

  const proposeMovie = async (movie: MovieMeta, youtubeVideoId?: string | null) => {
    if (!roomContext) {
      setProposeMsg('Join or create a watch room first to propose a movie.')
      return
    }
    if (!nicknameStored) {
      setProposeMsg('Set your nickname on the watch party screen before proposing.')
      return
    }
    const res = await proposeMovieToRoom(
      roomContext,
      getOrCreateMemberKey(),
      nicknameStored,
      movie,
      youtubeVideoId,
    )
    setProposeMsg(res.ok ? res.message : res.error)
  }

  const proposeToRoom = async () => {
    if (!detail) return
    await proposeMovie(detail, trailer.videoId)
  }

  const proposeFromTrailer = async () => {
    const movie = trailer.activeMovie
    if (!movie) return
    await proposeMovie(movie, trailer.videoId)
  }

  return (
    <div className="min-h-full pb-16">
      <header className="border-b border-[var(--color-border)] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-lg font-semibold text-[var(--color-fg)]">Afterparty</Link>
            <p className="text-xs text-[var(--color-muted)]">Discover — browse titles to watch together</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)]"
          >
            Search
          </button>
        </div>
      </header>

      {omdbOk === false && (
        <div className="mx-auto mt-4 max-w-6xl rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {omdbIssue === 'api_unreachable' ? (
            <>
              Movie API is not reachable
              {omdbHttpStatus != null ? ` (HTTP ${omdbHttpStatus})` : ''}. The browser should call same-origin{' '}
              <code>/api/omdb/status</code> and receive JSON — if you see HTML, the Vercel function is not handling{' '}
              <code>/api/*</code>. Ensure <code>vercel.json</code> rewrites <code>/api/(.*)</code> to{' '}
              <code>api/index.ts</code> and redeploy <code>master</code>.
            </>
          ) : (
            <>
              <code>OMDB_API_KEY</code> is missing on the server. Locally, add it to <code>.env</code> and run{' '}
              <code>npm run dev</code>. On Vercel, set <code>OMDB_API_KEY</code> under Project → Settings → Environment
              Variables (Production), then redeploy. Never use a <code>VITE_</code> prefix for this key.
            </>
          )}
        </div>
      )}

      <RecommendedForYouSection
        movies={recommendedMovies}
        loading={rowLoading && omdbOk !== false}
        omdbOk={omdbOk}
        selected={recommendedFocus}
        onSelectedChange={setRecommendedFocus}
        onOpenDetails={(m) => void openDetail(m)}
        onWatchTrailer={(m) => void trailer.playTrailer(m)}
        onPropose={(m) => {
          setProposeMsg(null)
          void proposeMovie(m, null)
        }}
        roomActive={Boolean(roomContext)}
        trailersConfigured={trailersConfigured}
        trailerLoading={recommendedFocus ? trailer.isLoadingMovie(recommendedFocus) : false}
        onRetryLoad={() => {
          if (omdbOk) {
            setRowLoading(true)
            Promise.all(ROWS.map((r) => fetchOmdbRow(r.id).then((res) => ({ id: r.id, movies: res.movies }))))
              .then((loaded) => {
                const map: Record<string, MovieMeta[]> = {}
                for (const row of loaded) map[row.id] = row.movies
                setRows(map)
              })
              .finally(() => setRowLoading(false))
          }
        }}
      />

      <div className="mx-auto mt-10 max-w-6xl space-y-10 px-4 md:px-0">
        {ROWS.map((row) => (
          <section key={row.id}>
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">{row.label}</h2>
            {rowLoading ? (
              <RowSkeleton />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                {(rows[row.id] ?? []).map((m) => (
                  <MovieCard
                    key={`${row.id}-${m.imdbId ?? m.id}`}
                    movie={m}
                    onSelect={(x) => void openDetail(x)}
                    onWatchTrailer={(x) => void trailer.playTrailer(x)}
                    trailerLoading={trailer.isLoadingMovie(m)}
                    trailersConfigured={trailersConfigured}
                  />
                ))}
                {(rows[row.id] ?? []).length === 0 && (
                  <p className="text-xs text-[var(--color-muted)]">No titles loaded for this row.</p>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#0f172a]/95">
          <div className="border-b border-[var(--color-border)] p-4">
            <div className="mx-auto flex max-w-2xl gap-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies…"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-fg)] outline-none ring-[var(--color-accent)]/40 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-fg)]"
              >
                Close
              </button>
            </div>
            {searchError && <p className="mx-auto mt-2 max-w-2xl text-xs text-red-400">{searchError}</p>}
          </div>
          <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
            {searchLoading && <p className="text-sm text-[var(--color-muted)]">Searching…</p>}
            {!searchLoading && query && filteredResults.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">No results in this search batch.</p>
            )}
            <ul className="space-y-2">
              {filteredResults.map((m) => (
                <li key={m.imdbId ?? m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void openDetail(m)
                      setSearchOpen(false)
                    }}
                    className="flex w-full gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left hover:border-[var(--color-accent)]/40"
                  >
                    <img src={posterSrc(m)} alt="" className="h-16 w-11 rounded object-cover" />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-fg)]">{m.title}</p>
                      <p className="text-xs text-[var(--color-muted)]">{m.releaseYear}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
            {detailLoading ? (
              <p className="text-sm text-[var(--color-muted)]">Loading details…</p>
            ) : (
              <>
                <div className="flex flex-col gap-4 md:flex-row">
                  <img src={posterSrc(detail)} alt="" className="mx-auto w-40 rounded-lg md:mx-0" />
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--color-fg)]">{detail.title}</h2>
                    <p className="text-xs text-[var(--color-muted)]">
                      {detail.releaseYear}
                      {detail.imdbRating ? ` · IMDb ${detail.imdbRating}` : ''}
                    </p>
                    <p className="mt-3 text-sm text-[var(--color-muted)]">{detail.overview}</p>
                    {detail.genre && <p className="mt-2 text-xs text-[var(--color-muted)]">Genre: {detail.genre}</p>}
                    {detail.director && <p className="text-xs text-[var(--color-muted)]">Director: {detail.director}</p>}
                    {detail.actors && <p className="text-xs text-[var(--color-muted)]">Cast: {detail.actors}</p>}
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <WatchTrailerButton
                    movie={detail}
                    loading={trailer.isLoadingMovie(detail)}
                    trailersConfigured={trailersConfigured}
                    onWatch={(m) => void trailer.playTrailer(m)}
                  />
                  <button
                    type="button"
                    disabled={!roomContext}
                    onClick={() => void proposeToRoom()}
                    className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Propose to room
                  </button>
                  {roomContext && (
                    <button
                      type="button"
                      onClick={() => navigate(`/room/${roomContext}`)}
                      className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg)]"
                    >
                      Back to room
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]"
                  >
                    Close
                  </button>
                </div>
                {proposeMsg && <p className="mt-3 text-xs text-[var(--color-muted)]">{proposeMsg}</p>}
                <p className="mt-2 text-[10px] text-[var(--color-muted)]">
                  Browsing does not start playback. Use your own authorized video source in the watch room.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <TrailerModal
        open={trailer.open}
        title={trailer.display.title}
        year={trailer.display.year}
        videoId={trailer.videoId}
        loading={trailer.loading}
        error={trailer.error}
        unavailableMessage={trailer.unavailableMessage}
        onClose={trailer.close}
        onEmbedFailure={trailer.onEmbedFailure}
        onPropose={() => void proposeFromTrailer()}
        proposeDisabled={!roomContext || !trailer.activeMovie?.imdbId}
        proposeHint={
          !roomContext
            ? 'Create or join a watch room to propose this trailer to everyone.'
            : null
        }
      />
    </div>
  )
}
