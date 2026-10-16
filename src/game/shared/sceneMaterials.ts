import * as THREE from 'three'

export const mat = {
  leather: new THREE.MeshStandardMaterial({ color: '#6b4a38', roughness: 0.78 }),
  leatherLight: new THREE.MeshStandardMaterial({ color: '#8a5f48', roughness: 0.76 }),
  woodDark: new THREE.MeshStandardMaterial({ color: '#3d2c22', roughness: 0.86 }),
  wallDark: new THREE.MeshStandardMaterial({ color: '#1a2233', roughness: 0.9 }),
  carpet: new THREE.MeshStandardMaterial({ color: '#3a3a42', roughness: 0.98 }),
  bbBlue: new THREE.MeshStandardMaterial({ color: '#1e4d8c', roughness: 0.82 }),
  bbYellow: new THREE.MeshStandardMaterial({
    color: '#f5d442',
    emissive: '#f5d442',
    emissiveIntensity: 0.12,
    roughness: 0.75,
  }),
  metalShelf: new THREE.MeshStandardMaterial({
    color: '#1a1a1a',
    roughness: 0.55,
    metalness: 0.45,
  }),
  skin: new THREE.MeshStandardMaterial({ color: '#ffe8d6', roughness: 0.82 }),
  shoe: new THREE.MeshStandardMaterial({ color: '#2e2840', roughness: 0.88 }),
}

export function avatarBodyMaterial(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05 })
}
