import * as THREE from 'three'
import { box, csg, cylinder, extrude, lathe, mat4, merge, pipe, roundedBox, tube, xform, type CsgOp, type V2 } from '@/geometry'
import { conRod } from '../multi-cylinder/crank'
import { DIM, HEAD_Y, PORT_Y, SKIRT_TDC } from './model'

/**
 * Two-stroke engine geometry (worker-safe). Frame: Y up, crank axis Z, crank centre at origin.
 * Exhaust +X, transfer −X, inlet at the back (−Z).
 */

const { PI } = Math
const alongZ = mat4.rx(PI / 2)
const R = DIM.bore / 2
const CASE_TOP = DIM.barrelY0 - 0.0002
const CASE_HALF = 0.0375
const HEAD_H = 0.03

const path = (pts: [number, number, number][], closed = false) =>
  new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(...p)),
    closed,
    'catmullrom',
    0.5,
  )

/* ------------------------------ cylinder barrel ------------------------------ */

function finnedProfile(r0: number, y0: number, y1: number, core: number, fin: number, first: number, pitch: number, t: number, flange?: [number, number]): V2[] {
  const prof: V2[] = [[r0, y0]]
  if (flange) {
    prof.push([flange[0], y0], [flange[0], y0 + flange[1]], [core, y0 + flange[1]])
  } else prof.push([core, y0])
  for (let y = first; y + t < y1 - 0.002; y += pitch) prof.push([core, y], [fin, y + 0.0006], [fin, y + t - 0.0006], [core, y + t])
  prof.push([core, y1], [r0, y1])
  return prof
}

function barrel() {
  const y0 = DIM.barrelY0
  const y1 = HEAD_Y - 0.0003
  const body = lathe(finnedProfile(R, y0, y1, DIM.coreR, DIM.finR, y0 + 0.012, 0.0072, 0.0026, [0.056, 0.006]), 64)
  const ex = PORT_Y.exhaust
  const tr = PORT_Y.transfer
  const inl = PORT_Y.inlet
  const ops: CsgOp[] = [
    // exhaust port window and duct (+X)
    { op: 'sub', geometry: xform(box(0.06, ex[1] - ex[0], 0.028), mat4.t(0.048, (ex[0] + ex[1]) / 2, 0)) },
    // transfer passage in the −X wall, open to the crankcase below
    { op: 'sub', geometry: xform(box(0.0135, tr[1] - y0 + 0.004, 0.026), mat4.t(-0.0362, (tr[1] + y0 - 0.004) / 2, 0)) },
    // transfer port window into the bore
    { op: 'sub', geometry: xform(box(0.012, tr[1] - tr[0], 0.026), mat4.t(-0.026, (tr[0] + tr[1]) / 2, 0)) },
    // inlet port and duct (−Z), uncovered by the piston skirt
    { op: 'sub', geometry: xform(box(0.022, inl[1] - inl[0], 0.06), mat4.t(0, (inl[0] + inl[1]) / 2, -0.048)) },
  ]
  return csg(body, ops)
}

function head() {
  // local y = 0 at the head face; central 14 mm spark-plug hole
  return lathe(finnedProfile(0.0072, 0, HEAD_H, DIM.coreR, DIM.finR + 0.004, 0.006, 0.0072, 0.0026), 64)
}

/* ------------------------------ crankcase ------------------------------ */

function crankcaseFull() {
  const s = new THREE.Shape()
  const Rc = 0.056
  const a = Math.atan2(Math.sqrt(Rc * Rc - 0.05 * 0.05), 0.05)
  s.moveTo(0.05, CASE_TOP)
  s.lineTo(0.05, Rc * Math.sin(a))
  s.absarc(0, 0, Rc, a, PI - a - 2 * PI, true)
  s.lineTo(-0.05, CASE_TOP)
  const body = extrude(s, 2 * CASE_HALF, { curveSegments: 40 })
  return csg(body, [
    { op: 'sub', geometry: xform(cylinder(0.042, 0.046, 56), alongZ) },
    { op: 'sub', geometry: xform(cylinder(0.0285, 0.07, 40), mat4.t(0, 0.035, 0)) },
    { op: 'sub', geometry: xform(box(0.0135, 0.05, 0.026), mat4.t(-0.0362, 0.04, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.0115, 0.2, 32), alongZ) },
  ])
}

