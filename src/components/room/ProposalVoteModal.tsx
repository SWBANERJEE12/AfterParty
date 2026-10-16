import { useEffect, useState } from 'react'
import type { VotePollDetails } from '../../hooks/useRoomVotePolls'

type Props = {
  open: boolean
  memberKey: string
  details: VotePollDetails | null
  onVote: (vote: 1 | -1) => void
  onClose: () => void
  onPlayTrailer?: () => void
  isHost: boolean
}

export function ProposalVoteModal({
  open,
  memberKey,
  details,
  onVote,
  onClose,
  onPlayTrailer,
  isHost,
}: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [open])

  if (!open || !details) return null
  const poll = details.poll
  const isProposer = poll.proposer_member_key === memberKey
  const expired = new Date(poll.expires_at).getTime() <= now
  const finalized = poll.status === 'finalized'
  const remainingSec = Math.max(0, Math.ceil((new Date(poll.expires_at).getTime() - now) / 1000))

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vote-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex gap-4 p-5">
          {poll.poster_url && (
            <img src={poll.poster_url} alt="" className="h-28 w-20 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <h2 id="vote-modal-title" className="text-lg font-semibold text-[var(--color-fg)]">
              {poll.title}
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              {poll.release_year ?? '—'} · proposed by {poll.proposer_nickname}
            </p>
            {!finalized && !expired && (
              <p className="mt-2 text-sm text-[#FE4401]">Voting ends in {remainingSec}s</p>
            )}
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              👍 {details.up} · 👎 {details.down} · {details.eligible} eligible voters
            </p>
          </div>
        </div>
        {poll.youtube_video_id && (
          <div className="aspect-video w-full bg-black">
            <iframe
              title="Trailer preview"
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${poll.youtube_video_id}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] p-4">
          {!finalized && !expired && !isProposer && (
            <>
              <button
                type="button"
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => onVote(1)}
              >
                👍 Thumbs up
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-red-900/80 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => onVote(-1)}
              >
                👎 Thumbs down
              </button>
            </>
          )}
          {isProposer && !finalized && (
            <p className="text-xs text-[var(--color-muted)]">You proposed this title — waiting for votes.</p>
          )}
          {finalized && (
            <p className="w-full text-center text-sm font-medium text-[var(--color-fg)]">
              Result: {poll.result === 'passed' ? 'Accepted' : 'Not accepted'}
            </p>
          )}
          {finalized && poll.result === 'passed' && isHost && onPlayTrailer && (
            <button
              type="button"
              className="w-full rounded-lg bg-[#FE4401] px-4 py-2 text-sm font-semibold text-white"
              onClick={onPlayTrailer}
            >
              Play proposed trailer
            </button>
          )}
          <button
            type="button"
            className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
            onClick={onClose}
          >
            {finalized ? 'Close' : 'Minimize'}
          </button>
        </div>
      </div>
    </div>
  )
}
