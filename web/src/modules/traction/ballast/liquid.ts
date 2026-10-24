import * as THREE from 'three'
import { extrude, merge, type V2 } from '@/geometry'

/**
 * Liquid (or air) inside the tyre cavity, below (or above) a horizontal level, built as thin
 * closed slabs across the tyre width. Wheel-plane XY (axle at the origin), axle along Z.
 */

/** Radial extent [rLo, rHi] of the cavity at axial position z, from the liner's inner curve. */
export function cavitySpan(cavity: V2[], z: number, rimR: number): [number, number] | null {
  const hits: number[] = []
  for (let i = 0; i < cavity.length - 1; i++) {
    const [r0, y0] = cavity[i]
    const [r1, y1] = cavity[i + 1]
    if ((y0 - z) * (y1 - z) <= 0 && y0 !== y1) hits.push(r0 + ((r1 - r0) * (z - y0)) / (y1 - y0))
  }
  if (!hits.length) return null
  const hi = Math.max(...hits)
  const lo = hits.length > 1 ? Math.min(...hits) : rimR + 0.006
  return hi - lo > 0.004 ? [Math.max(lo, rimR + 0.006), hi] : null
}

/** Region of the annulus ri < r < ro lying below the line y = yL (all y multiplied by sy; sy = −1 gives the region above −yL). */
export function annulusBelow(ri: number, ro: number, yL: number, sy = 1): THREE.Shape | null {
  const n = 48
  if (yL <= -ro) return null
  const s = new THREE.Shape()
  const arc = (path: THREE.Shape | THREE.Path, r: number, a0: number, a1: number, m: number) => {
    for (let i = 1; i <= m; i++) {
      const a = a0 + ((a1 - a0) * i) / m
      path.lineTo(r * Math.cos(a), sy * r * Math.sin(a))
    }
  }
  const hole = (r: number) => {
    const h = new THREE.Path()
    h.moveTo(r, 0)
    arc(h, r, 0, -2 * Math.PI * 0.999, 72)
    s.holes.push(h)
  }
  if (yL >= ro) {
    s.moveTo(ro, 0)
    arc(s, ro, 0, 2 * Math.PI * 0.999, 96)
    hole(ri)
    return s
  }
  const ao = Math.asin(yL / ro)
  s.moveTo(ro * Math.cos(ao), sy * yL)
  arc(s, ro, ao, -Math.PI - ao, n)
  if (yL >= ri) {
    hole(ri)
    return s
  }
  if (yL > -ri) {
    const ai = Math.asin(yL / ri)
    s.lineTo(-ri * Math.cos(ai), sy * yL)
    arc(s, ri, -Math.PI - ai, ai, n)
  }
  return s
}

/** Liquid below the level (below = true) or air above it, as merged slabs. */
export function cavityFill(cavity: V2[], rimR: number, level: number, below: boolean, slabs = 14) {
  const ys = cavity.map((c) => c[1])
  const z0 = Math.min(...ys) + 0.003
  const z1 = Math.max(...ys) - 0.003
  const dz = (z1 - z0) / slabs
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < slabs; k++) {
    const zc = z0 + (k + 0.5) * dz
    const span = cavitySpan(cavity, zc, rimR)
    if (!span) continue
    const shape = below ? annulusBelow(span[0], span[1], level) : annulusBelow(span[0], span[1], -level, -1)
    if (!shape) continue
    const g = extrude(shape, dz * 0.999, { curveSegments: 4 })
    g.translate(0, 0, zc)
    parts.push(g)
  }
  return parts.length ? merge(...parts) : null
}
