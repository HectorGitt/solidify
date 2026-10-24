import * as THREE from 'three'
import { box, cylinder, extrude, extrudeTwisted, helixSpring, lathe, mat4, merge, pipe, roundedBox, roundedRect, tube, xform, type V2 } from '@/geometry'
import { torus } from '@/geometry/parts'
import { wheel, type WheelSpec } from './wheels'
import { screwFlight } from './processing'
import { sweepRings, thickSurface, plateXZ, plateXY, rod, bar, pathBar, pathRod, smooth, hash, slab, cylZ, mirrorZ, type P3 } from './construct'
/** construction helpers live in construct.ts; re-exported for the implement scenes */
export { sweepRings, thickSurface, plateXZ, plateXY, rod, bar, pathBar, pathRod, smooth, hash, slab, cylZ, mirrorZ, type P3 }

/**
 * Shared parts library — implement parts (tillage, planting, spraying, spreading, hay, harvesting,
 * root crops, land clearing and precision kit). One builder per real part; each takes a spec whose
 * defaults reproduce the scene the part came from. Every builder returns closed, outward-facing
 * solids (see the implements tests).
 *
 * Implement convention unless a builder says otherwise: +X forward (direction of travel), +Y up,
 * +Z to the left; a mounted implement is built in the hitch frame (origin at the lower hitch-ball
 * midpoint).
 */

const { PI, sqrt, cos, sin } = Math


/** Circular arc in the XY plane at z. */
class ArcXY extends THREE.Curve<THREE.Vector3> {
  R: number
  a0: number
  a1: number
  z: number
  constructor(R: number, a0: number, a1: number, z: number) {
    super()
    this.R = R
    this.a0 = a0
    this.a1 = a1
    this.z = z
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = this.a0 + (this.a1 - this.a0) * t
    return target.set(this.R * cos(a), this.R * sin(a), this.z)
  }
}

/* ================================================================================================
 * Hitch and frames
 * ============================================================================================== */

export interface HeadstockSpec {
  /** half length of the cross shaft between the lower-link pins */
  halfSpan?: number
  /** cross-shaft section */
  crossW?: number
  /** z of the two mast plates (± this) */
  plateZ?: number
  plateT?: number
}

/**
 * Plate-type headstock of a mounted tillage implement: cross shaft between the lower-link pins and
 * two mast plates up to the top-link pin (0.66 m above the cross shaft). Hitch frame: cross shaft
 * along Z through the origin, mast rising in +Y and leaning slightly back.
 */
export function headstock(s: HeadstockSpec = {}) {
  const hs = s.halfSpan ?? 0.45
  const w = s.crossW ?? 0.05
  const pz = s.plateZ ?? 0.1
  const t = s.plateT ?? 0.016
  const plate: [number, number][] = [[-0.06, -0.03], [0.05, -0.03], [0.02, 0.66], [-0.04, 0.66]]
  return {
    cross: bar([0, 0, -hs], [0, 0, hs], w, w),
    mast: merge(plateXY(plate, t, pz), plateXY(plate, t, -pz)),
  }
}

/** Headstock as one merged geometry. */
export function headstockGeometry(s: HeadstockSpec = {}) {
  const h = headstock(s)
  return merge(h.cross, h.mast)
}

export interface AFrameSpec {
  /** origin (lower-pin midpoint) */
  at?: P3
  /** half length and radius of the lower-link pin bar */
  pinHalf?: number
  pinR?: number
  /** z of the leg feet (±), and the top of the legs relative to `at` */
  footZ?: number
  topX?: number
  topY?: number
  topZ?: number
  /** leg section */
  legW?: number
  legT?: number
  /** top-link pin radius (0 = none) */
  topPinR?: number
}

/**
 * A-frame mast of a mounted machine: lower-link pin bar along Z, two legs meeting at the top-link
 * pin, and the top-link pin. Frame: origin at `at`, pins along Z.
 */
export function aFrameMast(s: AFrameSpec = {}) {
  const [x, y, z] = s.at ?? [0, 0, 0]
  const ph = s.pinHalf ?? 0.43
  const fz = s.footZ ?? 0.38
  const tx = x + (s.topX ?? 0.02)
  const ty = y + (s.topY ?? 0.61)
  const tz = s.topZ ?? 0.04
  const lw = s.legW ?? 0.06
  const lt = s.legT ?? 0.014
  const parts = [rod([x, y, z + ph], [x, y, z - ph], s.pinR ?? 0.02, 12), bar([x, y, z + fz], [tx, ty, z + tz], lw, lt), bar([x, y, z - fz], [tx, ty, z - tz], lw, lt)]
  const tp = s.topPinR ?? 0.012
  if (tp > 0) parts.push(rod([tx, ty, z + tz + 0.02], [tx, ty, z - tz - 0.02], tp, 10))
  return merge(...parts)
}

/* ================================================================================================
 * Wheels. Pneumatic wheels come from wheels.ts (wheel frame: axle along Z, outer face +Z); these
 * are the implement presets. The rim carries the hub nuts and cap.
 * ============================================================================================== */

/** Tyre + rim (with hub hardware) of a wheels.ts wheel spec. The geometries are shared (cached): do not transform them. */
export function wheelParts(spec: WheelSpec) {
  const w = wheel(spec)
  return { tyre: w.tyre, rim: w.hub ? merge(w.rim, w.hub) : w.rim }
}

/** Implement road / ground wheel (F-2 rib tyre), axle along Z, centred. */
export function roadWheel(radius: number, width: number) {
  return wheelParts({ radius, width, pattern: 'F2', rimRadius: radius * 0.58, hubR: radius * 0.18, dish: width * 0.1 })
}

/** Land / depth / press wheel with a tyre, axle along Z, centred. */
export function landWheel(radius: number, width: number, pattern: 'R1' | 'F2' | 'smooth' = 'F2') {
  return wheelParts({ radius, width, pattern, lugs: pattern === 'R1' ? 16 : 0, rimRadius: radius * 0.62, hubR: 0.05, dish: 0.02 })
}

/** Steel wheel with spokes (seed drill / planter drive wheel), axis along Z, optional cross lugs. */
export function steelWheel(radius: number, width: number, spokes = 8, lugs = 0) {
  const rimG = lathe(
    [
      [radius - 0.014, -width / 2],
      [radius, -width / 2],
      [radius, width / 2],
      [radius - 0.014, width / 2],
    ],
    64,
  )
  const hub = cylinder(0.045, width * 0.9, 20)
  const parts = [rimG, hub]
  const len = radius - 0.05
  for (let i = 0; i < spokes; i++) {
    const s = cylinder(0.009, len, 8)
    s.rotateZ(-PI / 2)
    s.translate(0.035 + len / 2, 0, 0)
    s.rotateY((i / spokes) * PI * 2)
    parts.push(s)
  }
  for (let i = 0; i < lugs; i++) {
    const l = cylinder(0.008, width * 0.85, 6)
    l.translate(radius + 0.004, 0, 0)
    l.rotateY(((i + 0.5) / lugs) * PI * 2)
    parts.push(l)
  }
  const g = merge(...parts)
  g.rotateX(PI / 2)
  return g
}

/* ================================================================================================
 * Discs and coulters
 * ============================================================================================== */

/**
 * Concave (spherical-cap) disc, axis along +Y with the CONCAVE face towards +Y. The rim sits on
 * y = 0 and the centre of the concave face at y = −c (c = concavity). Thickness t.
 */
export function concaveDisc(R: number, c: number, t: number, seg = 72, hubR = 0) {
  const rho = (R * R + c * c) / (2 * c)
  const yin = (r: number) => -(sqrt(rho * rho - r * r) - sqrt(rho * rho - R * R))
  const n = 18
  const prof: V2[] = []
  const r0 = hubR
  for (let i = 0; i <= n; i++) {
    const r = r0 + ((R - r0) * i) / n
    // back (convex) face, thinning to a sharpened edge
    const tt = t * (1 - 0.7 * Math.pow(i / n, 6))
    prof.push([r, yin(r) - tt])
  }
  for (let i = n; i >= 0; i--) {
    const r = r0 + ((R - r0) * i) / n
    prof.push([r, yin(r)])
  }
  if (r0 === 0) {
    // close on the axis
    prof[0] = [0, prof[0][1]]
    prof[prof.length - 1] = [0, prof[prof.length - 1][1]]
  }
  return lathe(prof, seg)
}

