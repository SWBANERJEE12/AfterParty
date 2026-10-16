import { Text } from '@react-three/drei'
import { TravelDoor } from '../world/TravelDoor'

function CafeTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.65, 0.65, 0.07, 20]} />
        <meshStandardMaterial color="#6b4f3a" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.76, 10]} />
        <meshStandardMaterial color="#3d2b1f" />
      </mesh>
      {[[0.45, 0.4], [-0.45, 0.4], [0.45, -0.4], [-0.45, -0.4]].map(([ox, oz]) => (
        <mesh key={`${ox}-${oz}`} position={[ox, 0.42, oz]}>
          <boxGeometry args={[0.34, 0.07, 0.34]} />
          <meshStandardMaterial color="#5c4638" roughness={0.88} />
        </mesh>
      ))}
    </group>
  )
}

function Pendant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 3.2, z]}>
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#2a2420" />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <coneGeometry args={[0.22, 0.28, 12, 1, true]} />
        <meshStandardMaterial
          color="#fff3e0"
          emissive="#ffcc88"
          emissiveIntensity={0.55}
          side={2}
        />
      </mesh>
      <pointLight position={[0, -0.5, 0]} intensity={0.45} color="#ffddaa" distance={5} decay={2} />
    </group>
  )
}

export function CafeScene() {
  return (
    <>
      <color attach="background" args={['#2a2218']} />
      <fog attach="fog" args={['#2a2218', 18, 32]} />
      <ambientLight intensity={0.55} color="#ffe8d0" />
      <hemisphereLight args={['#fff4e6', '#4a3828', 0.48]} />
      <directionalLight position={[2, 8, 3]} intensity={0.35} color="#fff8ee" castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 13]} />
        <meshStandardMaterial color="#4a3f35" roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#6b5a48" roughness={0.94} />
      </mesh>
      {[-6.55, 6.55].map((z) => (
        <mesh key={z} position={[0, 1.8, z]}>
          <boxGeometry args={[14, 3.6, 0.12]} />
          <meshStandardMaterial color="#5c4a3a" roughness={0.9} />
        </mesh>
      ))}
      {[-7.05, 7.05].map((x) => (
        <mesh key={x} position={[x, 1.8, 0]}>
          <boxGeometry args={[0.12, 3.6, 13]} />
          <meshStandardMaterial color="#5c4a3a" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 3.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 13]} />
        <meshStandardMaterial color="#3d3228" roughness={0.95} />
      </mesh>

      <group position={[0, 0, 4.2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[5, 1.1, 0.7]} />
          <meshStandardMaterial color="#4a3828" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.15, 0.05]}>
          <boxGeometry args={[3.5, 0.9, 0.08]} />
          <meshStandardMaterial color="#2a2118" roughness={0.7} />
        </mesh>
        <Text position={[0, 1.2, 0.12]} fontSize={0.14} color="#ffeedd" anchorX="center" maxWidth={3}>
          Latte · Mocha · Night Owl Blend
        </Text>
      </group>

      <CafeTable x={-3.6} z={2} />
      <CafeTable x={3.6} z={2} />
      <CafeTable x={-3.6} z={-2.5} />
      <CafeTable x={3.6} z={-2.5} />

      <Pendant x={-2} z={0} />
      <Pendant x={2} z={0} />
      <Pendant x={0} z={-1} />

      <TravelDoor variant="cafe" position={[-6.8, 0, -5.2]} rotationY={Math.PI / 2} />
    </>
  )
}
