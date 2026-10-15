import * as THREE from 'three'
import { box, csg, cylinder, extrude, extrudeTwisted, gear, helixSpring, lathe, mat4, merge, tube, xform, type CsgOp, type V2 } from '@/geometry'
import { axial, ringZ, shaftZ } from './shapes'

/**
 * Shared parts library — hydraulic components: gear and vane pumps, spool control valves (the
 * lift-circuit 3-port valve and the 4/3 directional valve), relief valve, filter, the single-acting
 * lift ram, the double-acting cylinder's parts (barrel, cap and clevis eyes, sealed piston, gland,
 * rod, oil columns), and the three-point linkage's adjustable top link and stabiliser.
 * (Moved here from the lift-circuit, cylinder, pumps, draft-control, three-point and hydrostatic-
 * steering scenes, which now use it, as does the whole-tractor view.) Worker-safe; some parts use
 * CSG, so build them in the geometry worker. Each part is built in its own local frame, noted per
 * builder.
 */

const { PI } = Math
const AXIS_X = mat4.rz(-PI / 2)
const AXIS_Z = mat4.rx(PI / 2)
/** revolve an (r, x) profile about the X axis */
export const alongX = (profile: V2[], seg = 48) => xform(lathe(profile, seg), AXIS_X)
/** annulus r0…r1 from x0 to x1 along X */
const ringX = (r0: number, r1: number, x0: number, x1: number, seg = 72) =>
  alongX(
    [
      [r0, x0],
      [r1, x0],
      [r1, x1],
      [r0, x1],
    ],
    seg,
  )

/* ------------------------------ gear pump ------------------------------ */

export interface GearPumpSpec {
  module: number
  teeth: number
  /** gear face width */
  width: number
  /** body block [x, y, z]; default [c + 0.08, c + 0.07, width + 0.022] (closed ends). Give z = width for an open body closed by `gearPumpCovers`. */
  block?: [number, number, number]
  /** radial clearance of the cavity round the gear tips (default 1.2 mm) */
  clearance?: number
  /** cavity depth (default width + 2 mm) */
  cavityDepth?: number
  /** suction / delivery port radius and their offset from the centre along ±Y (defaults 8 mm, 40 mm) */
  portR?: number
  portOffset?: number
  /** gear face width (default width − 2 mm), bore and flank resolution */
  gearWidth?: number
  bore?: number
  flankPoints?: number
}

/**
 * External gear pump. Local frame: gear axes along Z, the two gears at x = ±c/2 (c = m·z),
 * suction port below and delivery port above. Returns the body and one gear (use it twice).
 */
export function gearPump(s: GearPumpSpec) {
  const c = s.module * s.teeth
  const [bx, by, bz] = s.block ?? [c + 0.08, c + 0.07, s.width + 0.022]
  const blk = box(bx, by, bz)
  const ra = s.module * (s.teeth / 2 + 1) + (s.clearance ?? 0.0012)
  const cav = (dx: number) => xform(cylinder(ra, s.cavityDepth ?? s.width + 0.002, 40), mat4.c(mat4.t(dx, 0, 0), AXIS_Z))
  const pr = s.portR ?? 0.008
  const po = s.portOffset ?? 0.04
  const body = csg(blk, [
    { op: 'sub', geometry: cav(-c / 2) },
    { op: 'sub', geometry: cav(c / 2) },
    { op: 'sub', geometry: xform(cylinder(pr, 0.06, 16), mat4.t(0, -po, 0)) },
    { op: 'sub', geometry: xform(cylinder(pr, 0.06, 16), mat4.t(0, po, 0)) },
  ])
  // gear() is centred on z = 0
  const g = gear({ teeth: s.teeth, module: s.module, width: s.gearWidth ?? s.width - 0.002, bore: s.bore ?? 0.006, flankPoints: s.flankPoints })
  return { body, gear: g, centres: c }
}

