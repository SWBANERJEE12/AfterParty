import { useMemo } from 'react'
import * as THREE from 'three'
import { TravelDoor } from '../world/TravelDoor'

const WALL = '#1a2233'
const WOOD_DARK = '#3d2c22'
const WOOD_CEIL = '#4a3528'
const LEATHER = '#5c3d2e'
const LEATHER_LIGHT = '#7a523f'
const CREAM = '#e8dcc8'

function OrientalRug() {
  return (
    <group position={[0, 0.015, 0.4]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.5, 4.8]} />
        <meshStandardMaterial color="#c9b896" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[5.6, 3.8]} />
        <meshStandardMaterial color="#b8a480" roughness={0.94} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[1.2, 2.4, 32]} />
        <meshStandardMaterial color="#6b4a62" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.4, 1.1, 32]} />
        <meshStandardMaterial color="#3d5a7a" roughness={0.9} />
      </mesh>
    </group>
  )
}

function LeatherSectional() {
  const cushion = (x: number, z: number, w: number, d: number, h = 0.32) => (
    <mesh key={`${x}-${z}`} position={[x, 0.22 + h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={LEATHER_LIGHT} roughness={0.78} metalness={0.04} />
    </mesh>
  )

  return (
    <group position={[-0.5, 0, -5]}>
      <mesh position={[0.5, 0.14, 0]} receiveShadow>
        <boxGeometry args={[5.6, 0.2, 1.15]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.88} />
      </mesh>
      {cushion(-1.8, 0.15, 1.15, 0.95)}
      {cushion(-0.55, 0.15, 1.15, 0.95)}
      {cushion(0.7, 0.15, 1.15, 0.95)}
      {cushion(1.95, 0.15, 1.15, 0.95)}
      {cushion(-2.45, 0.15, 0.95, 1.05)}
      {cushion(-2.45, 1.15, 0.95, 1.05)}
      {cushion(-2.45, 2.2, 0.95, 1.05)}
      <mesh position={[0.5, 0.58, -0.35]} castShadow>
        <boxGeometry args={[5.4, 0.62, 0.28]} />
        <meshStandardMaterial color={LEATHER} roughness={0.82} />
      </mesh>
      <mesh position={[-2.45, 0.55, 1.65]} castShadow>
        <boxGeometry args={[0.28, 0.58, 3.2]} />
        <meshStandardMaterial color={LEATHER} roughness={0.82} />
      </mesh>
      {[
        [-1.5, 0.52, 0.2],
        [0.2, 0.54, 0.15],
        [1.6, 0.5, 0.22],
        [-2.2, 0.55, 1.8],
      ].map(([x, y, z]) => (
        <mesh key={`p-${x}`} position={[x, y, z]} rotation={[0, x * 0.05, 0]} castShadow>
          <boxGeometry args={[0.42, 0.34, 0.18]} />
          <meshStandardMaterial color={x < 0 ? CREAM : '#2a3548'} roughness={0.92} />
        </mesh>
      ))}
    </group>
  )
}

function Ottomans() {
  return (
    <group>
      <mesh position={[-0.9, 0.28, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.32, 0.95]} />
        <meshStandardMaterial color={LEATHER} roughness={0.8} />
      </mesh>
      <mesh position={[1.1, 0.28, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.32, 0.95]} />
        <meshStandardMaterial color={LEATHER_LIGHT} roughness={0.8} />
      </mesh>
    </group>
  )
}

function MediaWall() {
  const screenW = 7.2
  const screenH = screenW / (16 / 9)
  const bays = [-3, -1.5, 0, 1.5, 3]
  return (
    <group position={[0, 0, 6.35]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.5, 0.48, 0.55]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.75} />
      </mesh>
      {bays.map((x) => (
        <group key={x} position={[x, 0.42, 0.1]}>
          <mesh>
            <boxGeometry args={[1.1, 0.34, 0.34]} />
            <meshStandardMaterial color="#1a1510" roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.14]}>
            <planeGeometry args={[0.9, 0.24]} />
            <meshBasicMaterial color="#ffeeddcc" transparent opacity={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.35 + screenH / 2 - 1.2, 0.06]}>
        <boxGeometry args={[screenW + 0.35, screenH + 0.3, 0.12]} />
        <meshStandardMaterial color="#06060a" roughness={0.2} metalness={0.55} />
      </mesh>
      <mesh position={[0, 2.35 + screenH / 2 - 1.2, 0.13]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshBasicMaterial color="#050810" />
      </mesh>
      <mesh position={[0, 2.35 + screenH / 2 - 1.2, 0.135]}>
        <planeGeometry args={[screenW - 0.15, screenH - 0.1]} />
        <meshStandardMaterial
          color="#0c1428"
          emissive="#3355cc"
          emissiveIntensity={0.32}
          roughness={0.35}
        />
      </mesh>
      <pointLight position={[0, 2.8, 3.5]} intensity={0.75} color="#99bbff" distance={14} />
      <mesh position={[0, 2.2, 5.8]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[12, 4]} />
        <meshBasicMaterial color="#2233aa" transparent opacity={0.04} />
      </mesh>
    </group>
  )
}

function GalleryWall() {
  const frames = [2.1, 1.45, 0.8, 0.15, -0.5]
  return (
    <group position={[-5.88, 0, 1.2]} rotation={[0, Math.PI / 2, 0]}>
      {frames.map((y, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh>
            <boxGeometry args={[0.9, 0.55, 0.04]} />
            <meshStandardMaterial color="#2a2118" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[0.78, 0.42]} />
            <meshStandardMaterial
              color={new THREE.Color().setHSL(0.55 + i * 0.04, 0.35, 0.35 + i * 0.04)}
              roughness={0.9}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0.35, 1.2, 0.5]} rotation={[0, -0.35, 0]}>
        <boxGeometry args={[1.1, 0.65, 0.06]} />
        <meshStandardMaterial color="#111" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0.38, 1.2, 0.54]} rotation={[0, -0.35, 0]}>
        <planeGeometry args={[0.95, 0.52]} />
        <meshBasicMaterial color="#1a2848" />
      </mesh>
    </group>
  )
}

