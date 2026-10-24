import * as THREE from 'three'
import { box, csg, cylinder, extrude, extrudeTwisted, lathe, mat4, merge, pipe, roundedBox, tube, xform, type V2 } from '@/geometry'
import { loft, splineShaft, torus } from '@/geometry/parts'
import { leadForSwing, rad, recircBall, wormPeg } from '@/physics/joints'

/**
 * Shared parts library — manual steering: the recirculating-ball box (ball screw on the end of the
 * column, ball nut with its transfer tube and the recirculating balls' path, rocker arm and shaft),
 * the worm-and-peg box (hourglass worm, rocker with peg), the cast box housing, the steering wheel,
 * and the linkage: drop arm, drag link / track rod (unit link rods), ball joints, steering and
 * track-rod arms, track-rod adjuster. (Moved here from the steering-boxes and steering-linkage
 * scenes, which now use it, as does the whole-tractor view.)
 * Box frame: screw / worm axis along +X (wheel end at +X), rocker shaft along Z at y = BALL.eY
 * (ball box, below the screw) or WORM.eY (worm box, above the worm).
 */

const { PI, sqrt } = Math
/** Y-axis solid → X axis; Z-extrusion → X axis */
const Y2X = mat4.rz(-PI / 2)
const Z2X = mat4.ry(PI / 2)
const Y2Z = mat4.rx(PI / 2)

/** Proportions typical of a 30–60 kW tractor; ±30° drop-arm swing for 2 turns each way. */
export const BALL = {
  z: 0.12,
  /** ball-centre (pitch) radius, land radius, ball and groove radii */
  Rb: 0.0135,
  Ro: 0.0122,
  ball: 0.0035,
  groove: 0.0037,
  /** rocker radius: rocker-shaft axis to the peg's line of travel */
  arm: 0.045,
  lead: leadForSwing('ball', 0.045, rad(30), 2),
  threadLen: 0.12,
  nutLen: 0.05,
  nutH: 0.025,
  /** rocker shaft E position (below the screw) */
  eY: -0.083,
  /** peg engagement height */
  pegY: -0.038,
  turnsInNut: 2,
  balls: 32,
}

/** Drop-arm angle and nut travel for a steering-wheel angle (rad). */
export const ballBoxKinematics = (wheelRad: number) => recircBall(wheelRad, BALL.lead, BALL.arm)

/**
 * Ball-centre helix angle in the nut frame, a = −2πx′/lead + π/2 (groove at (Y, Z) = (sin a, −cos a)).
 * The screw mesh is turned by θ_wheel + π/2 so its groove matches; both circuit ends are then on top.
 */
export const helixAngle = (xLocal: number) => (-2 * Math.PI * xLocal) / BALL.lead + Math.PI / 2
export const SCREW_PHASE = Math.PI / 2

/* ------------------------------ recirculating ball ------------------------------ */

