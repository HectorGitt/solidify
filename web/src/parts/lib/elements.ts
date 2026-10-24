import * as THREE from 'three'
import { box, cylinder, extrude, extrudeTwisted, finalize, helixSpring, lathe, mat4, merge, tube, xform, type V2 } from '@/geometry'
import { hexBolt, sprocket } from '@/geometry/parts'
import { meshPhase as gearMeshPhase } from './shapes'

/**
 * Shared parts library — general machine elements: rolling and plain bearings, bushes, belts and
 * pulleys (with the belt-loop path and sweep), roller chains and sprockets, leaf springs, fillet
 * welds, clutch plates and brake drums/shoes/bands, and small fasteners (nut, key, circlip, pin).
 * Gears live in `shapes.ts` (spur, helical, internal) and `@/geometry` / `@/geometry/parts`
 * (`gear`, `bevelGear`); coil springs are `helixSpring` / `coilZ`. Worker-safe, no CSG. Each
 * builder documents its local frame. (Moved here from the machine-elements scenes, which use it.)
 */

const { PI, cos, sin, tan, acos, asin, atan2, hypot } = Math
const TAU = 2 * PI
const MM = 0.001
/** lathe solids are built about Y; this turns them about Z */
const Y2Z = mat4.rx(PI / 2)
const toZ = (g: THREE.BufferGeometry) => xform(g, Y2Z)

/* ================================ rolling bearings ================================ */

export type BearingType = 'ball' | 'roller' | 'taper' | 'needle' | 'thrust' | 'journal'

const mmPts = (pts: V2[]): V2[] => pts.map(([r, y]) => [r * MM, y * MM])
const mmRing = (pts: V2[], seg = 72) => lathe(mmPts(pts), seg)
const mmBand = (r0: number, r1: number, y0: number, y1: number, seg = 72) =>
  mmRing(
    [
      [r0, y0],
      [r1, y0],
      [r1, y1],
      [r0, y1],
    ],
    seg,
  )

/** Arc points (r, y) about centre (cr, cy) from angle a0 to a1 (radians, r = cr + R cos a, y = cy + R sin a). */
function arc(cr: number, cy: number, R: number, a0: number, a1: number, n = 12): V2[] {
  const out: V2[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cr + R * cos(a), cy + R * sin(a)])
  }
  return out
}