/**
 * Cover plates for an open-bodied gear pump (block z = width) and the two gear shafts. Same frame
 * as `gearPump`: the front plate (+Z) has the drive-shaft hole at the drive gear, x = +c/2. Shafts
 * are in a gear's own frame (axis Z, centred on the gear); the drive shaft sticks out the front.
 */
export function gearPumpCovers(s: GearPumpSpec & { plateT?: number; shaftR?: number }) {
  const c = s.module * s.teeth
  const [bx, by] = s.block ?? [c + 0.08, c + 0.07, s.width]
  const t = s.plateT ?? 0.012
  const zf = s.width / 2 + t / 2
  const front = csg(xform(box(bx, by, t), mat4.t(0, 0, zf)), [{ op: 'sub', geometry: xform(cylinder(0.0075, 0.05, 32), mat4.c(mat4.t(c / 2, 0, zf), AXIS_Z)) }])
  const rear = xform(box(bx, by, t), mat4.t(0, 0, -zf))
  const r = s.shaftR ?? 0.006
  const drive = xform(cylinder(r, 0.1, 24), mat4.c(mat4.t(0, 0, 0.03), AXIS_Z))
  const idler = xform(cylinder(r, s.width + 2 * t, 24), AXIS_Z)
  return { front, rear, drive, idler }
}

/* ------------------------------ vane pump ------------------------------ */

export interface VanePumpSpec {
  ringR: number
  rotorR: number
  width: number
  vanes: number
  vaneT: number
  vaneLen: number
}

/** Unbalanced vane pump: ring bore 80 mm, rotor 68 mm, 30 mm wide, 8 vanes 4 mm thick. */
export const VANE_PUMP: VanePumpSpec = { ringR: 0.04, rotorR: 0.034, width: 0.03, vanes: 8, vaneT: 0.004, vaneLen: 0.018 }

/** Rotor outline with a radial slot for each vane (XY). */
function rotorContour(v: VanePumpSpec) {
  const { rotorR: r, vanes: n, vaneT } = v
  const slotD = 0.017
  const half = vaneT / 2 + 0.0002
  const pts: THREE.Vector2[] = []
  for (let k = 0; k < n; k++) {
    const a = (2 * PI * k) / n
    const c = Math.cos(a)
    const s = Math.sin(a)
    const P = (rad: number, t: number) => new THREE.Vector2(rad * c - t * s, rad * s + t * c)
    const da = Math.asin(half / r)
    // circle arc from the previous slot to this slot
    const aPrev = a - (2 * PI) / n + da
    for (let i = 1; i <= 6; i++) {
      const t = aPrev + ((a - da - aPrev) * i) / 6
      pts.push(new THREE.Vector2(r * Math.cos(t), r * Math.sin(t)))
    }
    pts.push(P(r - slotD, -half), P(r - slotD, half))
    pts.push(new THREE.Vector2(r * Math.cos(a + da), r * Math.sin(a + da)))
  }
  return pts
}

function kidney(a0: number, a1: number, r0: number, r1: number, depth: number, z: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r1, a0, a1, false)
  s.absarc(0, 0, r0, a1, a0, true)
  return xform(extrude(s, depth, { curveSegments: 24 }), mat4.t(0, 0, z))
}

/**
 * Vane pump. Local frame: axis Z, rotor centred on the origin (offset the ring by the
 * eccentricity). Rotor with vane slots, cam ring, one vane (box, radial along X; place one per
 * slot), drive shaft, housing body, rear port plate with the inlet / outlet kidneys and side
 * ports (±X), and the front cover.
 */
