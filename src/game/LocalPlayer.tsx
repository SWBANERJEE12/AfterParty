import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from './world/types'
import type { WorldLayout } from './world/types'
import { clampToRoom, resolveCollisions } from './collision'
import { LAYOUTS } from './world/layouts'
import { useInput } from './useInput'
import { usePointerLook } from './usePointerLook'

const MOVE_SPEED = 4.2
const EYE_HEIGHT = 1.62
const NET_SEND_INTERVAL_MS = 50

export type LocalMotionPayload = {
  x: number
  z: number
  yaw: number
  moving: boolean
  location: WorldLocation
}

export type InteractionHit = {
  id: string
  action: WorldLayout['interactions'][0]['action']
  target?: WorldLocation
}

type Props = {
  enabled: boolean
  location: WorldLocation
  onInteractionChange: (prompt: string | null) => void
  onInteract: (hit: InteractionHit) => void
  onMotion?: (payload: LocalMotionPayload) => void
  teleportRef: React.MutableRefObject<{ x: number; z: number; yaw?: number } | null>
}

export function LocalPlayer({
  enabled,
  location,
  onInteractionChange,
  onInteract,
  onMotion,
  teleportRef,
}: Props) {
  const layout = LAYOUTS[location]
  const { input, consumeInteract } = useInput(enabled)
  const { gl, camera } = useThree()
  const { yaw, pitch } = usePointerLook(enabled, gl.domElement)
  const position = useRef(
    new THREE.Vector3(layout.spawn.x, EYE_HEIGHT, layout.spawn.z),
  )
  const moving = useRef(false)
  const lastPrompt = useRef<string | null>(null)
  const lastNetSend = useRef(0)
  const lastLocation = useRef(location)
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const nearestZone = useRef<WorldLayout['interactions'][0] | null>(null)

  useEffect(() => {
    lastLocation.current = location
  }, [location])

  useEffect(() => {
    camera.position.copy(position.current)
  }, [camera])

  useFrame((state, delta) => {
    if (!enabled) return

    const teleport = teleportRef.current
    if (teleport) {
      position.current.x = teleport.x
      position.current.z = teleport.z
      if (teleport.yaw !== undefined) yaw.current = teleport.yaw
      teleportRef.current = null
    }

    const inp = input.current
    const camYaw = yaw.current

    const forward = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw))
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw))

    let dx = 0
    let dz = 0
    if (inp.forward) {
      dx += forward.x
      dz += forward.z
    }
    if (inp.back) {
      dx -= forward.x
      dz -= forward.z
    }
    if (inp.left) {
      dx -= right.x
      dz -= right.z
    }
    if (inp.right) {
      dx += right.x
      dz += right.z
    }

    const len = Math.hypot(dx, dz)
    const isMoving = len > 0.01
    moving.current = isMoving

    if (isMoving) {
      dx /= len
      dz /= len
      position.current.x += dx * MOVE_SPEED * delta
      position.current.z += dz * MOVE_SPEED * delta
    }

    const resolved = resolveCollisions(
      position.current.x,
      position.current.z,
      layout.colliders,
    )
    const clamped = clampToRoom(resolved.x, resolved.z, layout.bounds)
    position.current.x = clamped.x
    position.current.z = clamped.z
    position.current.y = EYE_HEIGHT

    let nearest: string | null = null
    let nearestDist = Infinity
    let zone: WorldLayout['interactions'][0] | null = null
    for (const z of layout.interactions) {
      const dist = Math.hypot(position.current.x - z.x, position.current.z - z.z)
      if (dist < z.radius && dist < nearestDist) {
        nearestDist = dist
        nearest = z.prompt
        zone = z
      }
    }
    nearestZone.current = zone
    if (nearest !== lastPrompt.current) {
      lastPrompt.current = nearest
      onInteractionChange(nearest)
    }

    if (consumeInteract() && zone) {
      onInteract({
        id: zone.id,
        action: zone.action,
        target: zone.target,
      })
    }

    state.camera.position.copy(position.current)
    euler.current.set(pitch.current, yaw.current, 0, 'YXZ')
    state.camera.quaternion.setFromEuler(euler.current)

    const now = performance.now()
    if (onMotion && now - lastNetSend.current >= NET_SEND_INTERVAL_MS) {
      lastNetSend.current = now
      onMotion({
        x: position.current.x,
        z: position.current.z,
        yaw: yaw.current,
        moving: moving.current,
        location,
      })
    }
  })

  return null
}
