import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { VoteState } from '../shared/movies'
import type { PlayerSnapshot, WorldLocation } from '../shared/protocol'
import { MoviePanel } from '../ui/MoviePanel'
import { LocalPlayer, type InteractionHit, type LocalMotionPayload } from './LocalPlayer'
import { RemotePlayer } from './RemotePlayer'
import { WorldScene } from './WorldScene'
import { LAYOUTS, resolveSpawn } from './world/layouts'

type Props = {
  displayName: string
  roomCode: string
  selfId: string
  selfColor: string
  players: PlayerSnapshot[]
  connected: boolean
  vote: VoteState
  onMotion: (payload: LocalMotionPayload) => void
  onTravel: (to: WorldLocation, from: WorldLocation) => void
  onAddMovie: (movie: import('../shared/movies').MovieMeta) => void
  onRemoveMovie: (id: number) => void
  onCastVote: (id: number) => void
}

export function GameCanvas({
  displayName,
  roomCode,
  selfId,
  selfColor,
  players,
  connected,
  vote,
  onMotion,
  onTravel,
  onAddMovie,
  onRemoveMovie,
  onCastVote,
}: Props) {
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null)
  const [moviePanelOpen, setMoviePanelOpen] = useState(false)
  const [location, setLocation] = useState<WorldLocation>('home')
  const teleportRef = useRef<{ x: number; z: number; yaw?: number } | null>(null)
  const [, setDoorOpen] = useState(false)

  const selfPlayer = players.find((p) => p.id === selfId)
  const layoutLabel = LAYOUTS[location].label

  useEffect(() => {
    if (selfPlayer?.location) {
      setLocation(selfPlayer.location)
    }
  }, [selfPlayer?.location])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setMoviePanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onInteractionChange = useCallback((prompt: string | null) => {
    setInteractionPrompt((prev) => (prev === prompt ? prev : prompt))
  }, [])

  const handleTravel = useCallback(
    (target: WorldLocation) => {
      const from = location
      const spawn = resolveSpawn(LAYOUTS[target], from)
      setDoorOpen(true)
      window.setTimeout(() => {
        teleportRef.current = { x: spawn.x, z: spawn.z, yaw: spawn.yaw }
        setLocation(target)
        onTravel(target, from)
        setDoorOpen(false)
      }, 320)
    },
    [location, onTravel],
  )

  const onInteract = useCallback(
    (hit: InteractionHit) => {
      if (hit.action === 'travel' && hit.target) {
        handleTravel(hit.target)
        return
      }
      if (hit.action === 'browse' || hit.action === 'vote') {
        setMoviePanelOpen(true)
      }
    },
    [handleTravel],
  )

  const others = useMemo(
    () =>
      players.filter((p) => p.id !== selfId && p.location === location),
    [players, selfId, location],
  )

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 72, near: 0.08, far: 80, position: [0, 1.62, 0.5] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <WorldScene location={location} />
          {others.map((player) => (
            <RemotePlayer key={player.id} player={player} />
          ))}
          <LocalPlayer
            enabled={!moviePanelOpen}
            location={location}
            teleportRef={teleportRef}
            onInteractionChange={onInteractionChange}
            onInteract={onInteract}
            onMotion={onMotion}
          />
        </Suspense>
      </Canvas>

      <MoviePanel
        open={moviePanelOpen}
        onClose={() => setMoviePanelOpen(false)}
        vote={vote}
        selfId={selfId}
        onAdd={onAddMovie}
        onRemove={onRemoveMovie}
        onCastVote={onCastVote}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="rounded-lg bg-black/55 px-3 py-1.5 text-sm text-amber-50/95 backdrop-blur-sm">
              Afterparty · {layoutLabel}
            </span>
            <span className="rounded-lg bg-black/45 px-2.5 py-1 text-xs text-amber-50/75 backdrop-blur-sm">
              Room <span className="font-mono font-semibold tracking-widest">{roomCode}</span>
              {' · '}
              {displayName}
              <span
                className="ml-2 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: selfColor }}
              />
              {' · '}
              {players.length}/4
              {vote.shortlist.length > 0 && (
                <span className="text-amber-100/45">
                  {' '}
                  · {vote.shortlist.length} on shortlist
                </span>
              )}
            </span>
          </div>
          <span
            className={`rounded-lg px-3 py-1.5 text-xs backdrop-blur-sm ${
              connected
                ? 'bg-emerald-950/50 text-emerald-200/90'
                : 'bg-red-950/50 text-red-200/90'
            }`}
          >
            {connected ? 'Connected' : 'Reconnecting…'}
          </span>
        </div>

        {!moviePanelOpen && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-50/35" />
        )}

        {interactionPrompt && !moviePanelOpen && (
          <div className="mx-auto mb-2 max-w-md rounded-xl border border-amber-200/20 bg-black/60 px-4 py-3 text-center text-sm text-amber-50 backdrop-blur-md">
            {interactionPrompt}
          </div>
        )}

        <div className="text-center text-xs text-amber-50/50">
          WASD move · E interact · home: east door → Blockbuster
        </div>
      </div>
    </div>
  )
}