export function vanePump(v: VanePumpSpec = VANE_PUMP) {
  const W = v.width
  const hole: THREE.Vector2[] = []
  for (let i = 0; i < 32; i++) hole.push(new THREE.Vector2(0.008 * Math.cos((-2 * PI * i) / 32), 0.008 * Math.sin((-2 * PI * i) / 32)))
  const rotor = extrudeTwisted(rotorContour(v), [hole], W - 0.0004)
  const body = csg(box(0.13, 0.135, W), [{ op: 'sub', geometry: xform(cylinder(0.0585, 0.06, 72), AXIS_Z) }])
  const zr = -W / 2 - 0.007
  const rear = csg(xform(box(0.13, 0.135, 0.014), mat4.t(0, 0, zr)), [
    { op: 'sub', geometry: kidney((105 * PI) / 180, (255 * PI) / 180, 0.0352, 0.0398, 0.01, zr + 0.003) },
    { op: 'sub', geometry: kidney((-75 * PI) / 180, (75 * PI) / 180, 0.0352, 0.0398, 0.01, zr + 0.003) },
    { op: 'sub', geometry: xform(cylinder(0.0075, 0.06, 24), mat4.c(mat4.t(-0.065, 0, zr + 0.001), AXIS_X)) },
    { op: 'sub', geometry: xform(cylinder(0.0075, 0.06, 24), mat4.c(mat4.t(0.065, 0, zr + 0.001), AXIS_X)) },
  ])
  const front = csg(xform(box(0.13, 0.135, 0.012), mat4.t(0, 0, W / 2 + 0.006)), [{ op: 'sub', geometry: xform(cylinder(0.0085, 0.05, 32), mat4.c(mat4.t(0, 0, W / 2 + 0.006), AXIS_Z)) }])
  return {
    ring: xform(tube(0.052, v.ringR, W, 96), AXIS_Z),
    rotor,
    vane: box(v.vaneLen, v.vaneT, W - 0.0008),
    shaft: xform(cylinder(0.008, 0.11, 24), mat4.c(mat4.t(0, 0, 0.03), AXIS_Z)),
    body,
    rear,
    front,
  }
}

/** Straight port pipe (hose stub) along X from x0 to x1, centred at (y, z). */
export const portPipe = (x0: number, x1: number, y = 0, z = 0, rOut = 0.0125, rIn = 0.0095) => xform(tube(rOut, rIn, Math.abs(x1 - x0), 32), mat4.c(mat4.t((x0 + x1) / 2, y, z), AXIS_X))

/* ------------------------------ spool control valve ------------------------------ */

export interface SpoolValveSpec {
  length: number
  h: number
  w: number
  boreR: number
  /** ports: x from the body's left end, on the top (P) or underneath (A, T) */
  ports: { x: number; up: boolean }[]
  /** spool lands as [from, to] measured from the spool's left end (the spool is length + 0.08 long) */
  lands?: [number, number][]
}

/** Valve body along X, local origin at the bore centre, left end at x = −length/2; spool centred on 0. */
export function spoolValve(s: SpoolValveSpec) {
  const body = box(s.length, s.h, s.w)
  const port = (x: number, up: boolean) => xform(cylinder(0.0085, s.h / 2 + 0.01, 20), mat4.t(-s.length / 2 + x, (up ? 1 : -1) * (s.h / 4 + 0.005), 0))
  const valve = csg(body, [{ op: 'sub', geometry: xform(cylinder(s.boreR, s.length + 0.02, 40), mat4.rz(PI / 2)) }, ...s.ports.map((p) => ({ op: 'sub' as const, geometry: port(p.x, p.up) }))])
  const r = s.boreR - 0.0004
  const n = 0.008
  const len = s.length + 0.08
  const x0 = -len / 2
  const lands = s.lands ?? [
    [0.03, 0.075],
    [0.105, 0.15],
    [0.18, 0.225],
  ]
  const pts: V2[] = [
    [0, x0],
    [n, x0],
  ]
  for (const [a, b] of lands) pts.push([n, x0 + a], [r, x0 + a], [r, x0 + b], [n, x0 + b])
  pts.push([n, x0 + len], [0, x0 + len])
  return { body: valve, spool: alongX(pts, 40) }
}

/** 4/3 directional valve proportions: body height, port heights (y) and spool shift (m). */
export const DC_VALVE = { h: 0.15, portA: -0.02, portB: 0.04, portP: 0.01, portT: -0.05, shift: 0.015 }

/**
 * 4/3 closed-centre directional control valve for a double-acting cylinder. Local frame: spool
 * bore along Y through the origin; ports A and B on the +X (cylinder) side, P and the two T
 * galleries on the −X side. The spool's lands cover A and B in the centre position; its stem
 * runs out of the top.
 */
