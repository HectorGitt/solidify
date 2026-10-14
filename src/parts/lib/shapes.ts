import * as THREE from 'three'
import { cylinder, extrudeTwisted, gearOutline, helixSpring, lathe, mat4, merge, xform, type V2 } from '@/geometry'
import { splineShaft } from '@/geometry/parts'

/**
 * Shared parts library — basic shapes: shafts, tubes, spur/helical/internal gears, dog rings,
 * splined plates, coil springs, casings. (Started as the power-train scenes' helpers.) Convention: shafts run along world Z,
 * gears lie in the XY plane (as `gear()` builds them), so a gear turns by rotation.z.
 * All solids are closed and outward-facing.
 */

const { PI } = Math

/** Revolve an (r, z) profile (CCW in the r–z half-plane) about the Z axis. */
export function axial(profile: V2[], segments = 48) {
  return xform(lathe(profile, segments), mat4.rx(PI / 2))
}

/** Make an (r, z) loop counter-clockwise (solid on the left), as lathe() expects. */
export function ccwProfile(pts: V2[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) a += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1]
  return a > 0 ? pts : pts.slice().reverse()
}

/** Revolved solid about Z from a closed (r, z) loop given in either winding. */
export const shellZ = (pts: V2[], segments = 64) => axial(ccwProfile(pts), segments)

/** Annulus / tube along Z from z0 to z1. */
export function ringZ(rOut: number, rIn: number, z0: number, z1: number, segments = 48) {
  return axial(
    [
      [rIn, z0],
      [rOut, z0],
      [rOut, z1],
      [rIn, z1],
    ],
    segments,
  )
}

/** Solid shaft along Z from z0 to z1. */
export function shaftZ(r: number, z0: number, z1: number, segments = 24) {
  return xform(cylinder(r, z1 - z0, segments), mat4.c(mat4.t(0, 0, (z0 + z1) / 2), mat4.rx(PI / 2)))
}

/**
 * Splined shaft along Z from z0 to z1 (`splineShaft` from geometry/parts, turned onto Z):
 * `splines` teeth with tips at rOut and roots at rRoot.
 */
export function splineZ(splines: number, rOut: number, rRoot: number, z0: number, z1: number, toothFrac?: number) {
  return xform(splineShaft(splines, rOut, rRoot, z1 - z0, toothFrac), mat4.c(mat4.t(0, 0, (z0 + z1) / 2), mat4.rx(PI / 2)))
}

function circle(r: number, n = 32, cw = false) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    const a = ((cw ? -1 : 1) * 2 * PI * i) / n
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

/** Spur gear (axis Z, centred on z = 0), low-poly flanks to keep the scene budget. */
export function spur(z: number, m: number, width: number, bore = 0, flank = 3) {
  const outline = gearOutline(z, m, 20, { flankPoints: flank })
  return extrudeTwisted(outline, bore ? [circle(bore, 32, true)] : [], width)
}

/**
 * Helical gear. `hand` +1 / −1: a mating external pair needs opposite hands. Few twist steps
 * keep the triangle count down; the helix still reads clearly.
 */
export function helical(z: number, m: number, width: number, helixDeg: number, hand: 1 | -1, bore = 0, flank = 3, steps = 3) {
  const outline = gearOutline(z, m, 20, { flankPoints: flank })
  const r = (m * z) / 2
  const twist = (hand * width * Math.tan((helixDeg * PI) / 180)) / r
  return extrudeTwisted(outline, bore ? [circle(bore, 32, true)] : [], width, twist, steps)
}

/** Internal (annulus) gear with an outer rim, axis Z. */
export function internalGear(z: number, m: number, width: number, rimOuter: number, flank = 3) {
  const r = (m * z) / 2
  const space = gearOutline(z, m, 20, { ra: r + 1.25 * m, rf: r - m, flankPoints: flank })
  return extrudeTwisted(circle(rimOuter, 96), [space.slice().reverse()], width)
}

/** Dog-clutch teeth / spline ring: n square-ish teeth from rRoot to rTip, bore rIn. */
export function dogRing(n: number, rRoot: number, rTip: number, rIn: number, width: number) {
  const pts: THREE.Vector2[] = []
  const pitch = (2 * PI) / n
  for (let i = 0; i < n; i++) {
    const a = i * pitch
    const h = pitch * 0.25
    pts.push(new THREE.Vector2(rRoot * Math.cos(a - h * 1.05), rRoot * Math.sin(a - h * 1.05)))
    pts.push(new THREE.Vector2(rTip * Math.cos(a - h), rTip * Math.sin(a - h)))
    pts.push(new THREE.Vector2(rTip * Math.cos(a + h), rTip * Math.sin(a + h)))
    pts.push(new THREE.Vector2(rRoot * Math.cos(a + h * 1.05), rRoot * Math.sin(a + h * 1.05)))
  }
  return extrudeTwisted(pts, rIn > 0 ? [circle(rIn, 32, true)] : [], width)
}