/** Cage: two thin rings at ±yRing joined by a bridge between each pair of elements (mm, Y axis). */
function cage(rIn: number, rOut: number, yRing: number, t: number, Z: number, bridge: [number, number]) {
  const parts = [mmBand(rIn, rOut, yRing, yRing + t, 64), mmBand(rIn, rOut, -yRing - t, -yRing, 64)]
  for (let i = 0; i < Z; i++) {
    const a = ((i + 0.5) * 2 * PI) / Z
    parts.push(xform(box(bridge[0] * MM, 2 * yRing * MM, bridge[1] * MM), mat4.c(mat4.ry(-a), mat4.t(((rIn + rOut) / 2) * MM, 0, 0))))
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

/*
 * The reference bearings are a 40 mm bore × 80 mm OD series (needle: 40 × 62). All are built in a
 * Y-axis frame centred on the bearing's mid-plane (turn by rx(π/2) for a shaft along Z). Rolling
 * elements are placed with `placements` (one matrix per ball / roller at cage angle 0).
 */

/** Deep-groove ball bearing, 9 balls. */
export function ballBearing(): BearingGeometry {
  const rg = 6.25
  const t0 = acos(4.5 / rg)
  const inner = mmRing([[20, -9], [25.5, -9], ...arc(30, 0, rg, PI + t0, PI - t0), [25.5, 9], [20, 9]])
  const outer = mmRing([[34.5, -9], [40, -9], [40, 9], [34.5, 9], ...arc(30, 0, rg, t0, -t0)])
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

/** Cylindrical roller bearing (NU type: guide ribs on the outer ring), 14 rollers. */
export function rollerBearing(): BearingGeometry {
  return {
    inner: mmBand(20, 24.5, -9, 9),
    outer: mmRing([
      [33, -9],
      [40, -9],
      [40, 9],
      [33, 9],
      [33, 5.7],
      [35.5, 5.7],
      [35.5, -5.7],
      [33, -5.7],
    ]),
    cage: cage(26.5, 32.8, 5.6, 0.9, 14, [4, 1.6]),
    element: cylinder(5.5 * MM, 11 * MM, 28),
    placements: around(14, 30, 0),
    seat: 40,
    width: 18,
    innerName: 'Inner ring (plain raceway)',
    outerName: 'Outer ring with guide ribs',
  }
}

/** Taper roller bearing: cone, cup and 16 tapered rollers whose apexes meet on the axis. */
export function taperBearing(): BearingGeometry {
  const delta = (13 * PI) / 180
  const eps = (2 * PI) / 180
  const ya = 30 / tan(delta)
  const Lap = 30 / sin(delta)
  const rc = (y: number) => (ya - y) * tan(delta + eps)
  const ri = (y: number) => (ya - y) * tan(delta - eps)
  const rr = (s: number) => (Lap - s) * tan(eps)
  const half = 9.9
  const element = lathe(
    mmPts([
      [0, -7.5],
      [rr(-7.5), -7.5],
      [rr(7.5), 7.5],
      [0, 7.5],
    ]),
    24,
  )
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-30, ya, 0).normalize())
  return {
    inner: mmRing([
      [20, -half],
      [29, -half],
      [29, -7.8],
      [ri(-7.8), -7.8],
      [ri(8.5), 8.5],
      [20, 8.5],
    ]),
    outer: mmRing([
      [rc(-half), -half],
      [40, -half],
      [40, half],
      [rc(half), half],
    ]),
    element,
    placements: around(16, 30, 0, tilt),
    seat: 40,
    width: 2 * half,
    innerName: 'Cone (inner ring with ribs)',
    outerName: 'Cup (outer ring)',
  }
}

/** Needle roller bearing (machined, with inner ring), 46 needles. */
export function needleBearing(): BearingGeometry {
  return {
    inner: mmBand(20, 24, -11, 11),
    outer: mmRing([
      [26, -11],
      [31, -11],
      [31, 11],
      [26, 11],
      [26, 9.6],
      [27, 9.6],
      [27, -9.6],
      [26, -9.6],
    ]),
    element: cylinder(1.5 * MM, 18 * MM, 12),
    placements: around(46, 25.5, 0),
    seat: 31,
    width: 22,
    innerName: 'Inner ring',
    outerName: 'Outer ring (machined, with ribs)',
  }
}

/** Single-direction thrust ball bearing: shaft washer on top (+Y), housing washer below, 13 balls. */
export function thrustBearing(): BearingGeometry {
  const R = 5.75
  const a0 = asin(2.5 / R)
  const shaftWasher = mmRing([[20, 2.5], ...arc(27, 0, R, PI - a0, a0), [33.5, 2.5], [33.5, 9.5], [20, 9.5]])
  const housingWasher = mmRing([[21, -9.5], [34, -9.5], [34, -2.5], ...arc(27, 0, R, -a0, -PI + a0), [21, -2.5]])
  const cg = merge(
    mmBand(20.6, 21.3, -1.5, 1.5, 64),
    mmBand(32.7, 33.3, -1.5, 1.5, 64),
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

/** Journal: bronze bush with an exaggerated clearance so the wedge-shaped oil film shows (mm). */
export const JOURNAL = { clearance: 2, ecc: 1.4, attitude: (-35 * PI) / 180 }

/** Plain journal bearing: bronze bush (Y axis, 30 mm long) and the eccentric oil film round a Ø40 journal. */
export function journalBearing(): BearingGeometry {
  const bush = plainBush({ rIn: (20 + JOURNAL.clearance) * MM, rOut: 26 * MM, length: 30 * MM, axis: 'y' })
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

/** Any of the reference bearings by type. */
export function bearing(type: BearingType): BearingGeometry {
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

/**
 * Cut-away bearing housing ring (Y-axis frame, like the bearing) and a saddle pedestal (world
 * frame: axis Z, base at `bottom`), with a Ø40 shaft. Sized from the bearing's seat and width.
 */
export function bearingHousing(type: BearingType) {
  const g = bearing(type)
  const rs = g.seat
  const R = rs + 12
  const hw = g.width / 2 + 4
  const housing =
    type === 'thrust'
      ? mmRing([
          [21.5, -hw],
          [R, -hw],
          [R, hw - 13.5],
          [rs, hw - 13.5],
          [rs, -9.5],
          [21.5, -9.5],
        ])
      : mmBand(rs, R, -hw, hw)
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

/**
 * Plummer (pillow) block: cast housing with a base and bolt bosses, and its bearing insert, round a
 * shaft through the origin along X or Z. `drop` is the distance from the shaft axis down to the base.
 */
export function plummerBlock(s: { bore: number; drop: number; axis?: 'x' | 'z' }) {
  const { bore, drop } = s
  const ro = bore + 0.022
  const w = 0.05
  const foot = 0.014
  const prof = new THREE.Shape()
  prof.moveTo(-ro, -drop + foot)
  prof.lineTo(ro, -drop + foot)
  prof.absarc(0, 0, ro, 0, PI, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, bore + 0.006, 0, 2 * PI, true)
  prof.holes.push(hole)
  // the profile is extruded along Z (centred); turned for an X shaft
  const turn = s.axis === 'x' ? mat4.ry(PI / 2) : mat4.t(0, 0, 0)
  const body = xform(extrude(prof, w, { curveSegments: 40 }), turn)
  const base = xform(box(2 * ro + 0.09, foot, w + 0.02), mat4.c(turn, mat4.t(0, -drop + foot / 2, 0)))
  const insert = xform(tube(bore + 0.006, bore, w * 0.8, 40), s.axis === 'x' ? mat4.rz(PI / 2) : mat4.rx(PI / 2))
  return { housing: merge(body, base), insert }
}

/** Plummer block on a Z shaft, housing and insert in one geometry (belts and chains scenes). */
export function pillowBlock(boreR: number, h: number) {
  const p = plummerBlock({ bore: boreR, drop: h, axis: 'z' })
  return merge(p.housing, p.insert)
}

/* ================================ plain bearings, bushes, fasteners ================================ */

/**
 * Plain bush (sleeve bearing), optionally flanged. Axis Z (default) or Y, centred on the origin;
 * the flange, if any, is at the − end.
 */
export function plainBush(s: { rIn: number; rOut: number; length: number; flangeR?: number; flangeT?: number; axis?: 'y' | 'z'; segments?: number }) {
  const h = s.length / 2
  const ft = s.flangeT ?? 0.1 * s.length
  const pts: V2[] = s.flangeR
    ? [
        [s.rIn, -h],
        [s.flangeR, -h],
        [s.flangeR, -h + ft],
        [s.rOut, -h + ft],
        [s.rOut, h],
        [s.rIn, h],
      ]
    : [
        [s.rIn, -h],
        [s.rOut, -h],
        [s.rOut, h],
        [s.rIn, h],
      ]
  const g = lathe(pts, s.segments ?? 72)
  return s.axis === 'y' ? g : toZ(g)
}

/** Solid shaft along Z from z0 to z1. */
export const shaftAlongZ = (r: number, z0: number, z1: number, segments = 24) => xform(cylinder(r, z1 - z0, segments), mat4.c(mat4.t(0, 0, (z0 + z1) / 2), Y2Z))

/** Plain pin (clevis or pivot pin) along Z, centred on the origin. */
export const pin = (r: number, len: number, segments = 20) => xform(cylinder(r, len, segments), Y2Z)

/** Parallel (feather) key in a keyway on top (+Y) of a bore of radius boreR; length along Z, centred. */
export function parallelKey(boreR: number, len: number, b = boreR * 0.5, h = boreR * 0.5) {
  return xform(box(b, h, len), mat4.t(0, boreR + h * 0.1, 0))
}

/** Hexagon nut for thread diameter d (across flats 1.5d, height 0.8d). Axis Y, from y = 0 up. */
export function hexNut(d: number) {
  const R = (0.75 * d) / cos(PI / 6)
  const outer = Array.from({ length: 6 }, (_, i) => new THREE.Vector2(R * cos((i * PI) / 3 + PI / 6), R * sin((i * PI) / 3 + PI / 6)))
  const hole = Array.from({ length: 24 }, (_, i) => new THREE.Vector2((d / 2) * cos((-2 * PI * i) / 24), (d / 2) * sin((-2 * PI * i) / 24)))
  const h = 0.8 * d
  return xform(extrudeTwisted(outer, [hole], h), mat4.c(mat4.t(0, h / 2, 0), mat4.rx(-PI / 2)))
}

/** Hexagon bolt (head and shank): the primitive layer's `hexBolt`, re-exported so it is found here. */
export { hexBolt }

/** External circlip (retaining ring) for a shaft of radius rShaft, gap at −Y, in XY, thickness t along Z (centred). */
export function circlip(rShaft: number, t = Math.max(0.001, rShaft * 0.08)) {
  const ri = rShaft * 0.92
  const w = rShaft * 0.18
  const gap = 0.5
  const s = new THREE.Shape()
  s.absarc(0, 0, ri + w, -PI / 2 + gap / 2, (3 * PI) / 2 - gap / 2, false)
  s.absarc(0, 0, ri, (3 * PI) / 2 - gap / 2, -PI / 2 + gap / 2, true)
  // lugs with holes for the pliers
  const lug = (sg: number) => {
    const a = -PI / 2 + sg * (gap / 2 + 0.18)
    const cx = (ri + w * 1.6) * cos(a)
    const cy = (ri + w * 1.6) * sin(a)
    const p = new THREE.Shape()
    p.absarc(cx, cy, w * 0.9, 0, 2 * PI, false)
    const hole = new THREE.Path()
    hole.absarc(cx, cy, w * 0.35, 0, 2 * PI, true)
    p.holes.push(hole)
    return p
  }
  return merge(extrude(s, t, { curveSegments: 48 }), extrude(lug(1), t), extrude(lug(-1), t))
}

/* ================================ belts and pulleys ================================ */

/*
 * A belt (or chain pitch line) wrapped round any number of pulleys, in the XY plane.
 *
 * Each pulley has a sense s: +1 when the belt runs round it counter-clockwise with the pulley
 * inside the loop (driver, driven pulleys), −1 when the belt runs clockwise round it (the other
 * pulley of a crossed belt, or a back-side idler). The common tangent from pulley i to pulley j
 * satisfies left(t)·(c_j − c_i) = ρ_j − ρ_i with signed radii ρ = s·r, which gives the external
 * (open belt) and internal (crossed belt) tangents in one formula.
 *
 * Prefer this to `loopPath` in src/geometry/parts.ts, which places its tangent points at the
 * mirror angle (±(90° + β) instead of ±(90° − β)), so its spans are not tangent.
 */

export interface Pulley {
  c: [number, number]
  r: number
  /** +1 belt runs CCW round it (pulley inside the loop), −1 CW */
  s: 1 | -1
}

export interface LoopSeg {
  kind: 'arc' | 'line'
  /** arc length at the start / end of the segment */
  s0: number
  s1: number
  /** arcs: pulley index, start angle, signed sweep (rad) */
  pulley?: number
  a0?: number
  sweep?: number
  /** lines: end points, index of the pulley the span leaves and arrives at */
  p0?: [number, number]
  p1?: [number, number]
  from?: number
  to?: number
  /** ±1: lines that should bow out of plane (crossed spans) */
  bow?: number
}

export interface BeltLoop {
  pulleys: Pulley[]
  segs: LoopSeg[]
  length: number
  /** angle of wrap on each pulley (rad) */
  wraps: number[]
  pointAt: (s: number, target?: THREE.Vector3) => THREE.Vector3
  tangentAt: (s: number, target?: THREE.Vector3) => THREE.Vector3
  /** segment index at arc length s */
  segAt: (s: number) => number
}

const wrapS = (s: number, L: number) => ((s % L) + L) % L

/**
 * Build the loop. The belt runs in the order of `pulleys` (pulley 0 → 1 → 2 → … → 0) and the
 * path starts at the point where it arrives on pulley 0. `bow` lifts crossing spans out of the
 * plane by ±bow (m) so a crossed belt's spans pass each other.
 */
export function beltLoop(pulleys: Pulley[], bow = 0): BeltLoop {
  const n = pulleys.length
  // tangent from i to j: angle ψ of left(t)
  const psi: number[] = []
  for (let i = 0; i < n; i++) {
    const a = pulleys[i]
    const b = pulleys[(i + 1) % n]
    const dx = b.c[0] - a.c[0]
    const dy = b.c[1] - a.c[1]
    const L = hypot(dx, dy)
    const phi = atan2(dy, dx)
    const k = Math.max(-1, Math.min(1, (b.s * b.r - a.s * a.r) / L))
    psi.push(phi + acos(k))
  }
  // contact point on pulley p for a tangent whose left normal is at angle ψ: P = c − ρ·(cos ψ, sin ψ)
  const contactAngle = (p: Pulley, ps: number) => (p.s > 0 ? ps + PI : ps)
  const pt = (p: Pulley, a: number): [number, number] => [p.c[0] + p.r * cos(a), p.c[1] + p.r * sin(a)]
  const segs: LoopSeg[] = []
  const wraps: number[] = []
  let s = 0
  for (let j = 0; j < n; j++) {
    const p = pulleys[j]
    const aIn = contactAngle(p, psi[(j - 1 + n) % n])
    const aOut = contactAngle(p, psi[j])
    let span = (p.s * (aOut - aIn)) % TAU
    if (span < 0) span += TAU
    wraps.push(span)
    const len = span * p.r
    segs.push({ kind: 'arc', s0: s, s1: s + len, pulley: j, a0: aIn, sweep: p.s * span })
    s += len
    const q = pulleys[(j + 1) % n]
    const p0 = pt(p, aOut)
    const p1 = pt(q, contactAngle(q, psi[j]))
    const ll = hypot(p1[0] - p0[0], p1[1] - p0[1])
    const crossing = p.s !== q.s
    segs.push({ kind: 'line', s0: s, s1: s + ll, p0, p1, from: j, to: (j + 1) % n, bow: crossing ? (j === 0 ? bow : -bow) : 0 })
    s += ll
  }
  const length = s
  const segAt = (x: number) => {
    const u = wrapS(x, length)
    for (let i = 0; i < segs.length; i++) if (u < segs[i].s1) return i
    return segs.length - 1
  }
  const pointAt = (x: number, target = new THREE.Vector3()) => {
    const u = wrapS(x, length)
    const g = segs[segAt(u)]
    const f = u - g.s0
    if (g.kind === 'arc') {
      const p = pulleys[g.pulley!]
      const a = g.a0! + (Math.sign(g.sweep!) * f) / p.r
      return target.set(p.c[0] + p.r * cos(a), p.c[1] + p.r * sin(a), 0)
    }
    const t = f / (g.s1 - g.s0)
    return target.set(g.p0![0] + (g.p1![0] - g.p0![0]) * t, g.p0![1] + (g.p1![1] - g.p0![1]) * t, (g.bow ?? 0) * sin(PI * t))
  }
  const tangentAt = (x: number, target = new THREE.Vector3()) => {
    const u = wrapS(x, length)
    const g = segs[segAt(u)]
    const f = u - g.s0
    if (g.kind === 'arc') {
      const p = pulleys[g.pulley!]
      const sg = Math.sign(g.sweep!)
      const a = g.a0! + (sg * f) / p.r
      return target.set(-sin(a) * sg, cos(a) * sg, 0)
    }
    const len = g.s1 - g.s0
    const t = f / len
    return target.set((g.p1![0] - g.p0![0]) / len, (g.p1![1] - g.p0![1]) / len, ((g.bow ?? 0) * PI * cos(PI * t)) / len).normalize()
  }
  return { pulleys, segs, length, wraps, pointAt, tangentAt, segAt }
}

/** Open belt: pulley 0 at c1 (radius r1), pulley 1 at c2. */
export const openLoop = (c1: [number, number], r1: number, c2: [number, number], r2: number) =>
  beltLoop([
    { c: c1, r: r1, s: 1 },
    { c: c2, r: r2, s: 1 },
  ])

/** Crossed belt: pulley 1 turns the other way. */
export const crossedLoop = (c1: [number, number], r1: number, c2: [number, number], r2: number, bow = 0) =>
  beltLoop(
    [
      { c: c1, r: r1, s: 1 },
      { c: c2, r: r2, s: -1 },
    ],
    bow,
  )

/**
 * Sweep a closed cross-section round the loop. The section is given in (outward, z) coordinates
 * — outward is away from the pulley the belt wraps (the left-hand normal of travel, sign-adjusted).
 * The loop is closed, so the result is a closed solid with no end caps.
 */
export function sweepLoop(loop: BeltLoop, section: V2[], samples = 360, twistAngle: (s: number) => number = () => 0) {
  const n = samples
  const m = section.length
  const pos: number[] = []
  const rings: THREE.Vector3[][] = []
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  const z = new THREE.Vector3(0, 0, 1)
  for (let i = 0; i < n; i++) {
    const s = (loop.length * i) / n
    loop.pointAt(s, p)
    loop.tangentAt(s, t)
    // in-plane normal pointing to the right of travel (away from a CCW pulley's centre)
    const nrm = new THREE.Vector3(t.y, -t.x, 0).normalize()
    const bz = z.clone().sub(t.clone().multiplyScalar(t.dot(z))).normalize()
    const phi = twistAngle(s)
    const nx = nrm.clone().multiplyScalar(Math.cos(phi)).addScaledVector(bz, Math.sin(phi))
    const nz = bz.clone().multiplyScalar(Math.cos(phi)).addScaledVector(nrm, -Math.sin(phi))
    rings.push(section.map(([u, w]) => p.clone().addScaledVector(nx, u).addScaledVector(nz, w)))
  }
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  for (let i = 0; i < n; i++) {
    const A = rings[i]
    const B = rings[(i + 1) % n]
    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m
      tri(A[k], B[k], B[k1])
      tri(A[k], B[k1], A[k1])
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // make it outward-facing whatever the loop and section orientation
  if (signedVolume(g) < 0) flip(g)
  return finalize(g, PI / 6)
}

export function signedVolume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  let v = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

function flip(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i += 3) {
    const x = p.getX(i + 1)
    const y = p.getY(i + 1)
    const z = p.getZ(i + 1)
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2))
    p.setXYZ(i + 2, x, y, z)
  }
  p.needsUpdate = true
}

/** Rectangle section (flat belt) of width w (along z) and thickness t, inner face on the pitch line. */
export const flatSection = (w: number, t: number): V2[] => [
  [0, -w / 2],
  [t, -w / 2],
  [t, w / 2],
  [0, w / 2],
]

/**
 * Trapezoidal V-belt section: top width `top`, depth `h`, included angle θ (rad). The pitch line
 * sits at `pitchFromTop` below the top face; the section is placed so u = 0 is the pitch line.
 */
export function vSection(top: number, h: number, theta: number, pitchFromTop: number): V2[] {
  const bottom = top - 2 * h * Math.tan(theta / 2)
  const u1 = pitchFromTop
  const u0 = pitchFromTop - h
  return [
    [u0, -bottom / 2],
    [u1, -top / 2],
    [u1, top / 2],
    [u0, bottom / 2],
  ]
}

/**
 * Static mesh phase of gear 2 (z2 teeth) at angle γ from gear 1 (z1 teeth, tooth 0 at angle 0):
 * φ0 = γ(1 + z1/z2) + π − π/z2, i.e. shapes.meshPhase with φ_A = 0, one tooth pitch back.
 */
export const loopMeshPhase = (gamma: number, z1: number, z2: number) => gearMeshPhase(z1, 0, z2, gamma) - (2 * PI) / z2

const HUB_L = 0.07

/** Crowned flat-belt pulley: rim, hub, and arms (R > 0.14 m) or a web (smaller). Axis along Z, centred on z = 0. */
export function flatPulley(R: number, W: number, bore = 0.02) {
  const rimT = Math.max(0.006, R * 0.06)
  const crown = Math.min(0.003, R * 0.01)
  const hubR = Math.max(bore * 2, R * 0.22)
  const rim = lathe(
    [
      [R - rimT, -W / 2],
      [R, -W / 2],
      [R + crown, 0],
      [R, W / 2],
      [R - rimT, W / 2],
    ],
    96,
  )
  const hub = lathe(
    [
      [bore, -HUB_L / 2],
      [hubR, -HUB_L / 2],
      [hubR, HUB_L / 2],
      [bore, HUB_L / 2],
    ],
    40,
  )
  const parts = [toZ(rim), toZ(hub)]
  if (R > 0.14) {
    // six arms, elliptical in practice — drawn as tapered boxes
    const len = R - rimT - hubR + 0.004
    for (let i = 0; i < 6; i++) {
      const a = (i * PI) / 3
      parts.push(xform(box(len, Math.max(0.014, R * 0.09), Math.min(W * 0.45, 0.05)), mat4.c(mat4.rz(a), mat4.t(hubR + len / 2 - 0.002, 0, 0))))
    }
  } else {
    const web = lathe(
      [
        [hubR - 0.001, -W * 0.15],
        [R - rimT + 0.001, -W * 0.15],
        [R - rimT + 0.001, W * 0.15],
        [hubR - 0.001, W * 0.15],
      ],
      64,
    )
    parts.push(toZ(web))
  }
  return merge(...parts)
}

/** V-belt section dimensions (m): top width, depth, groove spacing e, pitch width. */
export interface VBeltSection {
  top: number
  h: number
  e: number
  pitchW: number
}

/** Classical V-belt sections Z, A, B (ISO 4184). */
export const VBELT_SECTIONS: Record<'Z' | 'A' | 'B', VBeltSection> = {
  Z: { top: 0.01, h: 0.006, e: 0.012, pitchW: 0.0085 },
  A: { top: 0.013, h: 0.008, e: 0.015, pitchW: 0.011 },
  B: { top: 0.017, h: 0.011, e: 0.019, pitchW: 0.014 },
}

/**
 * Multi-groove V-sheave of pitch radius Rp for belt section `s`, groove included angle `groove`
 * (rad). Axis along Z, grooves centred on z = 0. Returns the solid, its width and outside radius.
 */
export function vSheave(Rp: number, grooves: number, s: VBeltSection, groove: number, bore = 0.02) {
  const ro = Rp + s.h * 0.35 // outside radius: belt top runs about flush with the rim
  const depth = s.h + 0.004
  const wTop = s.top + 0.001
  const wBot = wTop - 2 * depth * Math.tan(groove / 2)
  const edge = s.e * 0.65
  const W = (grooves - 1) * s.e + 2 * edge
  const rimIn = Math.max(bore * 2.2, ro - depth - Math.max(0.008, Rp * 0.1))
  const prof: V2[] = [
    [rimIn, -W / 2],
    [ro, -W / 2],
  ]
  for (let g = 0; g < grooves; g++) {
    const zc = -W / 2 + edge + g * s.e
    prof.push([ro, zc - wTop / 2], [ro - depth, zc - wBot / 2], [ro - depth, zc + wBot / 2], [ro, zc + wTop / 2])
  }
  prof.push([ro, W / 2], [rimIn, W / 2])
  const rim = lathe(prof, 96)
  const hubR = Math.max(bore * 2, Math.min(rimIn - 0.004, Rp * 0.3))
  const hl = Math.max(W, HUB_L) / 2
  const hub = lathe(
    [
      [bore, -hl],
      [hubR, -hl],
      [hubR, hl],
      [bore, hl],
    ],
    40,
  )
  const parts = [toZ(rim), toZ(hub)]
  if (rimIn - hubR > 0.02) {
    const len = rimIn - hubR + 0.004
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * PI) / 5
      parts.push(xform(box(len, Math.max(0.012, Rp * 0.1), W * 0.5), mat4.c(mat4.rz(a), mat4.t(hubR + len / 2 - 0.002, 0, 0))))
    }
  }
  return { geometry: merge(...parts), width: W, outside: ro }
}

/** Plain idler pulley with a flanged rim, axis along Z, centred on z = 0. */
export function idlerPulley(R: number, W: number) {
  return toZ(
    lathe(
      [
        [0.012, -W / 2 - 0.004],
        [R * 0.35, -W / 2 - 0.004],
        [R * 0.35, -W / 2],
        [R, -W / 2],
        [R, W / 2],
        [R * 0.35, W / 2],
        [R * 0.35, W / 2 + 0.004],
        [0.012, W / 2 + 0.004],
      ],
      48,
    ),
  )
}

/* ================================ roller chain and sprockets ================================ */

/** Roller-chain proportions from the pitch (close to ISO 606 B-series). */
export function rollerChainDims(p: number) {
  return { p, roller: 0.63 * p, inner: 0.62 * p, pin: 0.31 * p, bush: 0.45 * p, h: 0.86 * p, tp: 0.12 * p, transverse: 1.09 * p }
}

/** Waisted (figure-of-eight) link plate with two holes p apart along X, centred, in XY; thickness t along Z (centred). */
export function linkPlate(p: number, h: number, holeR: number, t: number) {
  const r = h / 2
  const w = h * 0.36
  const a = (52 * PI) / 180
  const s = new THREE.Shape()
  s.moveTo(-p / 2 + r * Math.cos(a), r * Math.sin(a))
  s.absarc(-p / 2, 0, r, a, 2 * PI - a, false)
  s.quadraticCurveTo(0, -w, p / 2 - r * Math.cos(a), -r * Math.sin(a))
  s.absarc(p / 2, 0, r, PI + a, 3 * PI - a, false)
  s.quadraticCurveTo(0, w, -p / 2 + r * Math.cos(a), r * Math.sin(a))
  for (const x of [-p / 2, p / 2]) {
    const hole = new THREE.Path()
    hole.absarc(x, 0, holeR, 0, 2 * PI, true)
    s.holes.push(hole)
  }
  return extrude(s, t, { curveSegments: 14 })
}

/**
 * Roller-chain pieces for instancing (pitch p, simplex or duplex). Roller, bush and pin lie along
 * Z centred on a pitch point; plates are centred between two pitch points, at z = ±zInner / ±zOuter
 * from each strand's centre. One pin spans every strand (`span` = outer strands' centre distance).
 */
export function rollerChain(p: number, strands: 1 | 2 = 1) {
  const d = rollerChainDims(p)
  const span = (strands - 1) * d.transverse
  const e = (span + d.inner) / 2 + 2 * d.tp
  return {
    d,
    roller: xform(tube(d.roller / 2, d.bush / 2 + 0.0001, d.inner * 0.94, 20), Y2Z),
    bush: xform(tube(d.bush / 2, d.pin / 2 + 0.00005, d.inner + 2 * d.tp, 16), Y2Z),
    pin: xform(
      lathe(
        [
          [0, -e - 0.0012],
          [d.pin / 2, -e - 0.0012],
          [(d.pin / 2) * 1.12, -e - 0.0006],
          [(d.pin / 2) * 1.12, e + 0.0006],
          [d.pin / 2, e + 0.0012],
          [0, e + 0.0012],
        ],
        12,
      ),
      Y2Z,
    ),
    inner: linkPlate(p, d.h * 0.96, d.bush / 2, d.tp),
    outer: linkPlate(p, d.h, d.pin / 2, d.tp),
    zInner: d.inner / 2 + d.tp / 2,
    zOuter: d.inner / 2 + d.tp * 1.5 + 0.0002,
    span,
  }
}

/** Simplex or duplex sprocket for roller chain of pitch p (axis Z, teeth centred on z = 0), with a keyed hub. */
export function chainSprocket(z: number, p: number, strands: 1 | 2 = 1, bore = 0.012) {
  const d = rollerChainDims(p)
  const w = d.inner * 0.88
  const R = p / (2 * Math.sin(PI / z))
  const rings: THREE.BufferGeometry[] = []
  for (let k = 0; k < strands; k++) rings.push(xform(sprocket(z, p, d.roller, w, bore), mat4.t(0, 0, (k - (strands - 1) / 2) * d.transverse)))
  const hubR = Math.min(R - d.roller, Math.max(bore * 2.2, R * 0.35))
  const hubL = (strands - 1) * d.transverse + w + 0.03
  const hub = xform(tube(hubR, bore, hubL, 32), mat4.c(mat4.t(0, 0, -0.012), Y2Z))
  const key = xform(cylinder(bore * 0.3, hubL, 8), mat4.c(mat4.t(0, bore, -0.012), Y2Z))
  return merge(...rings, hub, key)
}

/* ================================ springs and welds ================================ */

/**
 * One leaf of a leaf spring: a length × t × b strip from x0 along +X, top face at yTop, bent so its
 * centre line drops by f(x) (x measured from the root). Width b along Z, centred.
 */
export function bentLeaf(x0: number, length: number, t: number, b: number, yTop: number, f: (x: number) => number) {
  const g = new THREE.BoxGeometry(length, t, b, 32, 1, 1)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const xl = pos.getX(i) + length / 2
    pos.setX(i, x0 + xl)
    pos.setY(i, pos.getY(i) + yTop - t / 2 - f(xl))
  }
  return finalize(g, Math.PI / 6)
}

/** Fillet-weld prism: a triangular section in XY extruded `length` along Z (centred). */
export function filletPrism(tri: [number, number][], length: number) {
  return extrudeTwisted(
    tri.map(([a, b]) => new THREE.Vector2(a, b)),
    [],
    length,
  )
}

/**
 * The three fillet welds (leg w) of a C-shaped weld group on a plate in the XY plane: top and
 * bottom welds along X from x = 0 to hb at y = ±hd, the web weld along Y at x = 0.
 */
export function bracketWelds(hb: number, hd: number, w: number) {
  const swap = (pts: [number, number][]) => pts.map(([y, z]) => [z, y] as [number, number])
  const alongX = () => new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).premultiply(mat4.t(hb / 2, 0, 0))
  const top = filletPrism(
    swap([
      [hd, 0],
      [hd + w, 0],
      [hd, w],
    ]),
    hb,
  )
  top.applyMatrix4(alongX())
  const bot = filletPrism(
    swap([
      [-hd, 0],
      [-hd, w],
      [-hd - w, 0],
    ]),
    hb,
  )
  bot.applyMatrix4(alongX())
  const web = filletPrism(
    [
      [0, 0],
      [0, w],
      [-w, 0],
    ],
    2 * hd,
  )
  web.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)))
  return [top, bot, web]
}

