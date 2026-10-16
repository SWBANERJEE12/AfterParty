export type Aabb2D = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export const PLAYER_RADIUS = 0.38

export function resolveCircleAabb(
  x: number,
  z: number,
  box: Aabb2D,
  radius: number = PLAYER_RADIUS,
): { x: number; z: number } {
  let nx = x
  let nz = z

  const closestX = Math.max(box.minX, Math.min(nx, box.maxX))
  const closestZ = Math.max(box.minZ, Math.min(nz, box.maxZ))
  const dx = nx - closestX
  const dz = nz - closestZ
  const distSq = dx * dx + dz * dz

  if (distSq < radius * radius && distSq > 0) {
    const dist = Math.sqrt(distSq)
    const push = (radius - dist) / dist
    nx += dx * push
    nz += dz * push
  } else if (distSq === 0) {
    const penLeft = nx - box.minX
    const penRight = box.maxX - nx
    const penTop = nz - box.minZ
    const penBottom = box.maxZ - nz
    const minPen = Math.min(penLeft, penRight, penTop, penBottom)
    if (minPen === penLeft) nx = box.minX - radius
    else if (minPen === penRight) nx = box.maxX + radius
    else if (minPen === penTop) nz = box.minZ - radius
    else nz = box.maxZ + radius
  }

  return { x: nx, z: nz }
}

export function resolveCollisions(
  x: number,
  z: number,
  colliders: Aabb2D[],
  radius: number = PLAYER_RADIUS,
): { x: number; z: number } {
  let nx = x
  let nz = z
  for (let i = 0; i < 3; i++) {
    for (const box of colliders) {
      const resolved = resolveCircleAabb(nx, nz, box, radius)
      nx = resolved.x
      nz = resolved.z
    }
  }
  return { x: nx, z: nz }
}

export function clampToRoom(
  x: number,
  z: number,
  bounds: Aabb2D,
  radius: number = PLAYER_RADIUS,
): { x: number; z: number } {
  return {
    x: Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x)),
    z: Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, z)),
  }
}
