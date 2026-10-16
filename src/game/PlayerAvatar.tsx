import { Html } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { accentForColor } from '../shared/avatarColors'
import { avatarBodyMaterial, mat } from './shared/sceneMaterials'

type Props = {
  displayName: string
  movingRef: React.RefObject<boolean>
  color: string
}

export function PlayerAvatar({ displayName, movingRef, color }: Props) {
  const body = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const accent = accentForColor(color)
  const bodyMat = useMemo(() => avatarBodyMaterial(color), [color])
  const accentMat = useMemo(() => avatarBodyMaterial(accent), [accent])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const moving = movingRef.current
    const bob = moving ? Math.sin(t * 13) * 0.04 : Math.sin(t * 2) * 0.01
    const swing = moving ? Math.sin(t * 13) * 0.35 : 0
    if (body.current) body.current.position.y = 0.92 + bob
    if (leftLeg.current) leftLeg.current.rotation.x = swing
    if (rightLeg.current) rightLeg.current.rotation.x = -swing
  })

  return (
    <group>
      <group ref={body}>
        <group ref={leftLeg} position={[-0.18, 0.38, 0]}>
          <mesh position={[0, 0, 0]} castShadow material={mat.shoe}>
            <capsuleGeometry args={[0.13, 0.22, 4, 8]} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.18, 0.38, 0]}>
          <mesh castShadow material={mat.shoe}>
            <capsuleGeometry args={[0.13, 0.22, 4, 8]} />
          </mesh>
        </group>
        <mesh position={[0, 0.72, 0]} castShadow material={bodyMat}>
          <capsuleGeometry args={[0.42, 0.48, 6, 10]} />
        </mesh>
        <mesh position={[-0.48, 0.68, 0.02]} rotation={[0.15, 0, 0.4]} castShadow material={bodyMat}>
          <capsuleGeometry args={[0.11, 0.28, 4, 8]} />
        </mesh>
        <mesh position={[0.48, 0.68, 0.02]} rotation={[0.15, 0, -0.4]} castShadow material={bodyMat}>
          <capsuleGeometry args={[0.11, 0.28, 4, 8]} />
        </mesh>
        <mesh position={[0, 1.22, 0.05]} castShadow material={mat.skin}>
          <sphereGeometry args={[0.32, 16, 16]} />
        </mesh>
        <mesh position={[0, 1.48, -0.02]} castShadow material={accentMat}>
          <sphereGeometry args={[0.3, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        </mesh>
        <mesh position={[0.11, 1.18, 0.26]} material={mat.shoe}>
          <sphereGeometry args={[0.055, 8, 8]} />
        </mesh>
        <mesh position={[-0.11, 1.18, 0.26]} material={mat.shoe}>
          <sphereGeometry args={[0.055, 8, 8]} />
        </mesh>
        <mesh position={[0.11, 1.24, 0.28]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.11, 1.24, 0.28]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
        </mesh>
      </group>
      <Html
        position={[0, 1.95, 0]}
        center
        distanceFactor={9}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          padding: '3px 10px',
          borderRadius: '8px',
          background: 'rgba(20, 16, 32, 0.85)',
          color: '#fff9f0',
          fontSize: '12px',
          fontWeight: 600,
          border: `1px solid ${accent}55`,
        }}
      >
        {displayName}
      </Html>
    </group>
  )
}
