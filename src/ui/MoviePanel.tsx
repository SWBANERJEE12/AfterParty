import { useCallback, useEffect, useMemo, useState } from 'react'
import { WatchTrailerButton } from '../components/movie/WatchTrailerButton'
import { TrailerModal } from '../components/movie/TrailerModal'
import { useTrailerModal } from '../hooks/useTrailerModal'
import { fetchTrailerStatus } from '../lib/api'
import type { MovieMeta, VoteState } from '../shared/movies'
import { rankMovies } from './movieSearch'

type Props = {
  open: boolean
  onClose: () => void
  vote: VoteState
  selfId: string
  onAdd: (movie: MovieMeta) => void
  onRemove: (movieId: number) => void
  onCastVote: (movieId: number) => void
}

export function MoviePanel({
  open,
  onClose,
  vote,
  selfId,
  onAdd,
  onRemove,
  onCastVote,
}: Props) {
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState<MovieMeta[]>([])
  const [remote, setRemote] = useState<MovieMeta[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'browse' | 'shortlist'>('browse')
  const [trailersConfigured, setTrailersConfigured] = useState<boolean | null>(null)
  const trailer = useTrailerModal()

  useEffect(() => {
    if (!open) return
    fetchTrailerStatus().then((s) => setTrailersConfigured(s.configured))
  }, [open])

  const loadCatalog = useCallback(async (pageNum: number, append: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/movies/catalog?page=${pageNum}`)
      if (!res.ok) throw new Error('Catalog unavailable')
      const data = (await res.json()) as {
        movies: MovieMeta[]
        hasMore: boolean
      }
      setCatalog((prev) => (append ? [...prev, ...data.movies] : data.movies))
      setHasMore(data.hasMore)
      setPage(pageNum)
    } catch {
      setError('Could not load catalogue. Check server / OMDB key.')
    } finally {
      setLoading(false)
    }
  }, [])

  const searchRemote = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setRemote([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/movies/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = (await res.json()) as { results: MovieMeta[] }
      setRemote(data.results ?? [])
    } catch {
      setError('Search failed — try again.')
      setRemote([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    loadCatalog(0, false)
  }, [open, loadCatalog])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => searchRemote(query), 320)
    return () => window.clearTimeout(t)
  }, [open, query, searchRemote])

  const pool = useMemo(() => {
    const map = new Map<number, MovieMeta>()
    for (const m of [...catalog, ...remote]) map.set(m.id, m)
    return [...map.values()]
  }, [catalog, remote])

  const results = useMemo(() => rankMovies(query, pool), [query, pool])

  if (!open) return null

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-blue-300/20 bg-[#121a2a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-amber-50">Blockbuster picks</h2>
            <p className="text-xs text-amber-100/50">Fuzzy search · posters from OMDB</p>
          </div>
          <button
            type="button"
            className="rounded-lg px-3 py-1 text-sm text-amber-100/70 hover:bg-white/10"
            onClick={onClose}
          >
            Esc · Close
          </button>
        </div>

        <div className="flex gap-2 border-b border-white/10 px-4 py-2">
          {(['browse', 'shortlist'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                tab === t ? 'bg-blue-600 text-white' : 'text-amber-100/60 hover:bg-white/5'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'browse' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <input
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-amber-50 outline-none ring-blue-400/40 focus:ring-2"
              placeholder="Search title, director, genre… (typos OK)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && <p className="text-sm text-amber-100/50">Loading…</p>}
              {!loading && results.length === 0 && (
                <p className="text-sm text-amber-100/50">
                  {query.length >= 2 ? 'No matches — try a different spelling.' : 'Type 2+ letters or browse the catalogue.'}
                </p>
              )}
              <ul className="space-y-3">
                {results.map((movie) => {
                  const inList = vote.shortlist.some((m) => m.id === movie.id)
                  return (
                    <li
                      key={movie.id}
                      className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-3"
                    >
                      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-black/50">
                        {movie.posterUrl ? (
                          <img
                            src={movie.posterUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-amber-100/40">
                            No poster
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-amber-50">
                          {movie.title}{' '}
                          <span className="text-amber-100/45">({movie.releaseYear})</span>
                        </p>
                        {(movie.genre || movie.director) && (
                          <p className="text-xs text-amber-100/45">
                            {[movie.genre, movie.director].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        <p className="mt-1 line-clamp-2 text-xs text-amber-100/55">{movie.overview}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 self-center">
                        <WatchTrailerButton
                          movie={movie}
                          size="sm"
                          loading={trailer.isLoadingMovie(movie)}
                          trailersConfigured={trailersConfigured}
                          onWatch={(m) => void trailer.playTrailer(m)}
                        />
                        <button
                          type="button"
                          disabled={inList || vote.shortlist.length >= 5}
                          className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
                          onClick={() => onAdd(movie)}
                        >
                          {inList ? 'Added' : 'Shortlist'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {hasMore && query.length < 2 && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border border-white/15 py-2 text-sm text-amber-100/70 hover:bg-white/5"
                  disabled={loading}
                  onClick={() => loadCatalog(page + 1, true)}
                >
                  Load more titles
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {vote.shortlist.length === 0 && (
              <p className="text-sm text-amber-100/50">No movies yet — browse and add up to 5.</p>
            )}
            <ul className="space-y-3">
              {vote.shortlist.map((movie) => {
                const voters = vote.votes[String(movie.id)] ?? []
                const voted = voters.includes(selfId)
                const isWinner = vote.winnerId === movie.id
                return (
                  <li
                    key={movie.id}
                    className={`flex gap-3 rounded-xl border p-3 ${
                      isWinner ? 'border-yellow-400/50 bg-yellow-950/20' : 'border-white/10 bg-black/25'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-amber-50">
                        {movie.title}{' '}
                        {isWinner && (
                          <span className="text-xs text-yellow-300">· leading vote</span>
                        )}
                      </p>
                      <p className="text-xs text-amber-100/50">
                        {voters.length} vote{voters.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        voted ? 'bg-emerald-600 text-white' : 'bg-white/10 text-amber-50'
                      }`}
                      onClick={() => onCastVote(movie.id)}
                    >
                      {voted ? 'Voted' : 'Vote'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-2 text-xs text-red-300 hover:bg-red-950/40"
                      onClick={() => onRemove(movie.id)}
                    >
                      Remove
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

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
      />
    </div>
  )
}
