import * as THREE from 'three'
import { box, csg, cylinder, extrude, lathe, mat4, merge, pipe, roundedBox, tube, xform, type CsgOp, type V2 } from '@/geometry'
import { conRodOnePiece, crankshaft as libCrankshaft, flywheel as libFlywheel, gasColumn, pistonAssembly, type PistonSpec } from '@/parts/lib/engine'
import { sparkPlug as libSparkPlug } from '@/parts/lib/electrical'
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

/** Built-up crank: full-circle disc webs with lightening holes, pressed-in pin, stub shafts. */
function crankshaft() {
  return libCrankshaft({ r: DIM.crankR, pinR: 0.0082, journalR: 0.0075, webT: 0.01, cwR: 0.036, pinLen: 0.013, web: 'disc' }, [{ z: 0, firingDeg: 0 }], 0.05, {
    outerMainLen: 0.06,
    nose: null,
    tail: null,
  }).geometry
}

/** Two compression rings, no oil ring (the petroil mist lubricates); pin 12 mm. */
const PISTON: PistonSpec = {
  bore: DIM.bore,
  comp: DIM.pistonComp,
  skirt: DIM.pistonSkirt,
  clearance: 0.0002,
  pinR: 0.006,
  crownT: 0.006,
  wall: 0.003,
  grooves: [
    [0.0095, 0.0016],
    [0.0045, 0.0016],
  ],
  grooveDepth: 0.0021,
  bowl: null,
  slotW: 0.0125,
  oilRing: false,
}

function piston() {
  const p = pistonAssembly(PISTON)
  // deflector ridge across the crown: steep face towards the transfer port (−X), ramp towards the exhaust
  const s = new THREE.Shape()
  s.moveTo(-0.012, 0)
  s.lineTo(0.012, 0)
  s.lineTo(-0.008, DIM.deflectorH)
  s.lineTo(-0.012, DIM.deflectorH)
  const deflector = xform(extrude(s, 0.04, { curveSegments: 4 }), mat4.t(0, DIM.pistonComp - 0.0002, 0))
  return { body: p.body, deflector, pin: p.pin, rings: p.rings.compression }
}

/** Flywheel magneto: the library flywheel (ring gear for the electric starter) with fan vanes and the magnet. */
function flywheel() {
  const fw = libFlywheel({ r: 0.068, width: 0.018, boreR: 0.0075, ringModule: 0.0015, ringWidth: 0.007 })
  // fan vanes on the outer face (air-cooled engines: the flywheel doubles as the fan, TB ch.7)
  const vanes: THREE.BufferGeometry[] = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2
    vanes.push(xform(box(0.034, 0.011, 0.0025), mat4.c(mat4.ry(-a), mat4.t(0.039, 0.0125, 0))))
  }
  // vanes stand in the dished outer face, between hub and rim
  const fan = merge(...vanes)
  // flywheel-magneto magnet let into the rim (TB p29: on single-cylinder engines the magneto is built into the flywheel)
  const magnet = xform(box(0.018, 0.014, 0.006), mat4.t(0, 0.009, 0.0645))
  return {
    disc: fw.disc,
    ring: fw.ring,
    fan: xform(fan, mat4.rx(-PI / 2)),
    magnet: xform(magnet, mat4.rx(-PI / 2)),
  }
}

/* ------------------------------ ignition ------------------------------ */

export const PLUG_GAP = 0.0006

function sparkPlug() {
  // local y = 0 at the head face; electrodes below, terminal above
  return libSparkPlug({ seat: 0.01, gap: PLUG_GAP })
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

function gasCol() {
  return gasColumn(DIM.bore, { clearance: 0.0003, segments: 48 })
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
    rod: conRodOnePiece({ length: DIM.rodL, pinR: 0.0082, gudgeonR: 0.006, width: 0.011 }),
    piston: piston(),
    flywheel: flywheel(),
    plug: sparkPlug(),
    coil: magnetoCoil(),
    induction: induction(),
    exhaust: exhaust(),
    tank: tank(),
    gas: gasCol(),
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
