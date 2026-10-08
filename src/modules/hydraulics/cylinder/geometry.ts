import * as THREE from 'three'
import { box, csg, cylinder, extrude, lathe, mat4, merge, xform, type V2 } from '@/geometry'
import { BARREL_IN, BARREL_LEN, DIM, PORT_CAP_X, PORT_ROD_X, REF_R, REF_RO, VALVE } from './model'

const { PI } = Math
/** lathe solids are built along +Y; this turns +Y into +X (the cylinder axis) */
const AXIS_X = mat4.rz(-PI / 2)

/** Lathe a profile whose "y" is the position along the cylinder axis. */
const alongX = (profile: V2[], seg = 64) => xform(lathe(profile, seg), AXIS_X)

/** Eye (tongue with a pin hole) in the XY plane, extruded along Z. Tongue runs from x = 0 towards `dir`. */
function eye(len: number, halfH: number, holeR: number, thick: number, dir: 1 | -1) {
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

/** Barrel with welded port bosses, drilled through to the bore (reference bore). */
function barrel() {
  const tubeGeo = alongX([
    [REF_R, 0],
    [REF_RO, 0],
    [REF_RO, BARREL_LEN],
    [REF_R, BARREL_LEN],
  ])
  const boss = (x: number) => xform(cylinder(DIM.portBossR, DIM.portBossH + DIM.wall, 32), mat4.t(x, REF_RO + DIM.portBossH / 2 - DIM.wall / 2, 0))
  const hole = (x: number) => xform(cylinder(DIM.portR, DIM.portBossH + DIM.wall * 3, 24), mat4.t(x, REF_RO, 0))
  return csg(tubeGeo, [
    { op: 'add', geometry: boss(PORT_CAP_X) },
    { op: 'add', geometry: boss(PORT_ROD_X) },
    { op: 'sub', geometry: hole(PORT_CAP_X) },
    { op: 'sub', geometry: hole(PORT_ROD_X) },
  ])
}

/** Welded cap end with the cap-end clevis eye. */
function capEnd() {
  const cap = alongX([
    [0, -DIM.capT],
    [REF_RO, -DIM.capT],
    [REF_RO, 0],
    [0, 0],
  ])
  const lug = xform(eye(0.058, 0.022, 0.0105, 0.03, -1), mat4.t(-DIM.capT, 0, 0))
  return merge(cap, lug)
}

export const CAP_PIN_X = -DIM.capT - 0.058 + 0.022

/** Piston with two seal grooves and a wear-ring groove between them (reference bore). */
const GROOVES: [number, number][] = [
  [0.006, 0.014],
  [0.019, 0.027],
  [0.032, 0.04],
]
const GROOVE_D = 0.0045

function piston() {
  const R = REF_R - 0.0004
  const pts: V2[] = [
    [0, 0],
    [R, 0],
  ]
  for (const [a, b] of GROOVES) pts.push([R, a], [R - GROOVE_D, a], [R - GROOVE_D, b], [R, b])
  pts.push([R, DIM.pistonW], [0, DIM.pistonW])
  return alongX(pts, 72)
}

function ring(r0: number, r1: number, y0: number, y1: number, seg = 72) {
  return alongX(
    [
      [r0, y0],
      [r1, y0],
      [r1, y1],
      [r0, y1],
    ],
    seg,
  )
}

function pistonSeals() {
  const r0 = REF_R - 0.0004 - GROOVE_D
  return merge(ring(r0, REF_R - 0.0001, GROOVES[0][0], GROOVES[0][1]), ring(r0, REF_R - 0.0001, GROOVES[2][0], GROOVES[2][1]))
}

function wearRing() {
  const r0 = REF_R - 0.0004 - GROOVE_D
  return ring(r0, REF_R - 0.0002, GROOVES[1][0], GROOVES[1][1])
}

/** Unit cylinder along +X from x = 0 to 1, radius 1 (cap-end oil, scaled every frame). */
function unitOil() {
  return xform(xform(cylinder(1, 1, 64), mat4.t(0, 0.5, 0)), AXIS_X)
}

/** Spool-valve body: bore along Y, ports A/B on the cylinder side (+X), P/T on the other (−X). */
function valveBody() {
  const body = box(0.05, VALVE.h, 0.042)
  const port = (y: number, side: 1 | -1) => ({ op: 'sub' as const, geometry: xform(cylinder(0.0055, 0.03, 20), mat4.c(mat4.t(side * 0.016, y, 0), AXIS_X)) })
  return csg(body, [
    { op: 'sub', geometry: cylinder(0.0092, VALVE.h + 0.02, 40) },
    port(VALVE.portA, 1),
    port(VALVE.portB, 1),
    port(VALVE.portP, -1),
    port(VALVE.portT, -1),
    port(VALVE.portT + 0.12, -1),
  ])
}

/** Closed-centre spool: lands cover ports A and B in the centre position; end lands seal the bore. */
function spool() {
  const r = 0.0089
  const s = 0.0048
  const prof: V2[] = [
    [0, -0.075],
    [r, -0.075],
    [r, -0.068],
    [s, -0.068],
    [s, -0.03],
    [r, -0.03],
    [r, -0.01],
    [s, -0.01],
    [s, 0.03],
    [r, 0.03],
    [r, 0.05],
    [s, 0.05],
    [s, 0.068],
    [r, 0.068],
    [r, 0.075],
    [0.004, 0.075],
    [0.004, 0.12],
    [0, 0.12],
  ]
  return lathe(prof, 32)
}

/** Heavy / parameter-independent parts — built once, in the geometry worker. */
export function buildStatic() {
  return {
    barrel: barrel(),
    cap: capEnd(),
    piston: piston(),
    seals: pistonSeals(),
    wearRing: wearRing(),
    unitOil: unitOil(),
    pin: cylinder(0.0098, 0.05, 24).rotateX(PI / 2),
    valveBody: valveBody(),
    spool: spool(),
  }
}

export type StaticCylGeometry = ReturnType<typeof buildStatic>

/* ---------------- cheap parts that depend on bore / rod — built on the main thread ---------------- */

export function glandParts(rodR: number, boreR: number, boreRo: number) {
  const ri = rodR + 0.0006
  const gd = 0.004
  const y0 = BARREL_IN
  const y1 = BARREL_LEN
  const y2 = BARREL_LEN + DIM.glandOut
  const body = alongX([
    [ri, y0],
    [boreR, y0],
    [boreR, y1],
    [boreRo, y1],
    [boreRo, y2],
    [ri + gd, y2],
    [ri + gd, y2 - 0.007],
    [ri, y2 - 0.007],
    [ri, y0 + 0.018],
    [ri + gd, y0 + 0.018],
    [ri + gd, y0 + 0.008],
    [ri, y0 + 0.008],
  ])
  const rodSeal = ring(rodR, ri + gd, y0 + 0.008, y0 + 0.018)
  const wiper = ring(rodR, ri + gd, y2 - 0.007, y2)
  return { body, rodSeal, wiper }
}

/** Rod (from the piston's rod face, local x = 0) with its threaded-on rod eye. */
export function rodParts(rodR: number, rodLen: number) {
  const rod = alongX(
    [
      [0, 0],
      [rodR, 0],
      [rodR, rodLen],
      [0, rodLen],
    ],
    48,
  )
  const eyeGeo = xform(eye(0.06, 0.022, 0.0105, 0.028, 1), mat4.t(rodLen, 0, 0))
  return { rod, eye: eyeGeo, eyePinX: rodLen + 0.06 - 0.022 }
}

/** Annulus oil around the rod: unit length along +X. */
export function annulusOil(rodR: number, boreR: number) {
  return alongX(
    [
      [rodR + 0.0002, 0],
      [boreR - 0.0002, 0],
      [boreR - 0.0002, 1],
      [rodR + 0.0002, 1],
    ],
    64,
  )
}

let ready: StaticCylGeometry | null = null

export async function prepareCylinderGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('hydraulics/cylinder', buildStatic)
  return ready
}

export function buildCylinderGeometry(): StaticCylGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