function crankcaseHalves() {
  const full = crankcaseFull()
  const half = (sign: number) => csg(full, [{ op: 'and', geometry: xform(box(0.2, 0.2, CASE_HALF + 0.01), mat4.t(0, 0, sign * (CASE_HALF + 0.01) / 2 + sign * 0.0001)) }])
  return { front: half(1), back: half(-1) }
}

/* ------------------------------ moving parts ------------------------------ */

function crankshaft() {
  const web = xform(cylinder(0.036, 0.01, 56), alongZ)
  const pin = xform(cylinder(0.0082, 0.0135, 32), mat4.c(mat4.t(0, DIM.crankR, 0), alongZ))
  const shaftL = xform(cylinder(0.0075, 0.06, 32), mat4.c(mat4.t(0, 0, -0.0465), alongZ))
  const shaftR = xform(cylinder(0.0075, 0.06, 32), mat4.c(mat4.t(0, 0, 0.0465), alongZ))
  // lightening holes on the pin side of each full-circle web balance the throw
  const holes = (z: number) => merge(...[0.021, -0.021].map((x) => xform(cylinder(0.006, 0.02, 24), mat4.c(mat4.t(x, 0.012, z), alongZ))))
  const webs = [0.0115, -0.0115].map((z) => csg(xform(web, mat4.t(0, 0, z)), [{ op: 'sub', geometry: holes(z) }]))
  return merge(...webs, pin, shaftL, shaftR)
}

function piston() {
  const Rp = R - 0.0002
  const top = DIM.pistonComp
  const bottom = -DIM.pistonSkirt
  const d = 0.0021
  const grooves: [number, number][] = [
    [top - 0.0045, 0.0016],
    [top - 0.0095, 0.0016],
  ]
  const prof: V2[] = [
    [0, top - 0.006],
    [Rp - 0.0035, top - 0.0075],
    [Rp - 0.0028, bottom],
    [Rp, bottom],
  ]
  for (const [gy, w] of grooves) prof.push([Rp, gy - w / 2], [Rp - d, gy - w / 2], [Rp - d, gy + w / 2], [Rp, gy + w / 2])
  prof.push([Rp, top], [0, top])
  const body = lathe(prof, 64)
  // deflector ridge across the crown: steep face towards the transfer port (−X), ramp towards the exhaust
  const s = new THREE.Shape()
  s.moveTo(-0.012, 0)
  s.lineTo(0.012, 0)
  s.lineTo(-0.008, DIM.deflectorH)
  s.lineTo(-0.012, DIM.deflectorH)
  const deflector = xform(extrude(s, 0.04, { curveSegments: 4 }), mat4.t(0, top - 0.0002, 0))
  const pin = xform(tube(0.006, 0.0035, 2 * (Rp - 0.0006), 24), alongZ)
  const rings = merge(...grooves.map(([gy, w]) => lathe([[R - 0.0019, gy - w / 2 + 0.0001], [R - 0.00005, gy - w / 2 + 0.0001], [R - 0.00005, gy + w / 2 - 0.0001], [R - 0.0019, gy + w / 2 - 0.0001]], 64)))
  return { body, deflector, pin, rings }
}

function flywheel() {
  const disc = lathe([[0.008, 0], [0.068, 0], [0.068, 0.018], [0.06, 0.018], [0.058, 0.006], [0.02, 0.006], [0.016, 0.012], [0.008, 0.012]], 72)
  // fan vanes on the outer face (air-cooled engines: the flywheel doubles as the fan, TB ch.7)
  const vanes: THREE.BufferGeometry[] = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2
    vanes.push(xform(box(0.034, 0.012, 0.0025), mat4.c(mat4.ry(-a), mat4.t(0.039, 0.012, 0))))
  }
  // vanes stand in the dished outer face, between hub and rim
  const fan = merge(...vanes)
  // flywheel-magneto magnet let into the rim (TB p29: on single-cylinder engines the magneto is built into the flywheel)
  const magnet = xform(box(0.018, 0.014, 0.006), mat4.t(0, 0.009, 0.0655))
  return {
    disc: xform(disc, mat4.rx(-PI / 2)),
    fan: xform(fan, mat4.rx(-PI / 2)),
    magnet: xform(magnet, mat4.rx(-PI / 2)),
  }
}