export function directionalValve(v: Partial<typeof DC_VALVE> = {}) {
  const s = { ...DC_VALVE, ...v }
  const body = box(0.05, s.h, 0.042)
  const port = (y: number, side: 1 | -1) => ({ op: 'sub' as const, geometry: xform(cylinder(0.0055, 0.03, 20), mat4.c(mat4.t(side * 0.016, y, 0), AXIS_X)) })
  const valve = csg(body, [
    { op: 'sub', geometry: cylinder(0.0092, s.h + 0.02, 40) },
    port(s.portA, 1),
    port(s.portB, 1),
    port(s.portP, -1),
    port(s.portT, -1),
    port(s.portT + 0.12, -1),
  ])
  const r = 0.0089
  const n = 0.0048
  const prof: V2[] = [
    [0, -0.075],
    [r, -0.075],
    [r, -0.068],
    [n, -0.068],
    [n, -0.03],
    [r, -0.03],
    [r, -0.01],
    [n, -0.01],
    [n, 0.03],
    [r, 0.03],
    [r, 0.05],
    [n, 0.05],
    [n, 0.068],
    [r, 0.068],
    [r, 0.075],
    [0.004, 0.075],
    [0.004, 0.12],
    [0, 0.12],
  ]
  return { body: valve, spool: lathe(prof, 32) }
}

/* ------------------------------ relief valve ------------------------------ */

/**
 * Direct-acting relief valve, vertical. Local frame: axis Y, body from y = 0 to `height`, seat at
 * `seat`; inlet on the −X side below the seat, outlet on the +X side above it. Poppet and a
 * unit-length spring (scale.y sets its length) to place on the seat.
 */
export function reliefValve(s: { r: number; height: number; seat: number }) {
  const ri = s.r - 0.006
  const shell = lathe(
    [
      [0, 0],
      [s.r, 0],
      [s.r, s.height],
      [0, s.height],
      [0, s.height - 0.008],
      [ri, s.height - 0.008],
      [ri, s.seat + 0.006],
      [0.009, s.seat + 0.006],
      [0.009, s.seat],
      [ri, s.seat],
      [ri, 0.008],
      [0, 0.008],
    ],
    40,
  )
  const side = (y: number, dx: number) => xform(cylinder(0.0075, 0.03, 16), mat4.c(mat4.t(dx, y, 0), mat4.rz(PI / 2)))
  const body = csg(shell, [
    { op: 'sub', geometry: side(s.seat - 0.025, -s.r) },
    { op: 'sub', geometry: side(s.seat + 0.09, s.r) },
  ])
  const poppet = lathe(
    [
      [0, -0.012],
      [0.012, 0],
      [0.017, 0.004],
      [0.017, 0.014],
      [0, 0.014],
    ],
    32,
  )
  return { body, poppet, spring: helixSpring(0.011, 0.0018, 1, 7) }
}

/* ------------------------------ filter ------------------------------ */

/** Full-flow filter can with a pleated-element stand-in. Local frame: axis Y, from y = 0 to `height`. */
export function filterCan(s: { r: number; height: number }) {
  const can = lathe(
    [
      [0.01, 0],
      [s.r, 0],
      [s.r, s.height],
      [0.012, s.height],
      [0.012, s.height - 0.006],
      [s.r - 0.005, s.height - 0.006],
      [s.r - 0.005, 0.006],
      [0.01, 0.006],
    ],
    40,
  )
  const element = xform(tube(s.r - 0.012, 0.018, s.height - 0.03, 40), mat4.t(0, s.height / 2, 0))
  return { can, element }
}

/* ------------------------------ oil columns ------------------------------ */

/** Oil column of radius r: unit length along +X from x = 0 (scale.x sets its length). */
export const oilColumn = (r = 1, seg = 64) =>
  alongX(
    [
      [0, 0],
      [r, 0],
      [r, 1],
      [0, 1],
    ],
    seg,
  )