/** Circumferential fillet bead (leg w) round a bar of radius R lying along +X from a plate face at x0. */
export function filletBead(R: number, w: number, x0: number) {
  const bead = lathe(
    [
      [R, 0],
      [R + w, 0],
      [R, w],
    ],
    72,
  )
  bead.applyMatrix4(mat4.c(mat4.t(x0, 0, 0), mat4.rz(-Math.PI / 2)))
  return bead
}

/* ================================ clutches and brakes ================================ */

/** Revolve a millimetre (r, y) profile about Y, scaled to metres. */
export const latheMM = (pts: V2[], seg = 64) => lathe(mmPts(pts), seg)

/** Multiple-disc clutch plate thicknesses and spacing (mm). */
export const DISC = { steelT: 2.5, bronzeT: 3, gap: 2, y0: -10, collarT: 5 }

/**
 * Multiple-disc clutch (friction radii Ro, Ri in mm). Y-axis frame: input shaft C up (+Y), output
 * shaft D down, drum housing open at the top; one steel and one bronze plate to stack along Y
 * (see `plateStack`), and the pressure collar.
 */
export function multiDiscClutch(RoMM: number, RiMM: number) {
  const steelOut = RoMM + 1
  const drumIn = Math.max(steelOut + 8, RoMM + 9)
  return {
    shaftC: xform(cylinder(20 * MM, 90 * MM, 32), mat4.t(0, 35 * MM, 0)),
    shaftD: xform(cylinder(15 * MM, 50 * MM, 32), mat4.t(0, -40 * MM, 0)),
    housing: latheMM(
      [
        [0, -15],
        [drumIn + 5, -15],
        [drumIn + 5, 24],
        [drumIn, 24],
        [drumIn, -12],
        [0, -12],
      ],
      72,
    ),
    steel: mmBand(20, steelOut, 0, DISC.steelT),
    bronze: mmBand(RiMM, drumIn - 0.5, 0, DISC.bronzeT),
    collar: mmBand(20, steelOut - 2, 0, DISC.collarT, 64),
    drumIn: drumIn * MM,
  }
}

