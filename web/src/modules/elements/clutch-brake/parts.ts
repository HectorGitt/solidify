import * as THREE from 'three'
import { box, mat4, xform } from '@/geometry'
import { bandLayout } from './model'

/**
 * Geometry for the clutch & brake scene. The clutches, drums, shoes, bands and pins are the shared
 * parts library's builders (src/parts/lib/elements.ts), re-exported under the scene's names.
 * Clutches are lathed in a Y-axis frame (the scene turns them so the shafts run along X); brakes
 * are drawn in the XY plane with drum axes along Z.
 */

export {
  DISC,
  annularSector as sector,
  bandStrip as strip,
  brakeDrum as drum,
  coneClutch as coneClutchParts,
  latheMM as lathMM,
  multiDiscClutch as discClutchParts,
  pin,
  plateStack,
} from '@/parts/lib/elements'

const { PI, cos, sin } = Math

/** Band-brake band: from the fixed pivot O, round the drum over the top, to the lever point A. */
export function bandPath(r: number, wrap: number, la: number, t: number, leverTop: number) {
  const L = bandLayout(r, wrap, la)
  const rc = r + t / 2
  const pts: THREE.Vector2[] = [new THREE.Vector2(-la / 2, -L.h + leverTop)]
  const n = 96
  // from the left tangent angle round the top (decreasing angle) to the right one
  const a0 = L.tl + 2 * PI
  const a1 = L.tr
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector2(rc * cos(a), rc * sin(a)))
  }
  pts.push(new THREE.Vector2(la / 2, -L.h + leverTop))
  return { pts, ...L }
}

export function stand(x: number, z: number, yTop: number, yFloor: number, w = 0.05, d = 0.06) {
  return xform(box(w, yTop - yFloor, d), mat4.t(x, (yTop + yFloor) / 2, z))
}