function HomeLighting() {
  const cans = [
    [-5, 4],
    [0, 4],
    [5, 4],
    [-5, -1],
    [0, 0],
    [5, -1],
    [-3, -4],
    [3, -4],
  ] as [number, number][]
  return (
    <group>
      {cans.map(([x, z], i) => (
        <group key={i} position={[x, 2.86, z]}>
          <mesh>
            <cylinderGeometry args={[0.14, 0.16, 0.07, 16]} />
            <meshStandardMaterial
              color="#fff9f0"
              emissive="#ffe8c8"
              emissiveIntensity={0.75}
              roughness={0.35}
            />
          </mesh>
          <pointLight position={[0, -0.2, 0]} intensity={0.38} color="#ffe4c8" distance={7} decay={2} />
        </group>
      ))}
      <group position={[-7.2, 0, 3.5]}>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 1.1, 12]} />
          <meshStandardMaterial color="#3d2c22" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.65, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color="#fff3e0"
            emissive="#ffcc88"
            emissiveIntensity={0.5}
            roughness={0.5}
          />
        </mesh>
        <pointLight position={[0, 1.65, 0]} intensity={0.45} color="#ffddb0" distance={5} />
      </group>
      <group position={[7, 0, -2]}>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 1.1, 12]} />
          <meshStandardMaterial color="#3d2c22" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.65, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color="#fff3e0"
            emissive="#ffcc88"
            emissiveIntensity={0.5}
            roughness={0.5}
          />
        </mesh>
        <pointLight position={[0, 1.65, 0]} intensity={0.45} color="#ffddb0" distance={5} />
      </group>
    </group>
  )
}

function RoomShell() {
  const floorGeo = useMemo(() => new THREE.PlaneGeometry(18, 14), [])
  const plankGeo = useMemo(() => new THREE.PlaneGeometry(18, 14), [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={floorGeo}>
        <meshStandardMaterial color="#2a2420" roughness={0.92} />
      </mesh>
      {[-7.05, 7.05].map((z) => (
        <mesh key={z} position={[0, 1.75, z]} receiveShadow>
          <boxGeometry args={[18, 3.5, 0.15]} />
          <meshStandardMaterial color={WALL} roughness={0.92} />
        </mesh>
      ))}
      {[-9.05, 9.05].map((x) => (
        <mesh key={x} position={[x, 1.75, 0]} receiveShadow>
          <boxGeometry args={[0.15, 3.5, 14]} />
          <meshStandardMaterial color={WALL} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 2.98, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={plankGeo}>
        <meshStandardMaterial color={WOOD_CEIL} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 0.15]} />
        <meshBasicMaterial color="#b8d4ff" transparent opacity={0.45} />
      </mesh>
      {[[-2.5, 1.2], [0, 0.5], [2.5, -0.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.88, z]}>
          <cylinderGeometry args={[0.08, 0.1, 0.06, 12]} />
          <meshStandardMaterial
            color="#fff"
            emissive="#fff8ee"
            emissiveIntensity={0.9}
            roughness={0.3}
          />
        </mesh>
      ))}
      <TravelDoor variant="home" position={[8.2, 0, -5.5]} rotationY={-Math.PI / 2} />
    </group>
  )
}

export function HomeTheaterScene() {
  return (
    <>
      <color attach="background" args={['#0d1118']} />
      <fog attach="fog" args={['#1a2030', 24, 48]} />
      <ambientLight intensity={0.5} color="#6a7588" />
      <hemisphereLight args={['#c8d4e8', '#2a2830', 0.55]} />
      <directionalLight
        position={[2, 8, -2]}
        intensity={0.52}
        color="#fff0e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={20}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <pointLight position={[0, 3, 2]} intensity={0.55} color="#ffe8d0" distance={12} />
      <pointLight position={[0, 2.5, -3]} intensity={0.35} color="#a8c4ff" distance={9} />

      <HomeLighting />
      <RoomShell />
      <GalleryWall />
      <OrientalRug />
      <LeatherSectional />
      <Ottomans />
      <MediaWall />
    </>
  )
}
