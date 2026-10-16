import type { WorldLocation } from './world/types'
import { BlockbusterScene } from './scenes/BlockbusterScene'
import { CafeScene } from './scenes/CafeScene'
import { HomeTheaterScene } from './scenes/HomeTheaterScene'

type Props = {
  location: WorldLocation
}

export function WorldScene({ location }: Props) {
  switch (location) {
    case 'blockbuster':
      return <BlockbusterScene />
    case 'cafe':
      return <CafeScene />
    default:
      return <HomeTheaterScene />
  }
}