/* ------------------------------ ignition ------------------------------ */

export const PLUG_GAP = 0.0006

function sparkPlug() {
  // local y = 0 at the head face; electrodes below, terminal above
  const body = lathe([[0.0042, -0.0002], [0.007, -0.0002], [0.007, 0.031], [0.0056, 0.031], [0.0056, 0.0005], [0.0042, 0.0005]], 32)
  const hex = lathe([[0.0056, 0.031], [0.0105, 0.031], [0.0105, 0.041], [0.0065, 0.0435], [0.0056, 0.0435]], 6)
  const shell = merge(body, hex)
  const insulator = lathe([[0.0011, -0.0001], [0.0028, 0.0], [0.004, 0.006], [0.0053, 0.03], [0.0054, 0.0435], [0.0054, 0.066], [0.0035, 0.069], [0.0011, 0.069]], 32)
  const centre = lathe([[0, -0.0018], [0.0011, -0.0018], [0.0011, 0.07], [0, 0.07]], 16)
  const terminal = lathe([[0, 0.069], [0.0028, 0.069], [0.0028, 0.077], [0, 0.077]], 16)
  const tip = -0.0018
  const g1 = xform(box(0.0016, 0.0024, 0.0024), mat4.t(-0.0049, -0.0012, 0))
  const g2 = xform(box(0.0062, 0.0014, 0.0024), mat4.t(-0.0024, tip - 0.0006 - PLUG_GAP - 0.0002, 0))
  return { shell, insulator, centre: merge(centre, terminal), ground: merge(g1, g2), sparkY: tip - PLUG_GAP / 2 }
}

function magnetoCoil() {
  const core = box(0.012, 0.03, 0.01)
  const coil = xform(tube(0.012, 0.0062, 0.016, 24), mat4.t(0, 0.004, 0))
  return { core, coil }
}

/* ------------------------------ induction & exhaust ------------------------------ */

const INLET_Y = (PORT_Y.inlet[0] + PORT_Y.inlet[1]) / 2
const EX_Y = (PORT_Y.exhaust[0] + PORT_Y.exhaust[1]) / 2

export const EXHAUST_CURVE = path([
  [0.072, EX_Y, 0],
  [0.092, EX_Y, 0],
  [0.114, EX_Y - 0.012, 0.012],
  [0.124, EX_Y - 0.036, 0.02],
])
export const MUFFLER_AT: [number, number, number] = [0.124, 0.022, 0.02]

function induction() {
  const duct = pipe(new THREE.LineCurve3(new THREE.Vector3(0, INLET_Y, -0.074), new THREE.Vector3(0, INLET_Y, -0.098)), 0.012, 0.009, 4, 24)
  const carb = merge(
    xform(tube(0.016, 0.009, 0.04, 32), mat4.c(mat4.t(0, INLET_Y, -0.118), alongZ)),
    xform(lathe([[0, 0], [0.016, 0], [0.018, 0.004], [0.018, 0.0298], [0, 0.0298]], 32), mat4.t(0, INLET_Y - 0.046, -0.118)),
  )
  const filter = xform(lathe([[0, 0], [0.036, 0], [0.038, 0.004], [0.038, 0.022], [0.036, 0.026], [0, 0.026]], 48), mat4.c(mat4.t(0, INLET_Y, -0.164), alongZ))
  return { duct, carb, filter }
}

function exhaust() {
  const stub = pipe(EXHAUST_CURVE, 0.0105, 0.0085, 32, 20)
  const muffler = xform(lathe([[0, 0], [0.026, 0], [0.028, 0.006], [0.028, 0.064], [0.026, 0.07], [0.004, 0.07], [0, 0.07]], 40), mat4.t(...MUFFLER_AT))
  return { stub, muffler }
}

export const TANK_AT: [number, number, number] = [-0.075, 0.215, -0.04]

