import { useMemo } from 'react'
import type { ShelfMovie } from '../../shared/movies'
import { MoviePoster } from './MoviePoster'

const FRAME = '#1a1a1a'

type Props = {
  side: 'left' | 'right'
  movies: ShelfMovie[]
  posterOffset: number
}

const RACK_COUNT = 4
const RACK_SPACING = 1.35
const AISLE_EDGE = 3.2

function VhsSpine({ x, y, z, rotY }: { x: number; y: number; z: number; rotY: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
      <boxGeometry args={[0.07, 0.2, 0.14]} />
      <meshStandardMaterial color="#1c1c24" roughness={0.9} />
    </mesh>
  )
}

function SingleRack({
  x,
  rotY,
  movies,
  slotOffset,
}: {
  x: number
  rotY: number
  movies: ShelfMovie[]
  slotOffset: number
}) {
  const zSteps = useMemo(() => {
    const zs: number[] = []
    for (let z = -5.5; z <= 5.5; z += 0.52) zs.push(z)
    return zs
  }, [])
  const shelfYs = [0.45, 1.15, 1.85, 2.5]

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[0.1, 2.75, 11.8]} />
        <meshStandardMaterial color={FRAME} roughness={0.6} metalness={0.4} />
      </mesh>
      {shelfYs.map((y) => (
        <mesh key={y} position={[rotY > 0 ? 0.06 : -0.06, y, 0]}>
          <boxGeometry args={[0.28, 0.04, 11.6]} />
          <meshStandardMaterial color="#2a2a32" metalness={0.35} roughness={0.55} />
        </mesh>
      ))}
      {zSteps.map((z, zi) =>
        shelfYs.map((y, li) => {
          const idx = (slotOffset + zi + li * 7) % Math.max(movies.length, 1)
          const faceOut = zi % 5 === 0 && li % 2 === 0
          if (faceOut && movies[idx]) {
            return (
              <MoviePoster
                key={`${x}-${z}-${y}-p`}
                url={movies[idx].posterUrl}
                position={[rotY > 0 ? 0.2 : -0.2, y + 0.28, z]}
                rotation={[0, rotY, 0]}
                width={0.36}
                height={0.52}
              />
            )
          }
          return (
            <VhsSpine
              key={`${x}-${z}-${y}-v`}
              x={rotY > 0 ? 0.12 : -0.12}
              y={y + 0.1}
              z={z}
              rotY={rotY}
            />
          )
        }),
      )}
    </group>
  )
}

export function AisleRacks({ side, movies, posterOffset }: Props) {
  const sign = side === 'left' ? -1 : 1
  const rotY = side === 'left' ? Math.PI / 2 : -Math.PI / 2
  const baseX = sign * AISLE_EDGE

  const rackXs = useMemo(() => {
    const xs: number[] = []
    for (let i = 0; i < RACK_COUNT; i++) {
      xs.push(baseX + sign * i * RACK_SPACING)
    }
    return xs
  }, [baseX, sign])

  if (!movies.length) return null

  return (
    <group>
      {rackXs.map((x, i) => (
        <SingleRack
          key={`${side}-${i}`}
          x={x}
          rotY={rotY}
          movies={movies}
          slotOffset={posterOffset + i * 11}
        />
      ))}
    </group>
  )
}