/** y (mm) of each plate's lower face for engagement e (0…1); plates alternate steel/bronze starting with steel. */
export function plateStack(nSteel: number, nBronze: number, e: number) {
  const out: { steel: boolean; y: number }[] = []
  let y = DISC.y0
  let s = nSteel
  let b = nBronze
  let steelTurn = true
  while (s + b > 0) {
    const steel: boolean = (steelTurn && s > 0) || b === 0
    if (steel) s--
    else b--
    steelTurn = !steel
    out.push({ steel, y })
    y += (steel ? DISC.steelT : DISC.bronzeT) + (1 - e) * DISC.gap
  }
  return { plates: out, collarY: y }
}

/** Cone clutch (radii in mm, semi-cone angle alpha). Y-axis frame: cup below y = 0, cone and lining from y = 0 up to h. */
export function coneClutch(RoMM: number, RiMM: number, alpha: number) {
  const h = (RoMM - RiMM) / Math.tan(alpha)
  const lin = 2
  return {
    h: h * MM,
    cone: latheMM(
      [
        [18, 0],
        [RiMM, 0],
        [RoMM, h],
        [RoMM, h + 10],
        [18, h + 10],
      ],
      72,
    ),
    lining: latheMM(
      [
        [RiMM, 0.5],
        [RiMM + lin, 0.5],
        [RoMM + lin, h - 0.5],
        [RoMM, h - 0.5],
      ],
      72,
    ),
    cup: latheMM(
      [
        [0, -12],
        [RoMM + 14, -12],
        [RoMM + 14, h],
        [RoMM + lin, h],
        [RiMM + lin, 0],
        [0, 0],
      ],
      72,
    ),
    shaftIn: xform(cylinder(18 * MM, 80 * MM, 32), mat4.t(0, (h + 40) * MM, 0)),
    shaftOut: xform(cylinder(18 * MM, 50 * MM, 32), mat4.t(0, -37 * MM, 0)),
  }
}