/** Annulus oil round a rod (rod-side chamber): unit length along +X from x = 0. */
export const annulusOil = (rodR: number, boreR: number, seg = 64) => ringX(rodR + 0.0002, boreR - 0.0002, 0, 1, seg)

/* ------------------------------ single-acting ram ------------------------------ */

/**
 * Single-acting ram. Local frame: along +X from the cap-end pivot (origin). Barrel (closed cap,
 * open rod end) with its pivot lug; piston with seal at x = 0 (move it along X); rod from the piston
 * face, `rodLen` long; unit-length oil column (scale.x = cap-to-piston length).
 */
export function ram(s: { bore: number; barrelLen: number; rodLen: number; rodR?: number }) {
  const R = s.bore / 2
  const Ro = R + 0.01
  const barrel = alongX(
    [
      [0, -0.02],
      [Ro, -0.02],
      [Ro, s.barrelLen],
      [R, s.barrelLen],
      [R, 0],
      [0, 0],
    ],
    56,
  )
  const lug = xform(xform(cylinder(0.022, 0.06, 24), AXIS_Z), mat4.t(-0.035, 0, 0))
  const piston = alongX(
    [
      [0, 0],
      [R - 0.0005, 0],
      [R - 0.0005, 0.035],
      [0, 0.035],
    ],
    48,
  )
  const seal = ringX(R - 0.006, R - 0.0002, 0.012, 0.022, 48)
  const rod = pistonRod({ rodR: s.rodR ?? 0.017, length: s.rodLen, start: 0.035, eye: false, segments: 32 }).rod
  return { barrel: merge(barrel, lug), piston, seal, rod, oil: oilColumn(R - 0.0003, 48) }
}

/* ------------------------------ double-acting cylinder ------------------------------ */

export interface EyeSpec {
  /** from the mounting face to the far end of the eye */
  len: number
  /** half-height of the tongue (= eye outer radius) */
  halfH: number
  holeR: number
  /** tongue thickness (along Z, centred) */
  thick: number
}

/**
 * Clevis eye: tongue with a pin hole, in the XY plane, extruded along Z (centred). The tongue runs
 * from x = 0 towards `dir` (±X); the pin hole is at dir·(len − halfH).
 */
export function clevisEye(e: EyeSpec, dir: 1 | -1) {
  const { len, halfH, holeR, thick } = e
  const s = new THREE.Shape()
  s.moveTo(0, -halfH)
  s.lineTo(dir * (len - halfH), -halfH)
  s.absarc(dir * (len - halfH), 0, halfH, -PI / 2, PI / 2, dir < 0)
  s.lineTo(0, halfH)
  s.lineTo(0, -halfH)
  const h = new THREE.Path()
  h.absarc(dir * (len - halfH), 0, holeR, 0, 2 * PI, true)
  s.holes.push(h)
  return extrude(s, thick, { curveSegments: 28 })
}

/**
 * Cylinder barrel: tube of bore R, outside Ro, along +X from x = 0 (cap face) to `length` (rod end),
 * with welded port bosses on top (+Y) at the given x, drilled through to the bore.
 */
export function cylinderBarrel(s: { R: number; Ro: number; length: number; ports?: number[]; portR?: number; bossR?: number; bossH?: number; segments?: number }) {
  const t = ringX(s.R, s.Ro, 0, s.length, s.segments ?? 64)
  const ports = s.ports ?? []
  if (!ports.length) return t
  const wall = s.Ro - s.R
  const bossH = s.bossH ?? 0.016
  const boss = (x: number) => xform(cylinder(s.bossR ?? 0.014, bossH + wall, 32), mat4.t(x, s.Ro + bossH / 2 - wall / 2, 0))
  const hole = (x: number) => xform(cylinder(s.portR ?? 0.0065, bossH + wall * 3, 24), mat4.t(x, s.Ro, 0))
  const ops: CsgOp[] = [...ports.map((x) => ({ op: 'add' as const, geometry: boss(x) })), ...ports.map((x) => ({ op: 'sub' as const, geometry: hole(x) }))]
  return csg(t, ops)
}