/** Depth of the concave face below the rim plane at radius r. */
export function discDish(R: number, c: number, r: number) {
  const rho = (R * R + c * c) / (2 * c)
  return sqrt(rho * rho - r * r) - sqrt(rho * rho - R * R)
}

export interface DiscGangSpec {
  n?: number
  spacing?: number
  R?: number
  concavity?: number
  t?: number
  axleR?: number
}

/** Disc-harrow gang: concave discs (concave face +Z) on an axle along Z, centred on the origin. */
export function discGang(s: DiscGangSpec = {}) {
  const n = s.n ?? 5
  const sp = s.spacing ?? 0.25
  const R = s.R ?? 0.25
  const half = ((n - 1) * sp) / 2
  const disc = concaveDisc(R, s.concavity ?? 0.035, s.t ?? 0.006, 40)
  disc.rotateX(PI / 2)
  const parts = [cylZ(0, 0, s.axleR ?? 0.02, -half - 0.075, half + 0.075, 10)]
  for (let k = 0; k < n; k++) parts.push(xform(disc, mat4.t(0, 0, -half + k * sp)))
  return merge(...parts)
}

/** Flat disc coulter (axis along Z) with a sharpened rim and a hub. */
export function coulterDisc(R: number, t = 0.006, hubR = 0.045) {
  const g = lathe(
    [
      [0.03, -t],
      [R - 0.012, -t],
      [R, 0],
      [R - 0.012, t],
      [0.03, t],
    ],
    64,
  )
  const hub = lathe([[0.012, -0.035], [hubR, -0.035], [hubR, 0.035], [0.012, 0.035]], 24)
  const m = merge(g, hub)
  m.rotateX(PI / 2)
  return m
}

/** Coulter shank: from the beam down to the hub, ending in a fork (hub and beam-end points given). */
export function coulterShank(hub: P3, top: P3) {
  const mid: P3 = [(hub[0] + top[0]) / 2 + 0.05, (hub[1] + top[1]) / 2, hub[2]]
  const arm = pathBar([top, mid, [hub[0] + 0.02, hub[1] + 0.06, hub[2]]], 0.03, 0.05, 10)
  const forkL = bar([hub[0] + 0.02, hub[1] + 0.06, hub[2] + 0.03], [hub[0], hub[1], hub[2] + 0.03], 0.012, 0.04)
  const forkR = bar([hub[0] + 0.02, hub[1] + 0.06, hub[2] - 0.03], [hub[0], hub[1], hub[2] - 0.03], 0.012, 0.04)
  const bridge = box(0.05, 0.03, 0.08)
  bridge.translate(hub[0] + 0.025, hub[1] + 0.07, hub[2])
  return merge(arm, forkL, forkR, bridge)
}

/* ================================================================================================
 * Tines, shovels, sweeps and blades
 * ============================================================================================== */

/**
 * Cultivator shovel: a curved, pointed spade. Built point-down: the tip at the origin, the blade
 * rising up and back (−X) by `length`, width `width`, curved forward across its width.
 */
export function shovel(width: number, length: number, t = 0.006, pitch = 0.5) {
  const S = (u: number, v: number) => {
    const half = (width / 2) * Math.min(1, 0.12 + u * 2.2) * (1 - 0.15 * u)
    const z = (v * 2 - 1) * half
    const along = u * length
    const curl = (-0.18 * (z * z)) / (width / 2) // edges curl forward
    return new THREE.Vector3(-along * sin(pitch) + curl, along * cos(pitch), z)
  }
  return thickSurface(S, 10, 8, t)
}

/** Duck-foot sweep: a flat V blade (top view), point forward at the origin. */
export function sweepBlade(span: number, sweepBack: number, chord: number, t = 0.006) {
  const S = (u: number, v: number) => {
    const s = u * 2 - 1
    const x = -Math.abs(s) * sweepBack - v * chord
    return new THREE.Vector3(x, v * chord * 0.25, s * (span / 2))
  }
  return thickSurface(S, 16, 3, t)
}

export interface TineSpec {
  /** frame-bar x and z the tine hangs from (the clamp is at y = 0.1) */
  x: number
  z: number
  /** furrow-floor y (working depth below the hitch) */
  floor: number
  kind?: 'rigid' | 'spring'
}

/**
 * Cultivator tine shank, clamped at (x, 0.1, z) and curving down and forward to the point at
 * (x − 0.25, floor, z). A rigid tine is a stiff curved bar; a spring tine an S-shaped flat spring.
 * Returns the shank and the point position (where the shovel or sweep bolts on).
 */
export function cultivatorTine(s: TineSpec) {
  const { x, z, floor: fl } = s
  const tip: P3 = [x - 0.25, fl, z]
  const shank =
    (s.kind ?? 'rigid') === 'rigid'
      ? pathBar([[x, 0.1, z], [x - 0.02, -0.15, z], [x - 0.1, fl + 0.12, z], tip], 0.025, 0.05, 14)
      : pathBar([[x, 0.1, z], [x + 0.08, -0.05, z], [x - 0.12, -0.2, z], [x + 0.05, fl + 0.2, z], tip], 0.012, 0.035, 20)
  return { shank, tip }
}

/**
 * Chisel-plough or subsoiler shank with its foot (point). Clamped at (x, 0.12, z); the foot sits on
 * the floor 0.32 m behind. `heavy` gives the deep subsoiler section.
 */
export function chiselShank(x: number, z: number, floor: number, heavy = false) {
  const sh = pathBar([[x, 0.12, z], [x - 0.05, -0.2, z], [x - 0.15, floor + 0.15, z], [x - 0.3, floor, z]], heavy ? 0.035 : 0.025, heavy ? 0.16 : 0.08, 16)
  const foot = box(heavy ? 0.2 : 0.1, 0.03, heavy ? 0.07 : 0.05)
  foot.translate(x - 0.32, floor + 0.015, z)
  return merge(sh, foot)
}

/**
 * Double-mouldboard ridger body: two mirrored wings behind a shovel point. Local frame: origin at
 * the front of the wings on the furrow floor; wings extend 0.4 m back (−X) and 0.28 m up.
 */
export function ridgerBody() {
  const wing = thickSurface((u, v) => new THREE.Vector3(-u * 0.4, v * 0.28, (0.03 + u * 0.16) * (0.5 + 0.7 * v)), 10, 6, 0.006)
  return merge(wing, mirrorZ(wing), xform(shovel(0.08, 0.14), mat4.t(0.04, 0, 0)))
}

/** Rotavator L-blade on a flange of radius r0: radial shank to R, then bent sideways by `bend` (along +Z). */
export function lBlade(r0: number, R: number, bend: number, w = 0.05, t = 0.008) {
  const pts: P3[] = [
    [0, -r0, 0],
    [0, -(R - 0.05), 0],
    [0.005, -(R - 0.012), bend * 0.25],
    [0.012, -(R - 0.004), bend * 0.65],
    [0.02, -R + 0.01, bend],
  ]
  return pathBar(pts, t, w, 16, [1, 0, 0])
}

export interface RotorSpec {
  width: number
  R: number
  /** blades per side per flange */
  blades: number
  flanges?: number
  flangeR?: number
}

/** Rotavator rotor: shaft along Z, flanges with L-blades bent alternately left and right. Origin on the axis. */
export function rotavatorRotor(s: RotorSpec) {
  const W = s.width
  const parts = [rod([0, 0, -W / 2], [0, 0, W / 2], 0.03, 12)]
  const fN = s.flanges ?? 8
  for (let f = 0; f < fN; f++) {
    const z = -W / 2 + 0.1 + (f * (W - 0.2)) / (fN - 1)
    parts.push(xform(rod([0, 0, -0.006], [0, 0, 0.006], s.flangeR ?? 0.09, 18), mat4.t(0, 0, z)))
    for (let b = 0; b < s.blades; b++)
      for (const side of [1, -1]) {
        const a = ((b + (side > 0 ? 0 : 0.5)) / s.blades) * PI * 2
        parts.push(xform(lBlade(0.07, s.R, 0.07 * side), mat4.c(mat4.t(0, 0, z), mat4.rz(a))))
      }
  }
  return merge(...parts)
}

/** Spike-tooth harrow tine: a square-section tapered spike pointing down (−Y) from the origin. */
export function spike(len: number, a = 0.016) {
  return lathe(
    [
      [0, -len],
      [a * 0.25, -len + 0.01],
      [a * 0.7, -0.01],
      [a * 0.7, 0.02],
      [0, 0.02],
    ],
    4,
    PI / 4,
  )
}

