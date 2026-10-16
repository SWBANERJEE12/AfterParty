import type { WorldLayout } from './types'

/** Enlarged home theatre — 18×14 playable. */
export const HOME_LAYOUT: WorldLayout = {
  id: 'home',
  label: 'Home theatre',
  bounds: { minX: -8.5, maxX: 8.5, minZ: -6.5, maxZ: 6.5 },
  colliders: [
    { minX: -9, maxX: 9, minZ: 6.8, maxZ: 7.2 },
    { minX: -9, maxX: 9, minZ: -7.2, maxZ: -6.8 },
    { minX: -9.4, maxX: -9, minZ: -6.8, maxZ: 6.8 },
    { minX: 9, maxX: 9.4, minZ: -6.8, maxZ: 6.8 },
    { minX: -4.5, maxX: 4.5, minZ: 5.6, maxZ: 6.35 },
    { minX: -6.8, maxX: -3.8, minZ: -6.2, maxZ: -4.8 },
    { minX: -2.2, maxX: 2.2, minZ: -6.2, maxZ: -4.9 },
    { minX: 3.8, maxX: 6.8, minZ: -6.2, maxZ: -4.9 },
    { minX: -6.5, maxX: -4.2, minZ: -4.9, maxZ: -2.8 },
    { minX: -1.1, maxX: 1.1, minZ: -1.2, maxZ: 0.6 },
    { minX: 2.2, maxX: 3.8, minZ: -1.2, maxZ: 0.6 },
    { minX: -7.8, maxX: -6.8, minZ: 1, maxZ: 4.5 },
  ],
  interactions: [
    {
      id: 'sofa',
      prompt: 'Press E to sit (movie night)',
      x: -0.5,
      z: -4.8,
      radius: 3,
      action: 'sofa',
    },
    {
      id: 'tv',
      prompt: 'Press E — theatre screen',
      x: 0,
      z: 4.5,
      radius: 3.5,
      action: 'tv',
    },
    {
      id: 'door-blockbuster',
      prompt: 'Press E to enter Blockbuster',
      x: 8.2,
      z: -5.5,
      radius: 1.8,
      action: 'travel',
      target: 'blockbuster',
      doorVariant: 'home',
    },
  ],
  spawn: { x: 0, z: 1.2, yaw: 0 },
  entrySpawns: {
    blockbuster: { x: 7.8, z: -5.2, yaw: Math.PI },
    cafe: { x: 0, z: 1.2, yaw: 0 },
  },
}

/** Spacious Blockbuster — wide aisles, shelves along walls only. */
export const BLOCKBUSTER_LAYOUT: WorldLayout = {
  id: 'blockbuster',
  label: 'Blockbuster',
  bounds: { minX: -10, maxX: 10, minZ: -7.5, maxZ: 7.5 },
  colliders: [
    { minX: -10.8, maxX: 10.8, minZ: 7.9, maxZ: 8.3 },
    { minX: -10.8, maxX: 10.8, minZ: -8.3, maxZ: -7.9 },
    { minX: -11.2, maxX: -10.8, minZ: -7.9, maxZ: 7.9 },
    { minX: 10.8, maxX: 11.2, minZ: -7.9, maxZ: 7.9 },
    { minX: -1.4, maxX: 1.4, minZ: -1.6, maxZ: -0.2 },
    { minX: -3.2, maxX: 3.2, minZ: 6.2, maxZ: 7.1 },
    { minX: 8.2, maxX: 9.6, minZ: -1.2, maxZ: 1.2 },
  ],
  interactions: [
    {
      id: 'kiosk',
      prompt: 'Press E — browse & search movies',
      x: 0,
      z: -1,
      radius: 2,
      action: 'browse',
    },
    {
      id: 'vote-board',
      prompt: 'Press E — group shortlist & votes',
      x: 6.5,
      z: 5,
      radius: 2,
      action: 'vote',
    },
    {
      id: 'to-cafe',
      prompt: 'Press E to enter the café',
      x: 10,
      z: 2.2,
      radius: 1.8,
      action: 'travel',
      target: 'cafe',
      doorVariant: 'cafe',
    },
    {
      id: 'to-home',
      prompt: 'Press E to return home',
      x: -1.2,
      z: -6.8,
      radius: 1.8,
      action: 'travel',
      target: 'home',
      doorVariant: 'blockbuster',
    },
  ],
  spawn: { x: 0, z: -4.5, yaw: 0 },
  entrySpawns: {
    home: { x: -1.2, z: -6.2, yaw: 0 },
    cafe: { x: 9.2, z: 2.2, yaw: -Math.PI / 2 },
  },
}

export const CAFE_LAYOUT: WorldLayout = {
  id: 'cafe',
  label: 'Café',
  bounds: { minX: -7, maxX: 7, minZ: -6, maxZ: 6 },
  colliders: [
    { minX: -7.6, maxX: 7.6, minZ: 6.3, maxZ: 6.7 },
    { minX: -7.6, maxX: 7.6, minZ: -6.7, maxZ: -6.3 },
    { minX: -8, maxX: -7.6, minZ: -6.3, maxZ: 6.3 },
    { minX: 7.6, maxX: 8, minZ: -6.3, maxZ: 6.3 },
    { minX: -1.3, maxX: 1.3, minZ: 3.8, maxZ: 5.2 },
    { minX: -4.5, maxX: -2.8, minZ: -1.5, maxZ: 0.2 },
    { minX: 2.8, maxX: 4.5, minZ: -1.5, maxZ: 0.2 },
    { minX: -4.5, maxX: -2.8, minZ: -4.2, maxZ: -2.6 },
    { minX: 2.8, maxX: 4.5, minZ: -4.2, maxZ: -2.6 },
  ],
  interactions: [
    {
      id: 'to-blockbuster',
      prompt: 'Press E to return to Blockbuster',
      x: -6.8,
      z: -5.2,
      radius: 1.8,
      action: 'travel',
      target: 'blockbuster',
      doorVariant: 'blockbuster',
    },
  ],
  spawn: { x: 0, z: -4, yaw: 0 },
  entrySpawns: {
    blockbuster: { x: -6.2, z: -4.8, yaw: Math.PI / 2 },
  },
}

export const LAYOUTS: Record<string, WorldLayout> = {
  home: HOME_LAYOUT,
  blockbuster: BLOCKBUSTER_LAYOUT,
  cafe: CAFE_LAYOUT,
}

export function resolveSpawn(
  layout: WorldLayout,
  from?: import('../../shared/protocol').WorldLocation,
): import('./types').SpawnPoint {
  if (from && layout.entrySpawns?.[from]) {
    return layout.entrySpawns[from]!
  }
  return layout.spawn
}