/**
 * Welded cap end, from x = −capT to 0, with the cap-end clevis eye pointing −X. `pinX` is the eye's
 * pin centre.
 */
export function cylinderCap(s: { Ro: number; capT: number; eye?: EyeSpec; segments?: number }) {
  const e = s.eye ?? { len: 0.058, halfH: 0.022, holeR: 0.0105, thick: 0.03 }
  const cap = alongX(
    [
      [0, -s.capT],
      [s.Ro, -s.capT],
      [s.Ro, 0],
      [0, 0],
    ],
    s.segments ?? 64,
  )
  return { cap: merge(cap, xform(clevisEye(e, -1), mat4.t(-s.capT, 0, 0))), pinX: -s.capT - e.len + e.halfH }
}

/**
 * Piston for bore radius R: two seal grooves with a wear-ring groove between them, along +X from
 * x = 0 (cap-side face) to `width`. Returns the piston, the two seals and the wear ring.
 * Grooves default to the reference layout scaled to the width.
 */
export function sealedPiston(s: { R: number; width: number; grooves?: [number, number][]; grooveD?: number; segments?: number }) {
  const w = s.width
  const gr = s.grooves ?? ([
    [0.006, 0.014],
    [0.019, 0.027],
    [0.032, 0.04],
  ].map(([a, b]) => [(a / 0.046) * w, (b / 0.046) * w]) as [number, number][])
  const gd = s.grooveD ?? 0.0045
  const seg = s.segments ?? 72
  const Rp = s.R - 0.0004
  const pts: V2[] = [
    [0, 0],
    [Rp, 0],
  ]
  for (const [a, b] of gr) pts.push([Rp, a], [Rp - gd, a], [Rp - gd, b], [Rp, b])
  pts.push([Rp, w], [0, w])
  const r0 = Rp - gd
  return {
    piston: alongX(pts, seg),
    seals: merge(ringX(r0, s.R - 0.0001, gr[0][0], gr[0][1], seg), ringX(r0, s.R - 0.0001, gr[2][0], gr[2][1], seg)),
    wearRing: ringX(r0, s.R - 0.0002, gr[1][0], gr[1][1], seg),
  }
}

/**
 * Rod-end gland (head): sits in the barrel bore from x0 to x1 (the barrel end), with a flange of
 * radius Ro out to x1 + out; rod seal groove near the inner end and a wiper at the outer end.
 */
export function rodGland(s: { rodR: number; R: number; Ro: number; x0: number; x1: number; out: number; segments?: number }) {
  const ri = s.rodR + 0.0006
  const gd = 0.004
  const { x0, x1 } = s
  const x2 = x1 + s.out
  const seg = s.segments ?? 64
  const body = alongX(
    [
      [ri, x0],
      [s.R, x0],
      [s.R, x1],
      [s.Ro, x1],
      [s.Ro, x2],
      [ri + gd, x2],
      [ri + gd, x2 - 0.007],
      [ri, x2 - 0.007],
      [ri, x0 + 0.018],
      [ri + gd, x0 + 0.018],
      [ri + gd, x0 + 0.008],
      [ri, x0 + 0.008],
    ],
    seg,
  )
  return { body, rodSeal: ringX(s.rodR, ri + gd, x0 + 0.008, x0 + 0.018, seg), wiper: ringX(s.rodR, ri + gd, x2 - 0.007, x2, seg) }
}

/**
 * Piston rod along +X from `start` (default 0, the piston's rod face) to `length`, with an
 * optional threaded-on rod eye at the end (`eyePinX` is its pin centre).
 */
export function pistonRod(s: { rodR: number; length: number; start?: number; eye?: EyeSpec | false; segments?: number }) {
  const x0 = s.start ?? 0
  const rod = alongX(
    [
      [0, x0],
      [s.rodR, x0],
      [s.rodR, s.length],
      [0, s.length],
    ],
    s.segments ?? 48,
  )
  if (s.eye === false) return { rod, eye: null, eyePinX: s.length }
  const e = s.eye ?? { len: 0.06, halfH: 0.022, holeR: 0.0105, thick: 0.028 }
  return { rod, eye: xform(clevisEye(e, 1), mat4.t(s.length, 0, 0)), eyePinX: s.length + e.len - e.halfH }
}