/**
 * Chain-harrow mat: rows of interlocking rings lying (roughly) flat on the ground, nx along X by
 * nz across. Origin at the front-centre; extends towards −X.
 */
export function chainMat(nx: number, nz: number, pitch: number, wire: number) {
  const parts: THREE.BufferGeometry[] = []
  const R = pitch * 0.42
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++) {
      const g = torus(R, wire, 6, 14)
      const up = (i + k) % 2 === 0
      g.rotateX(up ? PI / 3 : PI / 2)
      if (!up) g.rotateY(PI / 2)
      g.translate(-i * pitch * 0.8 - pitch / 2, wire + (up ? R * 0.85 : wire), (k - (nz - 1) / 2) * pitch * 0.8)
      parts.push(g)
    }
  return merge(...parts)
}

/* ================================================================================================
 * Mouldboard plough bottom
 * ============================================================================================== */

const deg = PI / 180

export type MouldboardKind = 'general' | 'stubble' | 'slatted'

export interface BoardShape {
  /** final turn of the slice, rad */
  thetaMax: number
  /** x where the turn starts and how long it takes */
  x0: number
  len: number
  /** board tail at the bottom and at the top */
  tailLow: number
  tailHigh: number
}

export const BOARDS: Record<MouldboardKind, BoardShape> = {
  // longer board, turns the slice gradually
  general: { thetaMax: 128 * deg, x0: -0.22, len: 0.78, tailLow: -0.78, tailHigh: -1.02 },
  // short, steep board, turns the slice quickly and breaks it up
  stubble: { thetaMax: 140 * deg, x0: -0.2, len: 0.55, tailLow: -0.64, tailHigh: -0.82 },
  // same shape as general purpose, built from slats so sticky soil does not cling
  slatted: { thetaMax: 128 * deg, x0: -0.22, len: 0.78, tailLow: -0.78, tailHigh: -1.02 },
}

const LIFT = Math.tan(18 * deg)
/** height of the share / board lift plane at x (the slice is lifted by the share wedge first) */
export const liftY = (x: number) => Math.min(Math.max(-x, 0), 0.26) * LIFT
/** turn of the slice at x */
export const turnAt = (s: BoardShape, x: number) => s.thetaMax * smooth((-x + s.x0) / s.len)

/** Point on the slice-supporting line at x, distance s from the wing-edge pivot (z = −w). */
function onBoard(s: BoardShape, w: number, x: number, dist: number) {
  const th = turnAt(s, x)
  return new THREE.Vector3(x, liftY(x) + dist * Math.sin(th), -w + dist * Math.cos(th))
}

export interface BottomGeo {
  share: THREE.BufferGeometry
  board: THREE.BufferGeometry
  landside: THREE.BufferGeometry
  heel: THREE.BufferGeometry
  frog: THREE.BufferGeometry
  shin: THREE.BufferGeometry
  standard: THREE.BufferGeometry
  slice: THREE.BufferGeometry
  /** curve along the top of the turning slice (for clod particles) */
  sliceCurve: THREE.CatmullRomCurve3
  /** x of the wing (end of the cutting edge) */
  wingX: number
}

/**
 * One right-hand mouldboard bottom. Local frame: x forward, y up, z left; the furrow floor is
 * y = 0, the landside face is z = 0 and the share point is at the origin. The bottom cuts the
 * strip z ∈ [−w, 0] and turns the slice over to the right (−z). Typical proportions for a
 * 300 mm (12 in) bottom.
 *
 * @param vs, hs  vertical / horizontal suction (m, as drawn): the share point is bent down by vs
 * and towards the land by hs, below and beyond the landside line.
 * @param beamY   height of the plough beam above the furrow floor (top of the standard)
 */
export function mouldboardBottom(w: number, d: number, board: MouldboardKind, vs: number, hs: number, beamY: number): BottomGeo {
  const S = BOARDS[board]
  const wingX = -1.2 * w
  const chord = 0.13

  // ---- share: cutting edge from the point (landside) back to the wing, lifting rearward ----
  const share = thickSurface(
    (u, v) => {
      const k = Math.pow(1 - u, 3)
      const ex = wingX * u
      const ez = -w * u + hs * k
      const ey = -vs * k
      const x = ex - v * chord
      return new THREE.Vector3(x, ey * (1 - v) + liftY(x) * v, ez)
    },
    12,
    3,
    0.009,
  )

  // ---- mouldboard: the slice-supporting surface, twisted from the share lift to the turn ----
  const xf = (v: number) => (wingX - chord) * (1 - v) + -0.14 * v
  const xr = (v: number) => S.tailLow + (S.tailHigh - S.tailLow) * v
  const reach = 1.1 * w
  const surf = (u: number, v: number) => {
    const x = xf(v) + (xr(v) - xf(v)) * u
    return onBoard(S, w, x, v * reach)
  }
  let boardG: THREE.BufferGeometry
  if (board === 'slatted') {
    const slats: THREE.BufferGeometry[] = []
    const n = 5
    for (let i = 0; i < n; i++) {
      const v0 = 0.04 + (i / n) * 0.96
      const v1 = v0 + (0.96 / n) * 0.62
      slats.push(thickSurface((u, v) => surf(u, v0 + (v1 - v0) * v), 22, 2, 0.008))
    }
    boardG = merge(...slats)
  } else boardG = thickSurface(surf, 26, 10, 0.008)

  // ---- landside and its detachable heel, pressing on the furrow wall (z = 0) ----
  const landside = box(0.72, 0.13, 0.014)
  landside.translate(-0.12 - 0.36, 0.065 + 0.004, -0.007)
  const heel = box(0.14, 0.1, 0.016)
  heel.translate(-0.84 - 0.07, 0.05, -0.008)

  // ---- frog: the casting that the share, mouldboard and landside bolt to ----
  const frog = plateXY(
    [
      [-0.16, 0.012],
      [-0.82, 0.012],
      [-0.82, 0.14],
      [-0.58, 0.22],
      [-0.34, 0.07],
    ],
    0.11,
    -0.015 - 0.055,
  )
  frog.translate(0, 0, -0.055)
  // shin: the leading edge of the mouldboard above the share point
  const shin = thickSurface(
    (u, v) => {
      const y = 0.02 + u * (0.28 + d * 0.2)
      const x = -0.1 - u * 0.12
      return new THREE.Vector3(x - v * 0.05, y, -0.004 - v * 0.03)
    },
    6,
    2,
    0.01,
  )

  // ---- standard (leg) from the frog up to the beam ----
  const standard = pathBar(
    [
      [-0.62, 0.17, -0.07],
      [-0.6, 0.35, -0.07],
      [-0.52, beamY - 0.12, -0.07],
      [-0.5, beamY, -0.07],
    ],
    0.03,
    0.075,
    12,
  )

  // ---- the furrow slice: a w × d strip lifted by the share and turned by the board ----
  const rings: THREE.Vector3[][] = []
  const tops: THREE.Vector3[] = []
  const xEnd = Math.min(S.tailHigh, S.tailLow) - 0.55
  for (let x = -0.04; x >= xEnd; x -= 0.03) {
    const th = turnAt(S, x) * (1 + 0.05 * smooth((S.tailLow - x) / 0.4))
    const piv = new THREE.Vector2(-w, liftY(x) * (1 - smooth((S.tailLow - x) / 0.35)))
    const dir = new THREE.Vector2(Math.cos(th), Math.sin(th))
    const nrm = new THREE.Vector2(-Math.sin(th), Math.cos(th))
    const c = [piv.clone(), piv.clone().addScaledVector(dir, w), piv.clone().addScaledVector(dir, w).addScaledVector(nrm, d), piv.clone().addScaledVector(nrm, d)]
    const minY = Math.min(...c.map((p) => p.y))
    const lift = Math.max(0, -minY) + 0.002
    rings.push(c.map((p) => new THREE.Vector3(x, p.y + lift, p.x)))
    const mid = c[1].clone().add(c[2]).multiplyScalar(0.5).lerp(c[0].clone().add(c[3]).multiplyScalar(0.5), 0.5)
    const top = c[2].clone().add(c[3]).multiplyScalar(0.5).lerp(mid, 0.3)
    if (rings.length % 3 === 1) tops.push(new THREE.Vector3(x, top.y + lift + 0.01, top.x))
  }
  const slice = sweepRings(rings, PI / 3)
  const sliceCurve = new THREE.CatmullRomCurve3(tops)

  return { share, board: boardG, landside, heel, frog, shin, standard, slice, sliceCurve, wingX }
}