/** Transverse section of the ball screw: land radius with one circular-profile groove at 2D angle 0. */
export function ballScrewSection(n = 120) {
  const pts: THREE.Vector2[] = []
  const lead = BALL.lead
  for (let i = 0; i < n; i++) {
    const a = -PI + (2 * PI * i) / n
    const dz = (a / (2 * PI)) * lead
    const s = BALL.groove * BALL.groove - dz * dz
    let r = BALL.Ro
    if (s > 0) r = Math.min(BALL.Ro, BALL.Rb - sqrt(s))
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

export function ballScrew(columnEnd: number) {
  const L = BALL.threadLen
  const steps = Math.ceil((L / BALL.lead) * 36)
  const thread = xform(extrudeTwisted(ballScrewSection(), [], L, (-2 * PI * L) / BALL.lead, steps), Z2X)
  const r = BALL.Ro - 0.0004
  const shafts = merge(
    xform(cylinder(r, 0.03, 32), mat4.c(mat4.t(-L / 2 - 0.015, 0, 0), Y2X)),
    xform(cylinder(0.011, columnEnd - L / 2, 32), mat4.c(mat4.t((L / 2 + columnEnd) / 2, 0, 0), Y2X)),
  )
  return { thread, shafts }
}

/** Ball nut (block) with its bore, the two transfer-tube holes and the peg F underneath. */
export function ballNut() {
  const { nutLen, nutH, Rb } = BALL
  const blk = roundedBox(nutLen, 2 * nutH, 0.05, 0.004)
  const ops = [
    { op: 'sub' as const, geometry: xform(cylinder(Rb + 0.0026, nutLen + 0.02, 48), Y2X) },
    ...[-1, 1].map((s) => ({ op: 'sub' as const, geometry: xform(cylinder(0.0042, 0.06, 16), mat4.t((s * BALL.turnsInNut * BALL.lead) / 2, 0.02, 0)) })),
  ]
  const nut = csg(blk, ops)
  const peg = xform(cylinder(0.0075, 0.03, 32), mat4.t(0, -nutH - 0.012, 0))
  return { nut, peg }
}

/** Closed ball circuit in the nut frame: helix through the nut, then out and back through the transfer tube. */
export function ballCircuit() {
  const { Rb, lead, turnsInNut, nutH } = BALL
  const half = (turnsInNut * lead) / 2
  const pts: THREE.Vector3[] = []
  const n = 90
  for (let i = 0; i <= n; i++) {
    const x = half - (2 * half * i) / n
    const a = helixAngle(x)
    pts.push(new THREE.Vector3(x, Rb * Math.sin(a), -Rb * Math.cos(a)))
  }
  const top = nutH + 0.007
  const end = pts[pts.length - 1]
  const start = pts[0]
  const tube = [
    new THREE.Vector3(end.x - 0.002, Rb + 0.004, 0),
    new THREE.Vector3(end.x - 0.003, top - 0.002, 0),
    new THREE.Vector3(end.x + 0.006, top, 0),
    new THREE.Vector3(start.x - 0.006, top, 0),
    new THREE.Vector3(start.x + 0.003, top - 0.002, 0),
    new THREE.Vector3(start.x + 0.002, Rb + 0.004, 0),
  ]
  const helixArc = sqrt(Rb * Rb + (lead / (2 * PI)) ** 2)
  const curve = new THREE.CatmullRomCurve3([...pts, ...tube], true, 'centripetal')
  return { curve, tube: new THREE.CatmullRomCurve3(tube.slice(1, -1), false), helixArc }
}

export function transferTube() {
  const { tube } = ballCircuit()
  return pipe(tube, 0.0046, 0.0039, 48, 16)
}

/** Rocker arm D with a slot for the peg, on rocker shaft E (axis Z through the origin). Arm points +Y. */
export function ballRocker() {
  const s = new THREE.Shape()
  s.moveTo(-0.016, 0)
  s.absarc(0, 0, 0.016, PI, 2 * PI, false)
  s.lineTo(0.013, 0.057)
  s.lineTo(-0.013, 0.057)
  s.lineTo(-0.016, 0)
  const slot = new THREE.Path()
  slot.moveTo(-0.0078, 0.028)
  slot.lineTo(-0.0078, 0.054)
  slot.lineTo(0.0078, 0.054)
  slot.lineTo(0.0078, 0.028)
  slot.lineTo(-0.0078, 0.028)
  s.holes.push(slot)
  const arm = extrude(s, 0.018, { curveSegments: 24 })
  const shaft = xform(splineShaft(18, 0.0125, 0.0115, 0.13), mat4.c(mat4.t(0, 0, 0.035), Y2Z))
  return { arm, shaft }
}

export interface DropArmSpec {
  /** pivot to ball-pin centre */
  length?: number
  /** boss radius at the pivot, end radius at the ball pin */
  bossR?: number
  endR?: number
  /** plate thickness (along Z, centred on z = 0) */
  thick?: number
  /** bore for the rocker shaft */
  holeR?: number
  /** ball-pin radius and its centre z (default: on the +Z face) */
  ballR?: number
  ballZ?: number
}

/**
 * Drop arm (Pitman arm) hanging from the rocker shaft: pivot at the origin, arm along −Y, plate in
 * XY (centred on z = 0) with the ball pin at the lower end. Defaults: the steering-box size.
 */
export function dropArm(spec: DropArmSpec = {}) {
  const L = spec.length ?? 0.13
  const rb = spec.bossR ?? 0.021
  const re = spec.endR ?? 0.013
  const t = spec.thick ?? 0.016
  const s = new THREE.Shape()
  s.absarc(0, 0, rb, 0, PI, false)
  s.lineTo(-re, -L)
  s.absarc(0, -L, re, PI, 2 * PI, false)
  s.lineTo(rb, 0)
  const hole = new THREE.Path()
  hole.absarc(0, 0, spec.holeR ?? 0.0115, 0, 2 * PI, true)
  s.holes.push(hole)
  const plate = extrude(s, t, { curveSegments: 24 })
  const ball = xform(ballJoint(spec.ballR ?? 0.011, 20), mat4.t(0, -L, spec.ballZ ?? t))
  return merge(plate, ball)
}

/** Ball joint (ball stud) of radius r, centred on the origin. */
export const ballJoint = (r = 0.022, segments = 16) => lathe(sphereProfile(r), segments)

export function sphereProfile(r: number): V2[] {
  const pts: V2[] = []
  for (let i = 0; i <= 10; i++) {
    const a = -PI / 2 + (PI * i) / 10
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return pts
}

/** Cast housing (open box with bores), centred on the screw/worm axis. */
export function boxHousing(x0: number, x1: number, y0: number, y1: number, zHalf: number, bores: { at: [number, number, number]; r: number; axis: 'x' | 'z' }[]) {
  const w = x1 - x0
  const h = y1 - y0
  const outer = xform(roundedBox(w, h, 2 * zHalf, 0.01), mat4.t((x0 + x1) / 2, (y0 + y1) / 2, 0))
  const inner = xform(roundedBox(w - 0.016, h - 0.016, 2 * zHalf - 0.016, 0.006), mat4.t((x0 + x1) / 2, (y0 + y1) / 2, 0))
  const ops = [
    { op: 'sub' as const, geometry: inner },
    ...bores.map((b) => ({ op: 'sub' as const, geometry: xform(cylinder(b.r, 0.08, 32), mat4.c(mat4.t(...b.at), b.axis === 'x' ? Y2X : Y2Z)) })),
  ]
  return csg(outer, ops)
}

/* ------------------------------ worm and peg ------------------------------ */

/** Worm-and-peg box proportions; ±30° drop-arm swing for 2 turns each way. */
export const WORM = {
  z: -0.12,
  /** rocker shaft E above the worm */
  eY: 0.075,
  /** effective peg radius (rocker shaft to the pitch line of the thread) */
  arm: 0.058,
  lead: leadForSwing('peg', 0.058, rad(30), 2),
  /** radius from E to the groove bottom (hourglass worm follows this arc) */
  rootArc: 0.063,
  depth: 0.006,
  len: 0.084,
  pegBase: 0.044,
  pegTip: 0.0615,
}

/** Drop-arm angle and peg travel for a steering-wheel angle (rad). */
export const wormBoxKinematics = (wheelRad: number) => wormPeg(wheelRad, WORM.lead, WORM.arm)

/** Worm section: land circle with a wide cam groove centred at 2D angle π/2 (peg on top). */
function wormSection(R0: number, n = 120) {
  const pts: THREE.Vector2[] = []
  const halfW = (PI * 0.0095) / WORM.lead // groove half-angle for a 9.5 mm-wide groove
  for (let i = 0; i < n; i++) {
    const a = (2 * PI * i) / n
    let d = Math.abs(Math.atan2(Math.sin(a - PI / 2), Math.cos(a - PI / 2)))
    d = Math.max(0, Math.min(1, (d - halfW + 0.25) / 0.5))
    const r = R0 - WORM.depth * (1 - d * d * (3 - 2 * d))
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

/**
 * Hourglass worm on the end of the column (axis X, centred on x = 0), whose groove bottom follows
 * the peg-tip arc about the rocker shaft; the column runs on to x = columnEnd.
 */
export function worm(columnEnd: number) {
  const R0 = WORM.eY - WORM.rootArc + WORM.depth // land radius at the centre
  const n = 48
  const stations = []
  for (let i = 0; i <= n; i++) {
    const z = -WORM.len / 2 + (WORM.len * i) / n
    const root = WORM.eY - sqrt(WORM.rootArc ** 2 - z * z)
    stations.push({ z, scale: (root + WORM.depth) / R0, twist: (-2 * PI * z) / WORM.lead })
  }
  const body = xform(loft(wormSection(R0), [], stations), Z2X)
  const shafts = merge(
    xform(cylinder(0.011, 0.03, 32), mat4.c(mat4.t(-WORM.len / 2 - 0.015, 0, 0), Y2X)),
    xform(cylinder(0.011, columnEnd - WORM.len / 2, 32), mat4.c(mat4.t((WORM.len / 2 + columnEnd) / 2, 0, 0), Y2X)),
  )
  return { body, shafts }
}

/** Rocker arm D with peg C, on rocker shaft E (axis Z through the origin); arm and peg point −Y. */
export function wormRocker() {
  const s = new THREE.Shape()
  s.absarc(0, 0, 0.017, 0, PI, false)
  s.lineTo(-0.012, -WORM.pegBase)
  s.absarc(0, -WORM.pegBase, 0.012, PI, 2 * PI, false)
  s.lineTo(0.017, 0)
  const arm = extrude(s, 0.016, { curveSegments: 24 })
  const peg = lathe(
    [
      [0, -WORM.pegTip],
      [0.0022, -WORM.pegTip],
      [0.0042, -WORM.pegBase - 0.004],
      [0.0042, -WORM.pegBase + 0.004],
      [0, -WORM.pegBase + 0.004],
    ],
    24,
  )
  const shaft = xform(splineShaft(18, 0.0125, 0.0115, 0.13), mat4.c(mat4.t(0, 0, -0.035), Y2Z))
  return { arm, peg, shaft }
}

/* ------------------------------ steering wheel ------------------------------ */

/**
 * Three-spoke steering wheel, axis X (the column's), hub at the origin: rim (torus of radius R,
 * section rimR), round spokes from 0.1·R out to the rim, hub. Defaults: the steering-box scene's.
 */
export function steeringWheel(spec: { R?: number; rimR?: number; spokeR?: number; hubR?: number; hubL?: number } = {}) {
  const R = spec.R ?? 0.1
  const rim = xform(torus(R, spec.rimR ?? 0.009, 12, 72), mat4.ry(PI / 2))
  const hub = xform(cylinder(spec.hubR ?? 0.022, spec.hubL ?? 0.03, 32), Y2X)
  const len = 0.9 * R
  const spokes = merge(...[0, 1, 2].map((k) => xform(cylinder(spec.spokeR ?? 0.0055, len, 12), mat4.c(mat4.rx(PI / 2 + (2 * PI * k) / 3), mat4.t(0, 0.1 * R + len / 2, 0)))))
  return { rim, hub, spokes }
}

/* ------------------------------ linkage ------------------------------ */

/** Link rod (drag link, track rod, tie bar) of radius r: unit length along +X from the origin (scale.x = length). */
export const linkRod = (r: number, segments = 14) => xform(cylinder(r, 1, segments), mat4.c(mat4.t(0.5, 0, 0), mat4.rz(PI / 2)))

/**
 * Steering arm or track-rod arm fixed to a stub axle: a forged bar of `length` from the kingpin
 * axis (origin) at height y, pointing at `angle` about +Y from +X (π/2 points it along −Z), with
 * the ball joint at its end. Bar section h (vertical) × w.
 */
export function knuckleArm(spec: { length: number; angle: number; y?: number; w?: number; h?: number; ballR?: number }) {
  const { length: L, angle } = spec
  const y = spec.y ?? 0
  const bar = xform(box(L, spec.h ?? 0.03, spec.w ?? 0.035), mat4.c(mat4.t(0, y, 0), mat4.ry(angle), mat4.t(L / 2, 0, 0)))
  const ball = xform(ballJoint(spec.ballR ?? 0.02, 16), mat4.t(L * Math.cos(angle), y, -L * Math.sin(angle)))
  return merge(bar, ball)
}

/** Track-rod adjuster: threaded sleeve (along X, centred) with a clamp near each end. */
export function trackRodAdjuster(spec: { r?: number; bore?: number; length?: number } = {}) {
  const L = spec.length ?? 0.16
  const sleeve = xform(tube(spec.r ?? 0.021, spec.bore ?? 0.011, L, 20), mat4.rz(PI / 2))
  const clamp = merge(...[-1, 1].map((sg) => xform(box(0.02, 0.05, 0.05), mat4.t((sg * 7 * L) / 16, 0, 0))))
  return { sleeve, clamp }
}
