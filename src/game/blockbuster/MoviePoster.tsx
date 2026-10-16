import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { loadPosterTexture } from './textureCache'

type Props = {
  url: string
  position: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
}

const fallbackMat = new THREE.MeshStandardMaterial({ color: '#2a3a5c', roughness: 0.9 })

export function MoviePoster({
  url,
  position,
  rotation = [0, 0, 0],
  width = 0.42,
  height = 0.62,
}: Props) {
  const [material, setMaterial] = useState<THREE.Material>(() => fallbackMat)

  useEffect(() => {
    let alive = true
    loadPosterTexture(url)
      .then((tex) => {
        if (!alive) return
        setMaterial(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
      })
      .catch(() => {
        if (alive) setMaterial(fallbackMat)
      })
    return () => {
      alive = false
    }
  }, [url])

  return (
    <mesh position={position} rotation={rotation} material={material}>
      <planeGeometry args={[width, height]} />
    </mesh>
  )
}