/* ------------------------------ three-point linkage ------------------------------ */

/**
 * Adjustable top link (turnbuckle). Each piece in its own frame: `rod` is a unit-length screw rod
 * along +X (scale.x = length), `barrel` the turnbuckle body centred on the origin along X, `eye` a
 * ball-end eye with its pin hole along Z.
 */
export function topLinkParts(s: { rodR?: number; barrelR?: number; barrelLen?: number; eyeR?: number; eyeHole?: number } = {}) {
  return {
    rod: xform(cylinder(s.rodR ?? 0.016, 1, 16), mat4.c(mat4.t(0.5, 0, 0), mat4.rz(PI / 2))),
    barrel: xform(cylinder(s.barrelR ?? 0.03, s.barrelLen ?? 0.26, 20), mat4.rz(PI / 2)),
    eye: xform(tube(s.eyeR ?? 0.032, s.eyeHole ?? 0.014, 0.045, 24), AXIS_Z),
  }
}

/** Telescopic stabiliser: unit-length bar along +X (scale.x = length) and the sleeve over its first `sleeveLen`. */
export function stabiliserParts(s: { r?: number; sleeveR?: number; sleeveLen?: number } = {}) {
  const L = s.sleeveLen ?? 0.3
  return {
    bar: xform(cylinder(s.r ?? 0.014, 1, 16), mat4.c(mat4.t(0.5, 0, 0), mat4.rz(PI / 2))),
    sleeve: xform(cylinder(s.sleeveR ?? 0.022, L, 16), mat4.c(mat4.t(L / 2, 0, 0), mat4.rz(PI / 2))),
  }
}

/* ------------------------------ axial-piston pump / motor ------------------------------ */

/** Axial-piston swashplate unit proportions (m). Defaults: the hydrostatic scene's 53.6 cm³/rev unit. */
export const AXIAL_PISTON = {
  pistons: 9,
  bore: 0.018,
  pitchR: 0.036,
  blockR: 0.058,
  blockZ0: -0.042,
  blockZ1: 0.028,
  swR: 0.062,
  swT: 0.014,
  slipperR: 0.0105,
  slipperT: 0.006,
  pistonL: 0.064,
  pistonR: 0.0088,
  valveZ0: -0.05,
  coverZ0: -0.075,
  bossZ: -0.095,
  portX: 0.035,
  housingR: 0.085,
  housingIn: 0.077,
  housingZ1: 0.09,
  shaftR: 0.014,
}
export type AxialPistonSpec = typeof AXIAL_PISTON

/**
 * Axial-piston swashplate pump or motor (the same unit drives either way). Local frame: shaft axis
 * along Z, shaft out to +Z; the cylinder block between blockZ0 and blockZ1, the valve plate and end
 * cover behind it, the swashplate face at local z = 0 of its own part (place it at the swash z and
 * tilt it). Pistons and slippers are single parts to instance round the pitch circle; `column` is a
 * unit-length oil column for a bore.
 */