/** Jointer: a miniature mouldboard skimming the top corner of the slice, on its stalk up to `stalkTopY`. */
export function jointer(stalkTopY: number) {
  return merge(plateXY([[0.06, 0], [-0.12, 0.0], [-0.14, 0.06], [0.02, 0.03]], 0.008, -0.03), bar([-0.04, 0.05, -0.02], [-0.02, stalkTopY, 0.0], 0.02, 0.025))
}

/* ================================================================================================
 * Seeding: metering, hoppers, openers
 * ============================================================================================== */

export interface FlutedRollerSpec {
  r?: number
  length?: number
  flutes?: number
}

/** Fluted metering roller, axis along Z, centred on the origin. */
export function flutedRoller(s: FlutedRollerSpec = {}) {
  const r = s.r ?? 0.03
  const L = s.length ?? 0.05
  const n = s.flutes ?? 8
  const parts = [xform(cylinder(r, L, 16), mat4.rx(PI / 2))]
  for (let k = 0; k < n; k++) {
    const f = box(0.012, 0.012, L)
    f.translate(r * Math.cos((k * 2 * PI) / n), r * Math.sin((k * 2 * PI) / n), 0)
    parts.push(f)
  }
  return merge(...parts)
}

/** Seed-box agitator: shaft along Z with a paddle at each row z (paddles phased by row). */
export function seedAgitator(halfLen: number, rows: number[]) {
  const paddle = box(0.08, 0.01, 0.02)
  return merge(rod([0, 0, -halfLen], [0, 0, halfLen], 0.008, 8), ...rows.map((z, i) => xform(paddle, mat4.c(mat4.t(0, 0, z), mat4.rz(i)))))
}

/** Horizontal cell (pocket) seed plate, axis along Y, bottom face on y = 0. */
export function cellPlate(cells: number, r = 0.1, rIn = 0.03, t = 0.012) {
  const ring = lathe([[rIn, 0], [r, 0], [r, t], [rIn, t]], 40)
  const notch = box(0.02, t + 0.002, 0.014)
  return merge(ring, ...Array.from({ length: cells }, (_, k) => xform(notch, mat4.c(mat4.ry((k * 2 * PI) / cells), mat4.t(r, t / 2, 0)))))
}

/** Planter-unit seed hopper (hollow cone on a throat), axis along Y, throat at y = 0. */
export function plantHopper() {
  return lathe([[0.06, 0], [0.16, 0.2], [0.16, 0.42], [0.145, 0.42], [0.145, 0.21], [0.05, 0.015]], 32)
}

/** Runner-type furrow opener (side-view plate from z to z + 0.02), share point forward at x = 0.1. */
export function runnerOpener() {
  return plateXY([[0.1, 0.1], [-0.15, 0.1], [-0.2, -0.0], [0.0, 0.0]], 0.02)
}

/* ================================================================================================
 * Augers, beaters, elevators
 * ============================================================================================== */

export interface FlightSpec {
  R: number
  z0: number
  z1: number
  turns: number
  /** flight sheet thickness (capped at 10 mm) */
  wire?: number
  /** inner radius of the flight (the shaft or tube) */
  rIn?: number
  x?: number
  y?: number
  segments?: number
}

/**
 * Auger flight about an axis along Z through (x, y): the library's sheet-steel helicoid (the same
 * flight as the screw conveyors), from the shaft (`rIn`, default a third of R) out to R, between
 * z0 and z1. The hand follows the sign of `turns` × (z1 − z0).
 */
export function augerFlight(s: FlightSpec) {
  const L = Math.abs(s.z1 - s.z0)
  const turns = Math.abs(s.turns)
  const g = screwFlight({ rIn: s.rIn ?? s.R / 3, rOut: s.R, pitch: L / Math.max(turns, 1e-3), L, t: s.wire ? Math.min(s.wire, 0.01) : 0.006 })
  // the flight is built along X, centred: turn it on to Z and move it into place
  let z = xform(g, mat4.ry(-PI / 2))
  if (Math.sign(s.turns) * Math.sign(s.z1 - s.z0) < 0) z = mirrorZ(z)
  return xform(z, mat4.t(s.x ?? 0, s.y ?? 0, (s.z0 + s.z1) / 2))
}

export interface AugerSpec {
  tubeR: number
  flightR: number
  z0: number
  z1: number
  turns: number
  wire?: number
  tubeSeg?: number
  /** flight inset from the tube ends */
  inset?: number
}

/** Auger: tube along Z (z0…z1) with one flight. Origin on the axis. */
export function auger(s: AugerSpec) {
  const i = s.inset ?? 0
  const dir = Math.sign(s.z1 - s.z0) || 1
  return merge(cylZ(0, 0, s.tubeR, s.z0, s.z1, s.tubeSeg ?? 16), augerFlight({ R: s.flightR, rIn: s.tubeR, z0: s.z0 + dir * i, z1: s.z1 - dir * i, turns: s.turns, wire: s.wire ?? 0.008 }))
}

/** Toothed beater (manure spreader): core along Z with rows of tooth rods. Origin on the axis. */
export function toothedBeater(r: number, len: number, rows: number, perRow: number) {
  const core = cylinder(r * 0.45, len, 24)
  core.rotateX(PI / 2)
  const teeth: THREE.BufferGeometry[] = [core]
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < perRow; j++) {
      const z = -len / 2 + ((j + 0.5) / perRow) * len
      const a = (i / rows) * 2 * PI + j * 0.6
      teeth.push(rod([r * 0.4 * Math.cos(a), r * 0.4 * Math.sin(a), z], [r * Math.cos(a), r * Math.sin(a), z], 0.012, 6))
    }
  }
  return merge(...teeth)
}

export interface BladedRotorSpec {
  r: number
  halfWidth: number
  blades: number
  hubR?: number
  shaftR?: number
  /** shaft overhang beyond the blades each side */
  shaftExtra?: number
  bladeT?: number
  seg?: number
}

/** Paddle beater, straw chopper or cleaning-fan rotor: shaft along Z with flat radial blades. Origin on the axis. */
export function bladedRotor(s: BladedRotorSpec) {
  const hw = s.halfWidth
  const ex = s.shaftExtra ?? 0.1
  const t = (s.bladeT ?? 0.016) / 2
  const parts = [cylZ(0, 0, s.shaftR ?? 0.05, -hw - ex, hw + ex, s.seg ?? 20)]
  for (let k = 0; k < s.blades; k++) parts.push(xform(slab(s.hubR ?? 0.04, -t, s.r, t, -hw, hw), mat4.rz((k / s.blades) * 2 * PI)))
  return merge(...parts)
}

/** Rod-elevator rod (one link of the endless rod chain), along Z, centred. */
export function elevatorRod(width: number, r = 0.011) {
  return cylinder(r, width, 8).rotateX(PI / 2)
}

/** Elevator agitator: elliptical rollers on a shaft along Z (they bounce the rod chain). */
export function elevatorAgitator(width: number, rollersZ: number[] = [-0.3, 0.3]) {
  return merge(...rollersZ.map((z) => lathe([[0, -0.012], [0.07, -0.012], [0.07, 0.012], [0, 0.012]], 6).rotateX(PI / 2).scale(1, 1.5, 1).translate(0, 0, z)), cylinder(0.015, width, 10).rotateX(PI / 2))
}

/** Chain-and-slat elevator slat (local: x along the chain, y outward) with its chain attachments at ±halfWidth. */
export function elevatorSlat(halfWidth: number) {
  const hw = halfWidth
  return merge(slab(-0.02, 0, 0.02, 0.035, -hw, hw), slab(-0.03, -0.01, 0.03, 0.01, hw - 0.02, hw + 0.02), slab(-0.03, -0.01, 0.03, 0.01, -hw - 0.02, -hw + 0.02))
}

export { ratchetWheel } from './elements'

export { slipClutch } from './elements'

/* ================================================================================================
 * Spreaders
 * ============================================================================================== */

/** Spinning disc with radial vanes, axis along Y, disc centred on the origin. */
export function spinnerDisc(R: number, vanes: number) {
  const parts: THREE.BufferGeometry[] = [cylinder(R, 0.008, 48), cylinder(0.03, 0.08, 16)]
  for (let k = 0; k < vanes; k++) {
    const a = (k / vanes) * 2 * PI
    const v = box(R - 0.05, 0.04, 0.008)
    v.translate((R + 0.05) / 2, 0.024, 0)
    v.rotateY(a)
    parts.push(v)
  }
  return merge(...parts)
}

