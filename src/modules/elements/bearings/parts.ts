import * as THREE from 'three'
import { box, cylinder, extrude, extrudeTwisted, lathe, mat4, merge, xform, type V2 } from '@/geometry'
import type { BearingType } from './model'

/**
 * Bearing geometry, built in a Y-axis frame (the scene turns it so the shaft runs along Z).
 * Profiles are written in millimetres and scaled to metres. Every solid is a closed lathe or
 * extrusion. Cheap enough to build on the main thread (no CSG).
 */

const { PI, cos, sin, tan, acos, asin } = Math
const MM = 0.001
const mm = (pts: V2[]): V2[] => pts.map(([r, y]) => [r * MM, y * MM])
const ring = (pts: V2[], seg = 72) => lathe(mm(pts), seg)

/** Arc points (r, y) about centre (cr, cy) from angle a0 to a1 (radians, r = cr + R cos a, y = cy + R sin a). */
function arc(cr: number, cy: number, R: number, a0: number, a1: number, n = 12): V2[] {
  const out: V2[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cr + R * cos(a), cy + R * sin(a)])
  }
  return out
}

/** Cage: two thin rings at ±yRing joined by a bridge between each pair of elements. */
function cage(rIn: number, rOut: number, yRing: number, t: number, Z: number, bridge: [number, number]) {
  const parts = [ring([[rIn, yRing], [rOut, yRing], [rOut, yRing + t], [rIn, yRing + t]], 64), ring([[rIn, -yRing - t], [rOut, -yRing - t], [rOut, -yRing], [rIn, -yRing]], 64)]
  for (let i = 0; i < Z; i++) {
    const a = ((i + 0.5) * 2 * PI) / Z
    const b = xform(box(bridge[0] * MM, 2 * yRing * MM, bridge[1] * MM), mat4.c(mat4.ry(-a), mat4.t(((rIn + rOut) / 2) * MM, 0, 0)))
    parts.push(b)
  }
  return merge(...parts)
}

export interface BearingGeometry {
  inner?: THREE.BufferGeometry
  outer?: THREE.BufferGeometry
  cage?: THREE.BufferGeometry
  element?: THREE.BufferGeometry
  /** element transforms at cage angle 0 (Y-axis frame) */
  placements: THREE.Matrix4[]
  bush?: THREE.BufferGeometry
  oil?: THREE.BufferGeometry
  /** housing seat radius (mm) and housing width (mm) */
  seat: number
  width: number
  innerName: string
  outerName: string
}

const around = (Z: number, r: number, y: number, tilt?: THREE.Quaternion) => {
  const out: THREE.Matrix4[] = []
  for (let i = 0; i < Z; i++) {
    const a = (i * 2 * PI) / Z
    const m = new THREE.Matrix4().compose(new THREE.Vector3(r * MM, y * MM, 0), tilt ?? new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
    out.push(new THREE.Matrix4().makeRotationY(-a).multiply(m))
  }
  return out
}

function ballBearing(): BearingGeometry {
  const rg = 6.25
  const t0 = acos(4.5 / rg)
  const inner = ring([[20, -9], [25.5, -9], ...arc(30, 0, rg, PI + t0, PI - t0), [25.5, 9], [20, 9]])
  const outer = ring([[34.5, -9], [40, -9], [40, 9], [34.5, 9], ...arc(30, 0, rg, t0, -t0)])
  return {
    inner,
    outer,
    cage: cage(27.2, 32.8, 6.4, 0.8, 9, [3.2, 2]),
    element: new THREE.SphereGeometry(6 * MM, 24, 16),
    placements: around(9, 30, 0),
    seat: 40,
    width: 18,
    innerName: 'Inner race (grooved)',
    outerName: 'Outer race (grooved)',
  }
}

function rollerBearing(): BearingGeometry {
  return {
    inner: ring([[20, -9], [24.5, -9], [24.5, 9], [20, 9]]),
    outer: ring([[33, -9], [40, -9], [40, 9], [33, 9], [33, 5.7], [35.5, 5.7], [35.5, -5.7], [33, -5.7]]),
    cage: cage(26.5, 32.8, 5.6, 0.9, 14, [4, 1.6]),
    element: cylinder(5.5 * MM, 11 * MM, 28),
    placements: around(14, 30, 0),
    seat: 40,
    width: 18,
    innerName: 'Inner ring (plain raceway)',
    outerName: 'Outer ring with guide ribs',
  }
}

function taperBearing(): BearingGeometry {
  const delta = (13 * PI) / 180
  const eps = (2 * PI) / 180
  const ya = 30 / tan(delta)
  const Lap = 30 / sin(delta)
  const rc = (y: number) => (ya - y) * tan(delta + eps)
  const ri = (y: number) => (ya - y) * tan(delta - eps)
  const rr = (s: number) => (Lap - s) * tan(eps)
  const half = 9.9
  const element = lathe(mm([[0, -7.5], [rr(-7.5), -7.5], [rr(7.5), 7.5], [0, 7.5]]), 24)
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-30, ya, 0).normalize())
  return {
    inner: ring([[20, -half], [29, -half], [29, -7.8], [ri(-7.8), -7.8], [ri(8.5), 8.5], [20, 8.5]]),
    outer: ring([[rc(-half), -half], [40, -half], [40, half], [rc(half), half]]),
    element,
    placements: around(16, 30, 0, tilt),
    seat: 40,
    width: 2 * half,
    innerName: 'Cone (inner ring with ribs)',
    outerName: 'Cup (outer ring)',
  }
}

