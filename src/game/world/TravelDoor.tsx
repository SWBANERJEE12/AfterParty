import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { Group } from 'three'

type Variant = 'home' | 'blockbuster' | 'cafe'

type Props = {
  variant: Variant
  position: [number, number, number]
  rotationY?: number
  open?: boolean
}

const GREIGE = '#c6c3bc'
const TRIM = '#b8b0a6'
const WALL_TAUPE = '#a39e96'
const BLACK = '#141414'

const tint: Record<Variant, string> = {
  home: GREIGE,
  blockbuster: '#c4c8d0',
  cafe: '#c9c0b4',
}

/** Modern flush door — wide flat trim, vertical inlay, matte lever (reference-style). */
export function TravelDoor({ variant, position, rotationY = 0, open = false }: Props) {
  const swing = useRef<Group>(null)
  const panelColor = tint[variant]
  const target = open ? -Math.PI / 2.1 : 0

  useFrame((_, delta) => {
    if (!swing.current) return
    swing.current.rotation.y = THREE.MathUtils.lerp(
      swing.current.rotation.y,
      target,
      Math.min(1, delta * 4.5),
    )
  })

  const w = 1.05
  const h = 2.15
  const trimW = 0.14

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Wall reveal */}
      <mesh position={[0, 1.12, -0.06]}>
        <boxGeometry args={[w + trimW * 2 + 0.08, h + trimW * 2 + 0.06, 0.1]} />
        <meshStandardMaterial color={WALL_TAUPE} roughness={0.92} />
      </mesh>

      {/* Flat mitered-style trim (casing) */}
      <mesh position={[0, h / 2 + trimW + 0.02, 0.02]}>
        <boxGeometry args={[w + trimW * 2, trimW, 0.05]} />
        <meshStandardMaterial color={TRIM} roughness={0.78} />
      </mesh>
      <mesh position={[-(w / 2 + trimW / 2), h / 2, 0.02]}>
        <boxGeometry args={[trimW, h + trimW * 2, 0.05]} />
        <meshStandardMaterial color={TRIM} roughness={0.78} />
      </mesh>
      <mesh position={[w / 2 + trimW / 2, h / 2, 0.02]}>
        <boxGeometry args={[trimW, h + trimW * 2, 0.05]} />
        <meshStandardMaterial color={TRIM} roughness={0.78} />
      </mesh>

      <group ref={swing} position={[-w / 2, 0, 0.04]}>
        <group position={[w / 2, h / 2, 0]}>
          <mesh>
            <boxGeometry args={[w, h, 0.06]} />
            <meshStandardMaterial color={panelColor} roughness={0.72} metalness={0.02} />
          </mesh>
          {/* Vertical black inlay */}
          <mesh position={[w * 0.22, 0, 0.032]}>
            <boxGeometry args={[0.012, h * 0.92, 0.008]} />
            <meshStandardMaterial color={BLACK} roughness={0.4} metalness={0.15} />
          </mesh>
          {/* Matte black lever */}
          <group position={[w * 0.22, -0.05, 0.05]}>
            <mesh>
              <boxGeometry args={[0.1, 0.14, 0.03]} />
              <meshStandardMaterial color={BLACK} roughness={0.55} metalness={0.35} />
            </mesh>
            <mesh position={[0.06, 0, 0.02]} rotation={[0, 0, -0.15]}>
              <boxGeometry args={[0.18, 0.04, 0.025]} />
              <meshStandardMaterial color={BLACK} roughness={0.55} metalness={0.35} />
            </mesh>
          </group>
        </group>
      </group>

      <pointLight position={[0, 2.1, 0.55]} intensity={0.42} color="#fff8f0" distance={3.5} decay={2} />
    </group>
  )
}
