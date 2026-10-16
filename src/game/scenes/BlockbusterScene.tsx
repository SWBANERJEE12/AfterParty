import { Text } from '@react-three/drei'
import { useMemo } from 'react'
import { AisleRacks } from '../blockbuster/AisleRacks'
import { useShelfMovies } from '../blockbuster/useShelfMovies'
import { TravelDoor } from '../world/TravelDoor'

const BB_BLUE_DARK = '#163a6a'

function CeilingLights() {
  const panels = useMemo(
    () =>
      [
        [-5, -4],
        [0, -4],
        [5, -4],
        [-5, 2],
        [0, 2],
        [5, 2],
      ] as [number, number][],
    [],
  )
  return (
    <group position={[0, 3.6, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 17]} />
        <meshStandardMaterial color="#e8eef8" roughness={0.92} />
      </mesh>
      {panels.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, -0.03, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 1.4]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#f0f6ff"
            emissiveIntensity={0.85}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}

function CheckoutCounter() {
  return (
    <group position={[0, 0, 6.6]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.9, 1.2]} />
        <meshStandardMaterial color="#1e4d8c" roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.05, 0.15]}>
        <boxGeometry args={[4.8, 0.08, 0.7]} />
        <meshStandardMaterial color="#1a2848" roughness={0.5} metalness={0.25} />
      </mesh>
      <Text position={[0, 1.35, 0.2]} fontSize={0.22} color="#f5d442" anchorX="center">
        CHECKOUT
      </Text>
    </group>
  )
}

export function BlockbusterScene() {
  const { movies } = useShelfMovies()
  const display = movies.length ? movies : []

  return (
    <>
      <color attach="background" args={['#c8d8f0']} />
      <fog attach="fog" args={['#c8d8f0', 28, 48]} />
      <ambientLight intensity={0.62} color="#f8fbff" />
      <hemisphereLight args={['#ffffff', '#9aa8c0', 0.5]} />
      <directionalLight position={[0, 12, 4]} intensity={0.45} color="#fffef5" castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 17]} />
        <meshStandardMaterial color="#3a3a42" roughness={0.98} />
      </mesh>

      {[
        [0, -8.05, 22, 0.2],
        [0, 8.05, 22, 0.2],
        [-11.05, 0, 0.2, 17],
        [11.05, 0, 0.2, 17],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 1.9, z]} receiveShadow>
          <boxGeometry args={[w, 3.8, d]} />
          <meshStandardMaterial color={BB_BLUE_DARK} roughness={0.88} />
        </mesh>
      ))}

      <mesh position={[0, 3.35, -7.95]}>
        <boxGeometry args={[12, 0.85, 0.15]} />
        <meshStandardMaterial color="#f5d442" emissive="#f5d442" emissiveIntensity={0.12} />
      </mesh>
      <Text position={[0, 3.45, -7.82]} fontSize={0.55} color={BB_BLUE_DARK} anchorX="center">
        BLOCKBUSTER
      </Text>

      <CeilingLights />

      <AisleRacks side="left" movies={display} posterOffset={0} />
      <AisleRacks side="right" movies={display} posterOffset={24} />

      <group position={[0, 0, -2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[2.4, 1.15, 0.9]} />
          <meshStandardMaterial color="#2a3548" roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.08, 0.16]}>
          <planeGeometry args={[1.8, 1]} />
          <meshBasicMaterial color="#1a3058" />
        </mesh>
      </group>

      <CheckoutCounter />

      <group position={[6.5, 0, 5]}>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[2.6, 2.4, 0.12]} />
          <meshStandardMaterial color="#f5d442" emissive="#f5d442" emissiveIntensity={0.12} />
        </mesh>
        <Text position={[0, 1.6, 0.08]} fontSize={0.18} color={BB_BLUE_DARK} anchorX="center" maxWidth={2.2}>
          TONIGHT&apos;S VOTES
        </Text>
      </group>

      {/* Doors in wall alcoves — clear of rack rows (| | | |) */}
      <TravelDoor variant="blockbuster" position={[-1.2, 0, -7.55]} rotationY={0} />
      <TravelDoor variant="cafe" position={[10.35, 0, 2.2]} rotationY={-Math.PI / 2} />
    </>
  )
}
