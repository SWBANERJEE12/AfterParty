import { useEffect, useRef } from 'react'

export type InputState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
}

const INITIAL: InputState = {
  forward: false,
  back: false,
  left: false,
  right: false,
}

export function useInput(enabled: boolean) {
  const input = useRef<InputState>({ ...INITIAL })
  const interactDown = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const keys = new Set<string>()

    const sync = () => {
      input.current = {
        forward: keys.has('KeyW') || keys.has('ArrowUp'),
        back: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) {
        interactDown.current = true
      }
      keys.add(e.code)
      sync()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code)
      sync()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [enabled])

  const consumeInteract = () => {
    if (!interactDown.current) return false
    interactDown.current = false
    return true
  }

  return { input, consumeInteract }
}
