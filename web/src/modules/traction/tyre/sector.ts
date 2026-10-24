import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { finalize, type V2 } from '@/geometry'

/**
 * Revolve a closed (r, y) profile about Y over [phiStart, phiStart + phiLength] and close the two
 * ends with flat caps, giving a watertight, outward-facing sector solid (lathe() with a partial
 * angle leaves the ends open). Profile in counter-clockwise order, as for lathe(). Uses the same
 * angle convention as THREE.LatheGeometry: x = r·sin φ, z = r·cos φ.
 */
export function latheSector(profile: V2[], phiStart: number, phiLength: number, segments = 64): THREE.BufferGeometry {
  if (phiLength >= 2 * Math.PI - 1e-9) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r, y))
    pts.push(pts[0].clone())
    return finalize(mergeVertices(new THREE.LatheGeometry(pts, segments, 0, 2 * Math.PI), 1e-7), Math.PI / 4)
  }
  const n = profile.length
  const pos: number[] = []
  const P = (i: number, phi: number) => {
    const [r, y] = profile[((i % n) + n) % n]
    return new THREE.Vector3(r * Math.sin(phi), y, r * Math.cos(phi))
  }
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  // side walls: for a CCW (r, y) profile swept with increasing φ, (a, b, c) = (p_i(φ0), p_i+1(φ0), p_i+1(φ1)) faces outward
  for (let k = 0; k < segments; k++) {
    const f0 = phiStart + (phiLength * k) / segments
    const f1 = phiStart + (phiLength * (k + 1)) / segments
    for (let i = 0; i < n; i++) {
      const a = P(i, f0)
      const b = P(i + 1, f0)
      const c = P(i + 1, f1)
      const d = P(i, f1)
      tri(a, c, b)
      tri(a, d, c)
    }
  }
  // end caps from the profile polygon
  const contour = profile.map(([r, y]) => new THREE.Vector2(r, y))
  const tris = THREE.ShapeUtils.triangulateShape(contour, [])
  const ccw = !THREE.ShapeUtils.isClockWise(contour)
  for (const [end, phi] of [
    [0, phiStart],
    [1, phiStart + phiLength],
  ] as const) {
    for (const [i, j, k] of tris) {
      // at φ0 the cap faces −φ direction; at φ1 it faces +φ
      const flip = (end === 0) === ccw
      if (flip) tri(P(i, phi), P(j, phi), P(k, phi))
      else tri(P(i, phi), P(k, phi), P(j, phi))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const out = finalize(g, Math.PI / 4)
  return out
}