/** Brake drum with hub, web and rim (radius R, half-width `half`, hub radius, all mm). Axis along Z, centred. */
export function brakeDrum(R: number, half: number, hub = 25) {
  const rim = R - 30 * (R / 360)
  const g = latheMM(
    [
      [hub, -half],
      [hub * 2.4, -half],
      [hub * 2.4, -8],
      [rim, -8],
      [rim, -half],
      [R, -half],
      [R, half],
      [rim, half],
      [rim, 8],
      [hub * 2.4, 8],
      [hub * 2.4, half],
      [hub, half],
    ],
    96,
  )
  return g.applyMatrix4(Y2Z)
}

/** Annular sector (brake shoe or lining) in XY between radii r0, r1 and angles a0…a1, extruded along Z (centred). */
export function annularSector(r0: number, r1: number, a0: number, a1: number, depth: number, n = 24) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector2(r1 * cos(a), r1 * sin(a)))
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector2(r0 * cos(a), r0 * sin(a)))
  }
  return extrudeTwisted(pts, [], depth)
}

/** A thin strip (brake band) of thickness t following a polyline in XY, extruded `width` along Z (centred). */
export function bandStrip(line: THREE.Vector2[], t: number, width: number) {
  const n = line.length
  const outer: THREE.Vector2[] = []
  const inner: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    const prev = line[Math.max(0, i - 1)]
    const next = line[Math.min(n - 1, i + 1)]
    const d = next.clone().sub(prev).normalize()
    const nrm = new THREE.Vector2(-d.y, d.x)
    outer.push(line[i].clone().addScaledVector(nrm, t / 2))
    inner.push(line[i].clone().addScaledVector(nrm, -t / 2))
  }
  return extrudeTwisted([...outer, ...inner.reverse()], [], width)
}