/** Cone hopper (hollow, rolled top rim), axis along Y: outlet radius rOut at y0, top radius rTop at y1. */
export function coneHopper(rOut: number, rTop: number, y0: number, y1: number) {
  return lathe(
    [
      [rOut - 0.012, y0],
      [rOut, y0],
      [rTop, y1],
      [rTop + 0.03, y1],
      [rTop + 0.03, y1 + 0.03],
      [rTop - 0.014, y1 + 0.03],
      [rOut - 0.012, y0 + 0.01],
    ],
    48,
  )
}

/* ================================================================================================
 * Sprayers
 * ============================================================================================== */

/**
 * Boom nozzle (body + tip), axis along Y, the boom fitting at y = 0. The body runs −0.05…+0.03,
 * the tip hangs below it to y = −0.07.
 */
export function sprayNozzle() {
  return {
    body: lathe([[0, -0.04], [0.009, -0.04], [0.009, 0.02], [0.016, 0.02], [0.016, 0.04], [0, 0.04]], 14).translate(0, -0.01, 0),
    tip: lathe([[0, -0.07], [0.006, -0.07], [0.012, -0.055], [0.012, -0.05], [0, -0.05]], 14),
  }
}

/** Nozzles merged along a boom at the given z positions (fitting at y = 0, x = 0). */
export function nozzleRow(zs: number[]) {
  const n = sprayNozzle()
  return { bodies: merge(...zs.map((z) => xform(n.body, mat4.t(0, 0, z)))), tips: merge(...zs.map((z) => xform(n.tip, mat4.t(0, 0, z)))) }
}

/**
 * Real-size spray nozzle broken into its parts (body, strainer, gasket, whirl plate, orifice disc,
 * flat-fan tip, cap). Axis along Y; the gasket seat is at y = 0, the outlet faces −Y.
 */
export function nozzleParts() {
  const vert = (geo: THREE.BufferGeometry) => geo.rotateX(PI / 2)
  const body = lathe([[0.0062, 0], [0.011, 0], [0.011, 0.018], [0.0135, 0.018], [0.0135, 0.03], [0.009, 0.034], [0.009, 0.05], [0.0062, 0.05]], 40)
  const strainer = merge(tube(0.0058, 0.0048, 0.022, 28).translate(0, 0.016, 0), cylinder(0.0058, 0.0008, 28).translate(0, 0.0055, 0))
  const gasket = tube(0.0058, 0.0035, 0.0012, 32).translate(0, -0.0006, 0)
  // whirl plate: a swirl core with two slanted (helical) slots
  const wp: THREE.Vector2[] = []
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * 2 * PI
    const notch = Math.abs(Math.sin(a)) < 0.2 && Math.cos(a) !== 0
    const r = notch ? 0.0044 : 0.0058
    wp.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  const whirl = vert(extrudeTwisted(wp, [], 0.003, 1.1, 6)).translate(0, -0.0027, 0)
  const discShape = new THREE.Shape().absarc(0, 0, 0.0058, 0, 2 * PI, false)
  discShape.holes.push(new THREE.Path().absarc(0, 0, 0.0009, 0, 2 * PI, true))
  const disc = vert(extrude(discShape, 0.0016, { curveSegments: 32 })).translate(0, -0.0051, 0)
  const fanShape = new THREE.Shape().absarc(0, 0, 0.0058, 0, 2 * PI, false)
  const slot = roundedRect(0.0032, 0.0008, 0.0004)
  fanShape.holes.push(new THREE.Path(slot.getPoints(12).reverse()))
  const fanTip = merge(vert(extrude(fanShape, 0.0045, { curveSegments: 32 })).translate(0, -0.0035, 0), lathe([[0.0016, -0.0058], [0.0058, -0.0058], [0.0058, -0.0012], [0.0016, -0.0012]], 32).translate(0, -0.0025, 0))
  const cap = lathe([[0.0025, -0.009], [0.0145, -0.009], [0.0145, 0.016], [0.0118, 0.016], [0.0118, -0.0065], [0.0025, -0.0065]], 40)
  return { body, strainer, gasket, whirl, disc, fanTip, cap }
}

/**
 * Truss spray boom of width W: lower rail, top chord dropping towards the tips, struts and the
 * centre carriage. Frame: spray-pipe axis along Z through the origin; the truss sits 0.05 behind.
 */
export function sprayBoomFrame(W: number) {
  const half = W / 2
  const members: THREE.BufferGeometry[] = []
  const topY = (z: number) => 0.32 - 0.2 * Math.min(1, Math.max(0, (Math.abs(z) - 0.6) / Math.max(0.1, half - 0.6)))
  members.push(rod([0.05, 0.05, -half - 0.05], [0.05, 0.05, half + 0.05], 0.018, 12))
  const nSeg = Math.max(2, Math.round(W / 0.5))
  for (let i = 0; i < nSeg; i++) {
    const za = -half + (W * i) / nSeg
    const zb = -half + (W * (i + 1)) / nSeg
    members.push(rod([0.05, topY(za), za], [0.05, topY(zb), zb], 0.015, 10))
    members.push(rod([0.05, 0.05, za], [0.05, topY(za), za], 0.01, 8))
    members.push(rod([0.05, 0.05, za], [0.05, topY(zb), zb], 0.008, 8))
  }
  members.push(rod([0.05, 0.05, half], [0.05, topY(half), half], 0.01, 8))
  members.push(box(0.08, 0.36, 0.8).translate(0.1, 0.17, 0))
  return merge(...members)
}

/** Spray pipe along Z (length W) with end caps, centred. */
export function sprayPipe(W: number) {
  const half = W / 2
  return merge(rod([0, 0, -half], [0, 0, half], 0.011, 12), cylinder(0.014, 0.02, 12).rotateX(PI / 2).translate(0, 0, -half), cylinder(0.014, 0.02, 12).rotateX(PI / 2).translate(0, 0, half))
}

export interface SprayTankSpec {
  w: number
  h: number
  d: number
  /** where the filler sits on the top face, relative to the tank centre */
  fillerX?: number
  fillerZ?: number
}

/**
 * Polyethylene spray tank with its filler lid and basket strainer. Frame: tank centred on the
 * origin. `liquid` is a unit-height block (scale Y to the fill).
 */
export function sprayTank(s: SprayTankSpec) {
  const fx = s.fillerX ?? 0.15
  const fz = s.fillerZ ?? 0.2
  const top = s.h / 2
  return {
    tank: roundedBox(s.w, s.h, s.d, 0.14),
    liquid: roundedBox(s.w - 0.02, 1, s.d - 0.02, 0.06),
    filler: merge(lathe([[0.075, 0], [0.09, 0], [0.09, 0.05], [0.075, 0.05]], 28).translate(fx, top - 0.01, fz), cylinder(0.095, 0.02, 28).translate(fx, top + 0.05, fz)),
    basket: lathe([[0.06, -0.16], [0.07, -0.16], [0.075, 0], [0.065, 0], [0.055, -0.15]], 24).translate(fx, top + 0.03, fz),
  }
}

/**
 * Twin-piston sprayer pump with air chamber, built at the pump position (x, y): crankcase with two
 * vertical cylinders and the air chamber on the head. The eccentric shaft is built about its own
 * axis (along X at y = 0); piston and rod are single parts positioned by the scene.
 */
export function pistonPump(s: { x: number; y: number; bore: number }) {
  const cylX = [s.x - 0.045, s.x + 0.045]
  const cyl = (x: number) => tube(s.bore / 2 + 0.008, s.bore / 2, 0.075, 32).translate(x, s.y + 0.08, 0)
  return {
    cylX,
    crankcase: merge(roundedBox(0.2, 0.09, 0.11, 0.02).translate(s.x, s.y, 0), cyl(cylX[0]), cyl(cylX[1]), box(0.18, 0.03, 0.07).translate(s.x, s.y + 0.13, 0)),
    airChamber: lathe([[0, 0], [0.03, 0], [0.042, 0.03], [0.042, 0.08], [0.025, 0.11], [0, 0.115]], 28).translate(s.x, s.y + 0.145, 0),
    shaft: merge(rod([s.x - 0.12, 0, 0], [s.x + 0.13, 0, 0], 0.011), ...cylX.map((x) => cylinder(0.024, 0.02, 24).rotateZ(PI / 2).translate(x, 0.012, 0))),
    piston: cylinder(s.bore / 2 - 0.0005, 0.032, 28),
    conrod: bar([0, 0, 0], [0, 0.05, 0], 0.012, 0.008),
  }
}

