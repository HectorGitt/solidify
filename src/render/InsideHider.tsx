import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type * as THREE from 'three'
import { partObjects } from '@/parts/registry'
import { useInside } from '@/ui/inside'

/** layer nothing renders or picks on */
const ASIDE = 31

/**
 * While you look inside a part, set aside everything that is not on the way down to it: the
 * floor, other machines, force arrows, smoke, the scene's own labels. Uses render layers rather
 * than `visible`, which scenes set themselves every frame. Put back on the way out.
 * Mount inside the Canvas.
 */
export function InsideHider() {
  const id = useInside((s) => s.id)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (!id) return
    const saved = new Map<THREE.Object3D, number>()
    const aside = (root: THREE.Object3D) =>
      root.traverse((o) => {
        if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera || saved.has(o)) return
        saved.set(o, o.layers.mask)
        o.layers.set(ASIDE)
      })
    let timer = 0
    const sweep = () => {
      const target = partObjects.get(id)
      for (let o: THREE.Object3D | null = target ?? null; o && o !== scene; o = o.parent) {
        const parent = o.parent
        if (!parent) break
        for (const c of parent.children) if (c !== o) aside(c)
      }
      // things added later (an arrow that remounts, new particles) are caught on the next pass
      timer = window.setTimeout(sweep, 250)
    }
    sweep()
    document.body.classList.add('inside-mode')
    return () => {
      window.clearTimeout(timer)
      for (const [o, mask] of saved) o.layers.mask = mask
      document.body.classList.remove('inside-mode')
    }
  }, [id, scene])
  return null
}