/* ------------------------------ consolidated from other library files ------------------------------ */

/** (moved from chassis.ts) */
/**
 * Helical compression spring with closed ends, UNIT length from 0 to +1 along `axis` (scale that
 * axis to the working length). Coil radius to the wire centre.
 */
export function coilSpring(s: { coilR: number; wireR: number; turns: number; axis?: 'x' | 'y' }) {
  const g = helixSpring(s.coilR, s.wireR, 1, s.turns)
  return s.axis === 'x' ? xform(g, mat4.rz(-PI / 2)) : g
}

/** (moved from chassis.ts) */
/**
 * Telescopic (hydraulic) damper, vertical. Body: closed cylinder from y = base to base + bodyL,
 * sitting on its lower mount at the origin. Rod: UNIT length from y = 0 down to y = −1, to hang
 * from the upper mount (place at the upper mount, scale.y = rod length showing).
 */
export function telescopicDamper(s: { bodyR: number; bodyL: number; rodR: number; base?: number }) {
  const base = s.base ?? 0.02
  return {
    body: xform(cylinder(s.bodyR, s.bodyL, 24), mat4.t(0, base + s.bodyL / 2, 0)),
    rod: xform(cylinder(s.rodR, 1, 16), mat4.t(0, -0.5, 0)),
  }
}

