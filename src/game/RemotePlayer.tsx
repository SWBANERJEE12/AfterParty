import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerSnapshot } from '../shared/protocol'
import { PlayerAvatar } from './PlayerAvatar'

type Props = {
  player: PlayerSnapshot
}

export function RemotePlayer({ player }: Props) {
  const group = useRef<THREE.Group>(null)
  const moving = useRef(player.moving)
  const target = useRef(new THREE.Vector3(player.x, 0, player.z))
  const yawSmooth = useRef(player.yaw)

  useFrame((_, delta) => {
    target.current.set(player.x, 0, player.z)
    moving.current = player.moving

    const lerp = 1 - Math.pow(0.0001, delta)
    yawSmooth.current = THREE.MathUtils.lerp(yawSmooth.current, player.yaw, lerp)

    if (!group.current) return
    group.current.position.lerp(target.current, lerp)
    group.current.rotation.y = yawSmooth.current
  })

  return (
    <group ref={group} position={[player.x, 0, player.z]}>
      <PlayerAvatar
        displayName={player.name}
        movingRef={moving}
        color={player.color}
      />
    </group>
  )
}