export function axialPistonUnit(spec: Partial<AxialPistonSpec> = {}) {
  const D = { ...AXIAL_PISTON, ...spec }
  const { PI } = Math
  const circle = (r: number, n = 48, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => new THREE.Vector2(cx + r * Math.cos((2 * PI * i) / n), cy + r * Math.sin((2 * PI * i) / n)))
  const kidney = (c: number, h: number, r0: number, r1: number, n = 16) => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(r1 * Math.cos(c - h + (2 * h * i) / n), r1 * Math.sin(c - h + (2 * h * i) / n)))
    for (let i = n; i >= 0; i--) pts.push(new THREE.Vector2(r0 * Math.cos(c - h + (2 * h * i) / n), r0 * Math.sin(c - h + (2 * h * i) / n)))
    return pts
  }
  const slab = (outline: THREE.Vector2[], holes: THREE.Vector2[][], z0: number, z1: number) => xform(extrudeTwisted(outline, holes, z1 - z0), mat4.t(0, 0, (z0 + z1) / 2))
  const R = D.pitchR
  const bores = Array.from({ length: D.pistons }, (_, i) => circle(D.bore / 2 + 0.0004, 20, R * Math.cos((2 * PI * i) / D.pistons), R * Math.sin((2 * PI * i) / D.pistons)))
  const block = slab(circle(D.blockR, 64), [...bores, circle(D.shaftR + 0.0005, 24)], D.blockZ0, D.blockZ1)
  const k0 = kidney(0, 1.25, R - 0.0075, R + 0.0075)
  const k1 = kidney(PI, 1.25, R - 0.0075, R + 0.0075)
  const valvePlate = slab(circle(D.blockR + 0.004, 64), [k0, k1, circle(D.shaftR + 0.001, 24)], D.valveZ0, D.blockZ0)
  const kidneyOil = { pos: slab(k0, [], D.valveZ0 + 0.0003, D.blockZ0 - 0.0003), neg: slab(k1, [], D.valveZ0 + 0.0003, D.blockZ0 - 0.0003) }
  const portHole = (s: number) => circle(0.009, 20, s * D.portX, 0)
  const cover = merge(
    slab(circle(D.housingR, 64), [portHole(1), portHole(-1)], D.coverZ0, D.valveZ0),
    ...[1, -1].map((s) => xform(ringZ(0.017, 0.009, D.bossZ, D.coverZ0, 24), mat4.t(s * D.portX, 0, 0))),
  )
  const portOil = {
    pos: xform(shaftZ(0.0087, D.bossZ + 0.0003, D.valveZ0 - 0.0003, 16), mat4.t(D.portX, 0, 0)),
    neg: xform(shaftZ(0.0087, D.bossZ + 0.0003, D.valveZ0 - 0.0003, 16), mat4.t(-D.portX, 0, 0)),
  }
  // housing: a cup open at the back (the end cover closes it), shaft hole in the front wall
  const housing = axial(
    [
      [D.housingIn, D.valveZ0],
      [D.housingR, D.valveZ0],
      [D.housingR, D.housingZ1],
      [0.024, D.housingZ1],
      [0.024, D.housingZ1 - 0.012],
      [D.housingIn, D.housingZ1 - 0.012],
    ],
    64,
  )
  // swashplate: plate face at local z = 0, trunnions along X
  const swash = merge(slab(circle(D.swR, 64), [circle(0.022, 24)], 0, D.swT), xform(cylinder(0.011, 2 * D.housingR + 0.03, 20), mat4.c(mat4.t(0, 0, D.swT / 2), mat4.rz(PI / 2))))
  const lever = merge(xform(cylinder(0.007, 0.1, 12), mat4.t(0, 0.05, 0)), xform(lathe([[0, -0.012], [0.012, -0.006], [0.012, 0.006], [0, 0.012]], 16), mat4.t(0, 0.105, 0)))
  const piston = xform(
    lathe(
      [
        [0, -D.pistonL],
        [D.pistonR, -D.pistonL],
        [D.pistonR, -0.007],
        [0.004, -0.0055],
        [0.0065, -0.0035],
        [0.0068, 0],
        [0.0055, 0.004],
        [0, 0.0066],
      ],
      20,
    ),
    mat4.rx(PI / 2),
  )
  const slipper = shaftZ(D.slipperR, 0, D.slipperT, 20)
  const column = shaftZ(D.bore / 2 - 0.0002, 0, 1, 16)
  /** shaft from the valve plate out to `toZ` */
  const shaft = (toZ: number) => shaftZ(D.shaftR, D.valveZ0 + 0.002, toZ, 24)
  return { block, valvePlate, kidneyOil, cover, portOil, housing, swash, lever, piston, slipper, column, shaft }
}
