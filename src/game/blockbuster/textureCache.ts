import * as THREE from 'three'

const loader = new THREE.TextureLoader()
loader.crossOrigin = 'anonymous'

const cache = new Map<string, THREE.Texture>()
const pending = new Map<string, Promise<THREE.Texture>>()

export function loadPosterTexture(url: string): Promise<THREE.Texture> {
  const hit = cache.get(url)
  if (hit) return Promise.resolve(hit)
  const wait = pending.get(url)
  if (wait) return wait

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        cache.set(url, tex)
        pending.delete(url)
        resolve(tex)
      },
      undefined,
      (err) => {
        pending.delete(url)
        reject(err)
      },
    )
  })
  pending.set(url, promise)
  return promise
}

export function disposePosterTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
  pending.clear()
}