/** Clear-bowl line strainer at (x, y, z): head with ports along X, bowl below, mesh element. */
export function lineStrainer(x: number, y: number, z: number) {
  return {
    head: merge(box(0.08, 0.035, 0.08).translate(x, y + 0.09, z), rod([x - 0.07, y + 0.09, z], [x + 0.07, y + 0.09, z], 0.013)),
    bowl: lathe([[0, 0], [0.028, 0], [0.034, 0.02], [0.034, 0.075], [0, 0.075]], 28).translate(x, y, z),
    element: tube(0.02, 0.016, 0.06, 20).translate(x, y + 0.04, z),
  }
}

/**
 * Sprayer pressure regulator (spring-loaded relief poppet) at (x, y, z), axis along Y, ports along
 * X. This is the low-pressure sprayer type with a hand knob, not the hydraulic relief valve in
 * hydraulics.ts. The spring is unit length (scale Y).
 */
export function sprayRegulator(x: number, y: number, z: number) {
  return {
    body: merge(lathe([[0.008, 0], [0.03, 0], [0.03, 0.03], [0.022, 0.04], [0.022, 0.13], [0.008, 0.13]], 32).translate(x, y, z), rod([x - 0.06, y + 0.015, z], [x + 0.06, y + 0.015, z], 0.012)),
    knob: cylinder(0.026, 0.025, 6).translate(x, y + 0.15, z),
    spring: helixSpring(0.014, 0.0025, 1, 7),
    poppet: lathe([[0, 0], [0.012, 0], [0.006, 0.018], [0.006, 0.03], [0, 0.03]], 20),
  }
}

/** Dial pressure gauge facing +Z at (x, y, z), with a stem down to stemY. Needle points +Y from its pivot. */
export function pressureGauge(x: number, y: number, z: number, stemY: number) {
  return {
    gauge: merge(cylinder(0.05, 0.03, 36).rotateX(PI / 2).translate(x, y, z + 0.03), rod([x, y - 0.05, z], [x, stemY, z], 0.006)),
    face: cylinder(0.045, 0.002, 36).rotateX(PI / 2).translate(x, y, z + 0.046),
    needle: box(0.004, 0.04, 0.002).translate(0, 0.016, 0),
  }
}

/** Section cut-off valve block with n outlets at (x, y, z); `lever` is one handle (pivot at origin). */
export function sectionValves(x: number, y: number, z: number, n = 3) {
  return {
    block: merge(box(0.06, 0.05, 0.22).translate(x, y, z - 0.02), ...Array.from({ length: n }, (_, k) => cylinder(0.012, 0.03, 12).translate(x, y + 0.04, z - 0.09 + k * 0.07))),
    lever: merge(box(0.012, 0.012, 0.07).translate(0, 0, 0.035), cylinder(0.01, 0.014, 12).translate(0, 0, 0.07)),
  }
}

/* ================================================================================================
 * Mowers and balers
 * ============================================================================================== */

export interface CutterBarSpec {
  /** z of the inner end and the outer end of the bar (either direction) */
  from: number
  to: number
  /** guard / section pitch (76.2 mm standard) */
  pitch?: number
  /** height of the ledger plates */
  y?: number
  /** add knife clips and wear plates (every 4th guard) */
  clips?: boolean
}

/**
 * Reciprocating cutter bar, fixed parts: bar, guards (fingers) pointing forward (+X), ledger
 * plates, knife clips. Frame: the bar's front edge at x ≈ 0, along Z between `from` and `to`.
 */
export function cutterBar(s: CutterBarSpec) {
  const p = s.pitch ?? 0.0762
  const y = s.y ?? 0.09
  const L = Math.abs(s.to - s.from)
  const dir = Math.sign(s.to - s.from) || -1
  const mid = (s.from + s.to) / 2
  const n = Math.round(L / p)
  const guards: THREE.BufferGeometry[] = [box(0.05, 0.02, L + 0.06).translate(-0.04, y - 0.012, mid)]
  const ledgers: THREE.BufferGeometry[] = []
  const clips: THREE.BufferGeometry[] = []
  for (let i = 0; i <= n; i++) {
    const z = s.from + dir * i * p
    guards.push(plateXZ([[-0.03, z - 0.012], [0.11, z - 0.004], [0.11, z + 0.004], [-0.03, z + 0.012]], 0.022, y - 0.004))
    ledgers.push(box(0.07, 0.004, 0.022).translate(0.035, y + 0.009, z))
    if ((s.clips ?? true) && i % 4 === 2) clips.push(box(0.05, 0.006, 0.03).translate(-0.01, y + 0.03, z), box(0.04, 0.004, 0.04).translate(-0.045, y + 0.012, z))
  }
  return { guards: merge(...guards), ledgers: merge(...ledgers), clips: clips.length ? merge(...clips) : null }
}

/** Reciprocating knife (sickle): knife back with riveted triangular sections, same frame as cutterBar. */
export function sickle(s: CutterBarSpec) {
  const p = s.pitch ?? 0.0762
  const y = s.y ?? 0.09
  const L = Math.abs(s.to - s.from)
  const dir = Math.sign(s.to - s.from) || -1
  const n = Math.round(L / p)
  const parts: THREE.BufferGeometry[] = [box(0.022, 0.008, L).translate(-0.012, y + 0.016, (s.from + s.to) / 2)]
  for (let i = 0; i < n; i++) {
    const z = s.from + dir * i * p
    parts.push(plateXZ([[-0.004, z - p / 2 + 0.003], [0.075, z - 0.006], [0.075, z + 0.006], [-0.004, z + p / 2 - 0.003]], 0.004, y + 0.018))
  }
  return merge(...parts)
}

/** Mower crank (pitman wheel): disc, crank pin at radius pinR, shaft. Axis along X, centred. */
export function pitmanWheel(pinR: number, r = 0.11) {
  return merge(cylinder(r, 0.03, 32).rotateZ(PI / 2), cylinder(0.012, 0.06, 12).rotateZ(PI / 2).translate(-0.03, pinR, 0), cylinder(0.02, 0.2, 12).rotateZ(PI / 2).translate(0.1, 0, 0))
}

/**
 * Baler pick-up: tine reel (core along Z centred on the origin, rotates) and the fixed stripper
 * bands (arcs about the same axis at z0 … z0 + width, in the frame whose z = 0 is the baler centre).
 */
export function pickupReel(s: { width: number; r: number; z0: number; tineRows?: number; perRow?: number; coreR?: number }) {
  const pw = s.width
  const rows = s.tineRows ?? 4
  const per = s.perRow ?? 9
  const c = s.coreR ?? 0.06
  const tines: THREE.BufferGeometry[] = [cylinder(c, pw, 20).rotateX(PI / 2)]
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < per; j++) {
      const a = (i / rows) * 2 * PI
      const z = -pw / 2 + ((j + 0.5) / per) * pw
      tines.push(rod([c * Math.cos(a), c * Math.sin(a), z], [s.r * Math.cos(a + 0.3), s.r * Math.sin(a + 0.3), z], 0.005, 6))
    }
  const bands: THREE.BufferGeometry[] = []
  for (let j = 0; j <= per; j++) bands.push(pipe(new ArcXY(s.r - 0.02, 0.2, PI * 1.1, s.z0 + (j / per) * pw), 0.006, 0, 12, 6))
  return { tines: merge(...tines), bands: merge(...bands) }
}

/** Baler ram (plunger) with its knife: block from x = 0 to len, h × w, centred on y and z. */
export function balerPlunger(len: number, h: number, w: number) {
  return merge(box(len, h, w).translate(len / 2, 0, 0), box(0.02, (h + 0.02) * 0.6, 0.03).translate(0.01, -(h + 0.02) * 0.18, -(w + 0.02) / 2 + 0.03))
}

/** Ram crank disc with its crank pin at radius r; axis along Z, centred. */
export function ramCrank(r: number) {
  return merge(cylinder(r + 0.06, 0.05, 36).rotateX(PI / 2), cylinder(0.03, 0.12, 12).rotateX(PI / 2).translate(r, 0, -0.06))
}

/**
 * Baler flywheel: a plain heavy disc on its input shaft, axis along X. NOT an engine flywheel —
 * it has no starter ring gear (engine flywheels come from engine.ts).
 */
export function balerFlywheel(s: { r?: number; width?: number; shaftLen?: number } = {}) {
  return merge(cylinder(s.r ?? 0.3, s.width ?? 0.07, 40).rotateZ(PI / 2), cylinder(0.025, s.shaftLen ?? 0.5, 12).rotateZ(PI / 2).translate(0.2, 0, 0))
}

