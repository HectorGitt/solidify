import { useEffect, useRef, useState } from 'react'

/**
 * Bridge from the 3D frame loop to DOM panels without re-rendering React every frame:
 * scenes write into a plain mutable object; panels poll it at a modest rate.
 */
export function useLive<T>(read: () => T, fps = 20, equal: (a: T, b: T) => boolean = Object.is): T {
  const [v, setV] = useState<T>(read)
  const readRef = useRef(read)
  readRef.current = read
  useEffect(() => {
    let raf = 0
    let last = 0
    let cur = readRef.current()
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 1000 / fps) return
      last = t
      const next = readRef.current()
      if (!equal(cur, next)) {
        cur = next
        setV(next)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fps, equal])
  return v
}