function tank() {
  const outer = roundedBox(0.1, 0.06, 0.09, 0.012)
  const inner = roundedBox(0.094, 0.054, 0.084, 0.009)
  const shell = csg(outer, [{ op: 'sub', geometry: inner }])
  const petroil = xform(box(0.0935, 0.034, 0.0835), mat4.t(0, -0.0094, 0))
  const cap = xform(cylinder(0.012, 0.008, 24), mat4.t(0.025, 0.033, 0))
  const line = pipe(
    path([
      [-0.075 + 0.03, 0.215 - 0.033, -0.06],
      [-0.03, 0.15, -0.1],
      [0.018, INLET_Y - 0.034, -0.118],
    ]),
    0.0028,
    0.0016,
    32,
    10,
  )
  return { shell, petroil, cap, line }
}

/* ------------------------------ fluids & flow paths ------------------------------ */

function gasColumn() {
  return lathe([[0, 0], [R - 0.0003, 0], [R - 0.0003, 1], [0, 1]], 48)
}

export const INLET_FLOW = path([
  [0, INLET_Y, -0.166],
  [0, INLET_Y, -0.12],
  [0, INLET_Y, -0.08],
  [0, INLET_Y, -0.03],
  [0, INLET_Y - 0.012, -0.008],
  [0.006, 0.045, 0.004],
  [0.02, 0.012, 0.016],
  [0.03, -0.016, 0.018],
])

export const TRANSFER_FLOW = path([
  [0.0, -0.034, 0.018],
  [-0.03, -0.016, 0.019],
  [-0.036, 0.024, 0.0],
  [-0.036, 0.07, 0.0],
  [-0.035, (PORT_Y.transfer[0] + PORT_Y.transfer[1]) / 2, 0],
  [-0.02, (PORT_Y.transfer[0] + PORT_Y.transfer[1]) / 2 + 0.002, 0],
  [-0.014, HEAD_Y - 0.03, 0.004],
  [-0.004, HEAD_Y - 0.006, 0.004],
  [0.012, HEAD_Y - 0.012, 0.002],
  [0.018, EX_Y + 0.02, 0],
])

export const EXHAUST_FLOW = path([
  [0.004, HEAD_Y - 0.01, -0.004],
  [0.016, EX_Y + 0.012, -0.003],
  [0.03, EX_Y, 0],
  [0.06, EX_Y, 0],
  [0.092, EX_Y, 0],
  [0.114, EX_Y - 0.012, 0.012],
  [0.124, EX_Y - 0.036, 0.02],
  [0.124, 0.05, 0.02],
])

/** Petroil mist swirling round the crank and up under the piston. */
export const MIST_FLOW = (() => {
  const pts: [number, number, number][] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2
    const z = i % 2 ? 0.019 : -0.019
    pts.push([0.039 * Math.cos(a), 0.039 * Math.sin(a), z])
    if (i === 4) pts.push([0.006, 0.055, 0.0], [-0.006, 0.05, 0.0])
  }
  return path(pts, true)
})()

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  const cc = crankcaseHalves()
  return {
    barrel: barrel(),
    head: head(),
    caseFront: cc.front,
    caseBack: cc.back,
    bearings: merge(...[0.03, -0.03].map((z) => xform(tube(0.0113, 0.0076, 0.011, 32), mat4.c(mat4.t(0, 0, z), alongZ)))),
    crank: crankshaft(),
    rod: conRod(DIM.rodL, 0.0084, 0.0061, 0.011),
    piston: piston(),
    flywheel: flywheel(),
    plug: sparkPlug(),
    coil: magnetoCoil(),
    induction: induction(),
    exhaust: exhaust(),
    tank: tank(),
    gas: gasColumn(),
  }
}

export type TwoStrokeGeometry = ReturnType<typeof buildStatic>

let ready: TwoStrokeGeometry | null = null

export async function prepareTwoStrokeGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/two-stroke', buildStatic)
  return ready
}

export function getTwoStrokeGeometry(): TwoStrokeGeometry {
  if (!ready) ready = buildStatic()
  return ready
}

export { HEAD_H, SKIRT_TDC }
