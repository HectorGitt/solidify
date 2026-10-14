import * as THREE from 'three'
import { extrudeTwisted, mat4, xform } from '@/geometry'

/**
 * Conveyor-scene helpers: arc-length lookup for animating chains, buckets and load along a loop,
 * and the flow arrow. The machine parts (hoppers, ducts, troughs, flights, belts, pulleys) live in
 * the parts library, src/parts/lib/processing.ts.
 */

const { PI } = Math

/** Fast lookup of points / tangents along a curve by normalised arc length. */
export class PathTable {
  pts: THREE.Vector3[]
  tans: THREE.Vector3[]
  length: number
  constructor(curve: THREE.Curve<THREE.Vector3>, n = 600, closed = true) {
    this.pts = curve.getSpacedPoints(n)
    this.length = curve.getLength()
    const m = this.pts.length
    this.tans = this.pts.map((_, i) => {
      const a = this.pts[closed ? (i - 1 + m - 1) % (m - 1) : Math.max(0, i - 1)]
      const b = this.pts[closed ? (i + 1) % (m - 1) : Math.min(m - 1, i + 1)]
      return b.clone().sub(a).normalize()
    })
  }
  at(u: number, p: THREE.Vector3, t?: THREE.Vector3) {
    u = ((u % 1) + 1) % 1
    const f = u * (this.pts.length - 1)
    const i = Math.min(this.pts.length - 2, Math.floor(f))
    const k = f - i
    p.copy(this.pts[i]).lerp(this.pts[i + 1], k)
    if (t) t.copy(this.tans[i]).lerp(this.tans[i + 1], k).normalize()
    return p
  }
}

/** Simple chevron arrow (flat prism) pointing +X, length l, width w, thickness t, lying in XZ. */
export function arrowSolid(l: number, w: number, t: number) {
  const hw = w / 2
  const head = Math.min(l * 0.45, w * 1.2)
  const c = [
    new THREE.Vector2(0, -hw * 0.4),
    new THREE.Vector2(l - head, -hw * 0.4),
    new THREE.Vector2(l - head, -hw),
    new THREE.Vector2(l, 0),
    new THREE.Vector2(l - head, hw),
    new THREE.Vector2(l - head, hw * 0.4),
    new THREE.Vector2(0, hw * 0.4),
  ]
  return xform(extrudeTwisted(c, [], t, 0, 1), mat4.rx(-PI / 2))
}