/** Packer (feeder) fork: arm hanging from the origin with two tines at its foot. */
export function packerFork() {
  return merge(bar([0, 0, 0], [0, -0.5, -0.05], 0.03, 0.03), rod([0, -0.5, -0.05], [0, -0.62, 0.08], 0.01, 6), rod([0.05, -0.5, -0.05], [0.05, -0.62, 0.08], 0.01, 6))
}

/** Knotter: table on the chamber roof, twine disc and billhook frame. Origin on the roof centre. */
export function knotter() {
  return merge(box(0.5, 0.08, 0.5).translate(0, 0.04, 0), cylinder(0.12, 0.04, 20).rotateX(PI / 2).translate(0, 0.16, 0.12), box(0.12, 0.2, 0.06).translate(0.18, 0.12, -0.2))
}

/** Curved baler needle in the XY plane, hub at the origin. */
export function balerNeedle() {
  return pipe(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.12, 0), new THREE.Vector3(0.55, 0.45, 0), new THREE.Vector3(0.58, 0.75, 0)]), 0.012, 0, 24, 6)
}

/* ================================================================================================
 * Combine: header, reel, threshing, separating and cleaning
 * Side view in XY (+X forward), width along Z.
 * ============================================================================================== */

/** Header cross auger: tube along Z, opposite-hand flights feeding the centre, retractable fingers. Origin on the axis. */
export function headerAuger(s: { halfWidth: number; centreHalf: number; tubeR: number; r: number; turns?: number }) {
  const hw = s.halfWidth
  const fz = s.centreHalf
  const parts = [cylZ(0, 0, s.tubeR, -hw, hw, 28)]
  parts.push(augerFlight({ R: s.r - 0.03, z0: fz, z1: hw, turns: s.turns ?? 5.5 }))
  parts.push(augerFlight({ R: s.r - 0.03, z0: -fz, z1: -hw, turns: s.turns ?? 5.5 }))
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 2 * PI
    const z = -fz + 0.15 + (k % 3) * ((2 * fz - 0.3) / 2)
    parts.push(rod([0, 0, z], [Math.cos(a) * (s.r + 0.06), Math.sin(a) * (s.r + 0.06), z], 0.011, 8))
  }
  return merge(...parts)
}

/** Pick-up reel spiders: centre shaft along Z and three spiders of `bats` arms. Origin on the axis. */
export function reelSpider(s: { halfWidth: number; r: number; bats: number }) {
  const hw = s.halfWidth
  const parts = [cylZ(0, 0, 0.06, -hw, hw, 24)]
  for (const z of [-hw + 0.05, 0, hw - 0.05])
    for (let k = 0; k < s.bats; k++) {
      const a = (k / s.bats) * 2 * PI
      parts.push(rod([0, 0, z], [s.r * Math.cos(a), s.r * Math.sin(a), z], 0.02, 8))
    }
  return merge(...parts)
}

/** One reel bat: tube along Z with tines hanging down (−Y). */
export function reelBat(s: { halfWidth: number; tinePitch?: number; tineLen?: number }) {
  const hw = s.halfWidth
  const parts = [cylZ(0, 0, 0.025, -hw, hw, 12)]
  for (let z = -hw + 0.05; z < hw; z += s.tinePitch ?? 0.16) parts.push(rod([0, 0, z], [0.04, -(s.tineLen ?? 0.3), z], 0.006, 6))
  return merge(...parts)
}

/** Rasp-bar threshing cylinder (drum): shaft along Z, spider discs, ribbed rasp bars. Origin on the axis. */
export function threshingDrum(s: { r: number; halfWidth: number; bars: number }) {
  const hw = s.halfWidth
  const parts = [cylZ(0, 0, 0.04, -hw - 0.15, hw + 0.15, 20)]
  for (const z of [-hw + 0.02, -hw / 3, hw / 3, hw - 0.02]) parts.push(xform(tube(s.r - 0.035, 0.04, 0.02, 40), mat4.c(mat4.t(0, 0, z), mat4.rx(PI / 2))))
  for (let k = 0; k < s.bars; k++) {
    const a = (k / s.bars) * 2 * PI
    const ribs: THREE.BufferGeometry[] = [slab(-0.025, -0.022, 0.025, 0.022, -hw, hw)]
    for (let z = -hw + 0.06; z < hw - 0.03; z += 0.09) ribs.push(xform(slab(-0.006, 0.022, 0.006, 0.034, -0.04, 0.04), mat4.c(mat4.t(0, 0, z), mat4.ry(0.5 * (k % 2 ? 1 : -1)))))
    parts.push(xform(merge(...ribs), new THREE.Matrix4().makeRotationZ(a - PI / 2).setPosition((s.r - 0.035) * Math.cos(a), (s.r - 0.035) * Math.sin(a), 0)))
  }
  return merge(...parts)
}

/** Threshing concave below a drum of radius r (clearance in m): bars on an arc, side plates and wires. Origin on the drum axis. */
export function concave(s: { r: number; halfWidth: number; clearance: number }) {
  const hw = s.halfWidth + 0.01
  const R = s.r + s.clearance + 0.012
  const a0 = (-28 * PI) / 180
  const a1 = (-148 * PI) / 180
  const parts: THREE.BufferGeometry[] = []
  const n = 16
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    parts.push(xform(slab(-0.008, -0.012, 0.008, 0.012, -hw, hw), new THREE.Matrix4().makeRotationZ(a + PI / 2).setPosition(R * Math.cos(a), R * Math.sin(a), 0)))
  }
  const arc: [number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((a1 - a0) * i) / 24
    arc.push([(R - 0.015) * Math.cos(a), (R - 0.015) * Math.sin(a)])
  }
  for (let i = 24; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / 24
    arc.push([(R + 0.07) * Math.cos(a), (R + 0.07) * Math.sin(a)])
  }
  parts.push(plateXY(arc, 0.015, hw), plateXY(arc, 0.015, -hw - 0.015))
  // wires through the bars (the slots let grain and chaff fall through)
  for (let z = -hw + 0.1; z < hw; z += 0.1) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12
      pts.push(new THREE.Vector3(R * Math.cos(a), R * Math.sin(a), z))
    }
    parts.push(pipe(new THREE.CatmullRomCurve3(pts), 0.004, 0, 24, 6))
  }
  return merge(...parts)
}

/** One straw walker: a stepped (saw-tooth) trough from x0 (front) to x1 (rear) over the base line `base(x)`, centred on z = 0. */
export function strawWalker(s: { x0: number; x1: number; base: (x: number) => number; width: number; steps?: number }) {
  const pts: [number, number][] = []
  const steps = s.steps ?? 5
  const L = (s.x0 - s.x1) / steps
  pts.push([s.x0, s.base(s.x0)])
  pts.push([s.x1, s.base(s.x1)])
  for (let i = 0; i < steps; i++) {
    const xr = s.x1 + i * L
    const xf = xr + L
    pts.push([xr, s.base(xr) + 0.24])
    pts.push([xf - 0.02, s.base(xf) + 0.1])
  }
  const t = s.width - 0.02
  return plateXY(pts, t, -t / 2)
}

/** Walker crankshaft: throws of radius r at the given phases, one per walker across ±halfWidth. Origin on the axis. */
export function walkerCrank(s: { halfWidth: number; r: number; phases: readonly number[] }) {
  const hw = s.halfWidth
  const w = (2 * hw) / s.phases.length
  const parts = [cylZ(0, 0, 0.03, -hw - 0.08, -hw + 0.02, 16), cylZ(0, 0, 0.03, hw - 0.02, hw + 0.08, 16)]
  s.phases.forEach((a, k) => {
    const zc = -hw + w * (k + 0.5)
    const px = s.r * Math.cos(a)
    const py = s.r * Math.sin(a)
    parts.push(rod([px, py, zc - w / 2 + 0.01], [px, py, zc + w / 2 - 0.01], 0.022, 12))
    parts.push(bar([0, 0, zc - w / 2 + 0.005], [px * 1.3 + 1e-4, py * 1.3, zc - w / 2 + 0.005], 0.012, 0.05))
    parts.push(bar([0, 0, zc + w / 2 - 0.005], [px * 1.3 + 1e-4, py * 1.3, zc + w / 2 - 0.005], 0.012, 0.05))
  })
  return merge(...parts)
}