/** (moved from driveline.ts) */
/**
 * Pillow-block bearing around the X axis at the origin: cast housing with base and bolt
 * bosses, and the bearing insert. `drop` is the distance from the shaft axis to the base.
 */
export function pillowBlockX(bore: number, drop: number) {
  return plummerBlock({ bore, drop, axis: 'x' })
}

/** (moved from implements.ts) */
/**
 * Saw-tooth ratchet wheel in the XY plane, centred, thickness t along Z.
 */
export function ratchetWheel(teeth: number, R: number, depth: number, t: number) {
  const s = new THREE.Shape()
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * 2 * PI
    const a1 = ((i + 1) / teeth) * 2 * PI
    const p0 = [R * Math.cos(a0), R * Math.sin(a0)]
    const p1 = [(R - depth) * Math.cos(a1), (R - depth) * Math.sin(a1)]
    if (i === 0) s.moveTo(p0[0], p0[1])
    else s.lineTo(p0[0], p0[1])
    s.lineTo(p1[0], p1[1])
  }
  s.closePath()
  const g = extrude(s, t)
  g.translate(0, 0, -t / 2)
  return g
}

/** (moved from implements.ts) */
/**
 * Overload (slip) clutch: friction disc pack and hub nut, axis along X, centred.
 */
export function slipClutch(r = 0.08) {
  return merge(cylinder(r, 0.04, 24).rotateZ(PI / 2), cylinder(r * 0.625, 0.05, 6).rotateZ(PI / 2).translate(0.05, 0, 0))
}

