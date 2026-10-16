import { useEffect, useRef } from 'react'

const PITCH_MIN = -1.35
const PITCH_MAX = 1.35

export function usePointerLook(enabled: boolean, canvas: HTMLCanvasElement | null) {
  const yaw = useRef(0)
  const pitch = useRef(0)

  useEffect(() => {
    if (!enabled || !canvas) return

    const onClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock()
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return
      yaw.current -= e.movementX * 0.0022
      pitch.current = Math.max(
        PITCH_MIN,
        Math.min(PITCH_MAX, pitch.current - e.movementY * 0.0022),
      )
    }

    canvas.addEventListener('click', onClick)
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [enabled, canvas])

  return { yaw, pitch }
}