/** Adjustable-louvre sieve (chaffer or lower sieve) in its frame, from x1 (rear) to x0 (front) at height y. */
export function louvreSieve(s: { x0: number; x1: number; y: number; pitch: number; tilt: number; halfWidth: number }) {
  const { x0, x1, y, pitch, tilt } = s
  const hw = s.halfWidth
  const parts = [slab(x1, y - 0.04, x0, y + 0.03, hw, hw + 0.015), slab(x1, y - 0.04, x0, y + 0.03, -hw - 0.015, -hw), slab(x1 - 0.015, y - 0.04, x1, y + 0.03, -hw, hw), slab(x0, y - 0.04, x0 + 0.015, y + 0.03, -hw, hw)]
  for (let x = x1 + pitch; x < x0 - pitch / 2; x += pitch) parts.push(xform(slab(-pitch * 0.45, -0.002, pitch * 0.45, 0.002, -hw, hw), new THREE.Matrix4().makeRotationZ(tilt).setPosition(x, y, 0)))
  return merge(...parts)
}

/* ================================================================================================
 * Root-crop diggers and land clearing
 * ============================================================================================== */

/**
 * Root-crop digging blade. Groundnut: two flat shares sloping up from the tip to the elevator.
 * Cassava: a wedge with side cheeks. Frame: tip at (tipX, 0), rising to (x1, rise); width W across Z.
 */
export function diggingBlade(kind: 'groundnut' | 'cassava', s: { tipX: number; x1: number; rise: number; W: number }) {
  const hw = s.W / 2
  const { tipX, x1, rise } = s
  if (kind === 'cassava') {
    const cheek: [number, number][] = [[x1 + 0.02, 0], [x1 - 0.05, 0], [x1 - 0.05, rise + 0.1], [x1 + 0.08, rise + 0.05]]
    return merge(
      plateXZ([[tipX, 0], [x1, hw * 0.75], [x1 - 0.05, hw * 0.75], [x1 - 0.05, -hw * 0.75], [x1, -hw * 0.75]], 0.016, 0.01),
      bar([tipX, 0.0, 0], [x1, rise, 0], 0.08, 0.03),
      plateXY(cheek, 0.02, hw * 0.75),
      plateXY(cheek, 0.02, -hw * 0.75 - 0.02),
    )
  }
  return merge(...[-1, 1].map((k) => bar([tipX, 0.0, (k * hw) / 2], [x1, rise, (k * hw) / 2], hw, 0.016)))
}

export type DozerAttachment = 'straight' | 'pusher' | 'rake' | 'shear' | 'none'

/**
 * Crawler front attachment in the crawler frame (+X forward, ground at y = 0): bulldozer blade,
 * tree pusher, clearing rake, shear blade with stinger, or a front weight; with push arms.
 * Returns the blade and an optional extra piece (pusher frame or stinger).
 */
export function dozerBlade(a: DozerAttachment, W = 3.2): { blade: THREE.BufferGeometry; extra: THREE.BufferGeometry | null } {
  const arms = [1, -1].flatMap((s) => [bar([-0.2, 0.42, s * 1.0], [1.95, 0.45, s * 1.1], 0.12, 0.12), rod([0.8, 1.6, s * 0.5], [1.85, 1.0, s * 0.6], 0.06, 12)])
  if (a === 'none') return { blade: merge(box(0.3, 0.3, 0.3).translate(1.75, 0.6, 0)), extra: null }
  if (a === 'shear') {
    // V-plan blade, angled; stinger on the leading point splits the tree
    const pts: [number, number][] = [[0, 0], [0.1, 0], [0.1, 0.9], [0, 0.9]]
    const half = (s: number) => {
      const g = extrude(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), W / 2 + 0.2)
      g.rotateY(s * (PI / 2 - 0.55))
      return g.translate(2.6, 0.05, 0)
    }
    const stinger = merge(lathe([[0, 0], [0.12, 0.05], [0.04, 0.9], [0, 0.95]], 6).rotateZ(-PI / 2).translate(2.6, 0.35, 0))
    return { blade: merge(half(1), half(-1), box(0.6, 0.06, 0.4).translate(2.4, 0.05, 0), ...arms), extra: stinger }
  }
  // curved mouldboard blade
  const prof: [number, number][] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    prof.push([2.1 - 0.25 * Math.sin(t * PI * 0.9), 0.05 + 1.15 * t])
  }
  for (let i = 10; i >= 0; i--) prof.push([prof[i][0] - 0.06, prof[i][1]])
  const mould = plateXY(prof, a === 'rake' ? 0.05 : W, 0).translate(0, 0, a === 'rake' ? 0 : -W / 2)
  if (a === 'rake') {
    // slatted rake: vertical curved teeth, soil falls through
    const teeth: THREE.BufferGeometry[] = []
    for (let z = -W / 2; z <= W / 2 + 1e-6; z += 0.27) teeth.push(plateXY(prof.map(([x, y]) => [x + 0.1, y] as [number, number]), 0.05, z - 0.025), plateXY([[2.15, 0.05], [2.45, -0.1], [2.15, 0.15]], 0.05, z - 0.025))
    return { blade: merge(...teeth, box(0.08, 0.1, W + 0.1).translate(1.95, 0.75, 0), box(0.08, 0.1, W + 0.1).translate(1.92, 1.15, 0), ...arms), extra: null }
  }
  const blade = merge(mould, ...arms)
  if (a === 'pusher') {
    const tines: THREE.BufferGeometry[] = []
    for (let z = -W / 2 + 0.1; z <= W / 2; z += 0.4) tines.push(plateXY([[2.05, 0.08], [2.45, -0.05], [2.05, 0.3]], 0.06, z - 0.03))
    const pusher = merge(bar([1.9, 1.2, 0.9], [2.6, 3.4, 0.4], 0.12, 0.12), bar([1.9, 1.2, -0.9], [2.6, 3.4, -0.4], 0.12, 0.12), bar([2.6, 3.4, 0.9], [2.6, 3.4, -0.9], 0.14, 0.14), bar([0.9, 1.9, 0], [2.5, 3.3, 0], 0.1, 0.1))
    return { blade: merge(blade, ...tines), extra: pusher }
  }
  return { blade, extra: null }
}

/** Root plough: frame, two standards and the undercutting V-blade with lifting fins. Frame: drawbar at the origin, working rearward (−X). */
export function rootPlough() {
  const frame = merge(bar([0, 0.6, 0], [-1.6, 0.9, 0], 0.14, 0.14), bar([-1.6, 0.9, 1.3], [-1.6, 0.9, -1.3], 0.14, 0.14), ...[1, -1].map((s) => bar([-0.2, 0.6, 0], [-1.6, 0.9, s * 1.2], 0.1, 0.1)))
  const standards = merge(...[1, -1].map((s) => plateXY([[-1.45, 0.85], [-1.75, 0.85], [-1.9, -0.4], [-1.6, -0.4]], 0.05, s * 1.0 - 0.025)))
  const blade = merge(...[1, -1].map((s) => bar([-1.6, -0.4, 0], [-2.2, -0.36, s * 1.4], 0.25, 0.03)), ...[-0.9, -0.3, 0.3, 0.9].map((z) => plateXY([[-1.85, -0.38], [-2.0, -0.38], [-2.05, -0.25]], 0.02, z)))
  return { frame, standards, blade }
}

export { anchorLink } from './elements'

/* ================================================================================================
 * Precision farming kit
 * ============================================================================================== */

/** GNSS receiver antenna: dome on a short mast; dome base at y = 0, mast below to y = −0.12. */
export function gnssAntenna() {
  return { dome: lathe([[0, 0], [0.11, 0], [0.11, 0.03], [0.08, 0.07], [0, 0.085]], 32), mast: xform(cylinder(0.02, 0.12, 12), mat4.t(0, -0.06, 0)) }
}

/** RTK base station: tripod with antenna mast, radio box and whip aerial. Ground at y = 0. */
export function gnssBaseStation() {
  const legs: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) {
    const a = (2 * PI * i) / 3
    legs.push(rod([0.55 * Math.cos(a), 0, 0.55 * Math.sin(a)], [0, 1.6, 0], 0.02, 8))
  }
  return { tripod: merge(...legs, xform(cylinder(0.025, 0.4, 10), mat4.t(0, 1.8, 0))), radio: xform(box(0.25, 0.3, 0.12), mat4.t(0.3, 1.0, 0)), whip: xform(cylinder(0.008, 1.0, 6), mat4.t(0.36, 1.65, 0)) }
}