/** Plate with internal spline teeth (splined to a hub): outer rOut, teeth from rTip in to rRoot. */
export function internalSplinePlate(n: number, rOut: number, rRoot: number, rTip: number, width: number) {
  const pts: THREE.Vector2[] = []
  const pitch = (2 * PI) / n
  // hole contour (will be reversed to CW): tooth tips point inward to rTip
  for (let i = 0; i < n; i++) {
    const a = i * pitch
    const h = pitch * 0.25
    pts.push(new THREE.Vector2(rRoot * Math.cos(a - h * 1.05), rRoot * Math.sin(a - h * 1.05)))
    pts.push(new THREE.Vector2(rTip * Math.cos(a - h), rTip * Math.sin(a - h)))
    pts.push(new THREE.Vector2(rTip * Math.cos(a + h), rTip * Math.sin(a + h)))
    pts.push(new THREE.Vector2(rRoot * Math.cos(a + h * 1.05), rRoot * Math.sin(a + h * 1.05)))
  }
  return extrudeTwisted(circle(rOut, 64), [pts.reverse()], width)
}

/** Helical coil spring along +Z from z = 0 to z = 1 (scale.z sets its length). */
export function coilZ(coilR: number, wireR: number, turns: number) {
  return xform(helixSpring(coilR, wireR, 1, turns), mat4.rx(PI / 2))
}

/** Box (closed) from min to max corners. */
export function boxFrom(min: [number, number, number], max: [number, number, number]) {
  const g = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
  g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
  return merge(g)
}

/**
 * Hollow rectangular casing from closed plates that only touch (never overlap), with optional
 * round holes in the two end walls (z = z0 and z = z1) for shafts. Plate thickness t.
 */
export function casing(
  x: [number, number],
  y: [number, number],
  z: [number, number],
  t: number,
  holes: { x: number; y: number; r: number }[] = [],
) {
  const [x0, x1] = x
  const [y0, y1] = y
  const [z0, z1] = z
  const end = (zc: number) => {
    const s = new THREE.Shape()
    s.moveTo(x0, y0)
    s.lineTo(x1, y0)
    s.lineTo(x1, y1)
    s.lineTo(x0, y1)
    s.lineTo(x0, y0)
    for (const h of holes) {
      const p = new THREE.Path()
      p.absarc(h.x, h.y, h.r, 0, 2 * PI, true)
      s.holes.push(p)
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 24 })
    g.translate(0, 0, zc)
    return g
  }
  const parts = [
    end(z0),
    end(z1 - t),
    // floor and roof between the end walls
    new THREE.BoxGeometry(x1 - x0, t, z1 - z0 - 2 * t).translate((x0 + x1) / 2, y0 + t / 2, (z0 + z1) / 2),
    new THREE.BoxGeometry(x1 - x0, t, z1 - z0 - 2 * t).translate((x0 + x1) / 2, y1 - t / 2, (z0 + z1) / 2),
    // side walls between floor and roof
    new THREE.BoxGeometry(t, y1 - y0 - 2 * t, z1 - z0 - 2 * t).translate(x0 + t / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    new THREE.BoxGeometry(t, y1 - y0 - 2 * t, z1 - z0 - 2 * t).translate(x1 - t / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  ]
  return merge(...parts)
}

/**
 * Static phase that makes gear B (zb teeth) interlock with gear A (za teeth, tooth 0 at
 * angle phiA) on the line of centres pointing from A to B at angle gamma (external mesh):
 *   φ_B = γ + π + π/z_B − (φ_A − γ)·z_A/z_B
 * (generalises CAM_GEAR_PHASE in the four-stroke scene). Keep it valid while running by
 * rotating B by −(z_A/z_B)·Δθ_A, which the DriveGraph mesh constraint does.
 */
export function meshPhase(za: number, phiA: number, zb: number, gamma: number) {
  return gamma + PI + PI / zb - (phiA - gamma) * (za / zb)
}

/**
 * Angle gear A (z_a teeth) must have so that it interlocks with gear B whose absolute tooth-0
 * angle is φ_B, B lying in direction γ from A (external mesh). Inverse of `meshPhase`.
 */
export function phaseToMeet(za: number, zb: number, phiB: number, gamma: number) {
  return gamma + (PI - (phiB - gamma - PI) * zb) / za
}

/** Angle of the line of centres from (ax, ay) to (bx, by). */
export const lineAngle = (ax: number, ay: number, bx: number, by: number) => Math.atan2(by - ay, bx - ax)

/** Wrap an angle to (−π, π]. */
export function wrapPi(a: number) {
  const t = (((a + PI) % (2 * PI)) + 2 * PI) % (2 * PI)
  return t - PI
}
