import type { WorldLocation } from '../../shared/protocol'

export type { WorldLocation }

export type SpawnPoint = {
  x: number
  z: number
  yaw: number
}

export type WorldLayout = {
  id: WorldLocation
  label: string
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[]
  interactions: {
    id: string
    prompt: string
    x: number
    z: number
    radius: number
    action: 'travel' | 'browse' | 'cafe' | 'vote' | 'sofa' | 'tv'
    target?: WorldLocation
    doorVariant?: 'home' | 'blockbuster' | 'cafe'
  }[]
  spawn: SpawnPoint
  /** Spawn when entering from another zone (optional override). */
  entrySpawns?: Partial<Record<WorldLocation, SpawnPoint>>
}