/** (moved from implements.ts) */
/**
 * Anchor-chain link (oval ring), lying in the XZ plane, centred.
 */
export function anchorLink() {
  return lathe([[0.07, -0.02], [0.1, -0.02], [0.1, 0.02], [0.07, 0.02]], 10).scale(1.4, 1, 1)
}

/** (moved from processing.ts) */
/** Flat spring-steel leaf (rocker) of length len along Y, width along Z, centred. */
export function leafSpring({ len, width, t = 0.006 }: { len: number; width: number; t?: number }) {
  return box(t, len, width)
}

/** (moved from processing.ts) */
/** Eccentric disc with its crank pin at pinOffset along +X. Axis Y (disc in XZ), centred. */
export function eccentricCrank({ r, t, pinOffset }: { r: number; t: number; pinOffset: number }) {
  return merge(cylinder(r, t, 32), xform(cylinder(0.012, t * 2, 16), mat4.t(pinOffset, 0, t / 2)))
}

/** (moved from processing.ts) */
/** Pitman (connecting) rod of centre distance ≈ len along X, eyes on axis Z. Centred. */
export function pitmanRod({ len, h = 0.035, t = 0.02 }: { len: number; h?: number; t?: number }) {
  const eye = (x: number) => xform(cylinder(h / 2, t, 20), mat4.c(mat4.t(x, 0, 0), mat4.rx(Math.PI / 2)))
  return merge(box(len - 0.04, h * 0.7, t), eye(-len / 2 + 0.02), eye(len / 2 - 0.02))
}