function needleBearing(): BearingGeometry {
  return {
    inner: ring([[20, -11], [24, -11], [24, 11], [20, 11]]),
    outer: ring([[26, -11], [31, -11], [31, 11], [26, 11], [26, 9.6], [27, 9.6], [27, -9.6], [26, -9.6]]),
    element: cylinder(1.5 * MM, 18 * MM, 12),
    placements: around(46, 25.5, 0),
    seat: 31,
    width: 22,
    innerName: 'Inner ring',
    outerName: 'Outer ring (machined, with ribs)',
  }
}

function thrustBearing(): BearingGeometry {
  const R = 5.75
  const a0 = asin(2.5 / R)
  const shaftWasher = ring([[20, 2.5], ...arc(27, 0, R, PI - a0, a0), [33.5, 2.5], [33.5, 9.5], [20, 9.5]])
  const housingWasher = ring([[21, -9.5], [34, -9.5], [34, -2.5], ...arc(27, 0, R, -a0, -PI + a0), [21, -2.5]])
  const cg = merge(
    ring([[20.6, -1.5], [21.3, -1.5], [21.3, 1.5], [20.6, 1.5]], 64),
    ring([[32.7, -1.5], [33.3, -1.5], [33.3, 1.5], [32.7, 1.5]], 64),
    ...Array.from({ length: 13 }, (_, i) => xform(box(11.4 * MM, 2 * MM, 1.6 * MM), mat4.c(mat4.ry(-((i + 0.5) * 2 * PI) / 13), mat4.t(27 * MM, 0, 0)))),
  )
  return {
    inner: shaftWasher,
    outer: housingWasher,
    cage: cg,
    element: new THREE.SphereGeometry(5.5 * MM, 20, 14),
    placements: around(13, 27, 0),
    seat: 34,
    width: 19,
    innerName: 'Shaft washer (turns with the shaft)',
    outerName: 'Housing washer (seated in the housing)',
  }
}

/** Journal: bronze bush with an exaggerated clearance so the wedge-shaped oil film shows (beyond notes). */
export const JOURNAL = { clearance: 2, ecc: 1.4, attitude: (-35 * PI) / 180 }

function journalBearing(): BearingGeometry {
  const bush = ring([[20 + JOURNAL.clearance, -15], [26, -15], [26, 15], [20 + JOURNAL.clearance, 15]])
  const circle = (r: number, cx: number, cy: number, n = 96, cw = false) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((cw ? -1 : 1) * 2 * PI * i) / n
      return new THREE.Vector2((cx + r * cos(a)) * MM, (cy + r * sin(a)) * MM)
    })
  // shaft centre displaced by e at the attitude angle (in the bush's plane, local X/−Z)
  const ex = JOURNAL.ecc * cos(JOURNAL.attitude)
  const ey = JOURNAL.ecc * sin(JOURNAL.attitude)
  const oil = extrudeTwisted(circle(20 + JOURNAL.clearance - 0.02, 0, 0), [circle(20.02, ex, ey, 96, true)], 29.6 * MM)
  // extrusion runs along Z; turn it to the Y-axis frame (Z → Y)
  oil.applyMatrix4(mat4.rx(-PI / 2))
  return { bush, oil, placements: [], seat: 26, width: 30, innerName: '', outerName: '' }
}

export function bearingGeometry(type: BearingType): BearingGeometry {
  switch (type) {
    case 'ball':
      return ballBearing()
    case 'roller':
      return rollerBearing()
    case 'taper':
      return taperBearing()
    case 'needle':
      return needleBearing()
    case 'thrust':
      return thrustBearing()
    default:
      return journalBearing()
  }
}

/** Housing ring round the bearing (Y-axis frame) and a saddle pedestal (world frame, axis Z). */
export function housingGeometry(type: BearingType) {
  const g = bearingGeometry(type)
  const rs = g.seat
  const R = rs + 12
  const hw = g.width / 2 + 4
  const housing = type === 'thrust' ? ring([[21.5, -hw], [R, -hw], [R, hw - 13.5], [rs, hw - 13.5], [rs, -9.5], [21.5, -9.5]]) : ring([[rs, -hw], [R, -hw], [R, hw], [rs, hw]])
  // pedestal: a block whose top is a saddle hugging the housing ring (shared surface, no overlap)
  const half = R * 0.85
  const s = new THREE.Shape()
  const bottom = -74
  const a0 = -PI / 2 - asin(half / R)
  const a1 = -PI / 2 + asin(half / R)
  s.moveTo(-R - 8, bottom)
  s.lineTo(R + 8, bottom)
  s.lineTo(R + 8, bottom + 8)
  s.lineTo(half, bottom + 8)
  s.lineTo(R * cos(a1), R * sin(a1))
  for (let i = 1; i < 24; i++) {
    const a = a1 - ((a1 - a0) * i) / 24
    s.lineTo(R * cos(a), R * sin(a))
  }
  s.lineTo(R * cos(a0), R * sin(a0))
  s.lineTo(-half, bottom + 8)
  s.lineTo(-R - 8, bottom + 8)
  s.closePath()
  const depth = (type === 'thrust' ? hw * 2 - 13.5 : hw * 2) * MM
  const ped = extrude(s, depth / MM, { curveSegments: 4 })
  ped.scale(MM, MM, MM)
  if (type === 'thrust') ped.translate(0, 0, -6.75 * MM)
  ped.computeBoundingBox()
  ped.computeBoundingSphere()
  const shaft = cylinder(20 * MM, 0.15, 40)
  return { housing, pedestal: ped, shaft, R: R * MM, bottom: bottom * MM, halfWidth: hw * MM }
}

