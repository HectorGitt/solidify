import * as THREE from 'three'
import {
  box,
  cam,
  csg,
  cylinder,
  extrude,
  lathe,
  mat4,
  merge,
  pipe,
  roundedRect,
  tube,
  xform,
} from '@/geometry'
import { BOWL, CAM_X, CAM_Y, CROWN_TDC, DIM, PUSHROD_X, ROCKER_RATIO, VALVE_TIMING } from './model'
import {
  CRANK_REF,
  bowlGas,
  conRod as libConRod,
  crankshaft as libCrankshaft,
  cylinderLiner,
  flywheel as libFlywheel,
  gasColumn,
  gudgeonPin as libGudgeonPin,
  injector as libInjector,
  lobeLift as libLobeLift,
  piston as libPiston,
  pistonRings,
  pushrod as libPushrod,
  rocker as libRocker,
  rockerPedestal as libRockerPedestal,
  tappet as libTappet,
  timingGears as libTimingGears,
  valve as libValve,
  valveRetainer,
  valveSpring as libValveSpring,
  vPulley,
  type PistonSpec,
} from '@/parts/lib/engine'

const { PI } = Math
export const along = {
  /** rotate a Y-axis solid so its axis lies along Z */
  z: mat4.rx(PI / 2),
  /** rotate a Y-axis solid so its axis lies along X */
  x: mat4.rz(PI / 2),
}

/** Smooth closed curve through points (for ports and manifolds). */
const path = (pts: [number, number, number][], tension = 0.5) =>
  new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(...p)),
    false,
    'catmullrom',
    tension,
  )

/* ---------- ports, shared by the head (as cut-outs) and the flow particles ---------- */

/** Inlet port centre line in HEAD-LOCAL coordinates (head deck at y = 0). */
export const INLET_PORT = path([
  [DIM.valveX, -0.002, DIM.inletZ],
  [DIM.valveX, 0.02, DIM.inletZ],
  [DIM.valveX + 0.02, 0.048, DIM.inletZ + 0.006],
  [0.06, 0.062, DIM.inletZ + 0.01],
  [0.1, 0.064, DIM.inletZ + 0.01],
])

export const EXHAUST_PORT = path([
  [DIM.valveX, -0.002, DIM.exhaustZ],
  [DIM.valveX, 0.018, DIM.exhaustZ],
  [DIM.valveX + 0.022, 0.036, DIM.exhaustZ - 0.006],
  [0.06, 0.042, DIM.exhaustZ - 0.01],
  [0.1, 0.042, DIM.exhaustZ - 0.01],
])

/** Injector axis: tip near the bowl centre, body leaning out towards +X. */
export const INJECTOR = (() => {
  const tilt = (16 * PI) / 180
  const tip = new THREE.Vector3(0.008, 0.002, 0)
  const dir = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0)
  return { tilt, tip, dir }
})()

/* ------------------------------ block ------------------------------ */

export const BLOCK_X0 = -0.108
export const BLOCK_X1 = 0.082
export const BLOCK_Z = 0.07
export const CASE_X = 0.132
export const CASE_Z = 0.08
export const CASE_TOP = 0.13
export const SPLIT_Y = -0.025

function blockGeometry() {
  const upper = xform(box(BLOCK_X1 - BLOCK_X0, CROWN_TDC - CASE_TOP, 2 * BLOCK_Z), mat4.t((BLOCK_X0 + BLOCK_X1) / 2, (CROWN_TDC + CASE_TOP) / 2, 0))
  const lower = xform(box(2 * CASE_X, CASE_TOP - SPLIT_Y, 2 * CASE_Z), mat4.t(0, (CASE_TOP + SPLIT_Y) / 2, 0))
  const shell = csg(lower, [{ op: 'add', geometry: upper }])
  const bore = xform(cylinder(DIM.linerOuter, 0.4, 48), mat4.t(0, CROWN_TDC - 0.1, 0))
  const crankCavity = xform(cylinder(0.112, 0.13, 56), along.z)
  const sumpOpening = xform(box(0.224, 0.06, 0.13), mat4.t(0, SPLIT_Y - 0.01, 0))
  const camCavity = xform(box(0.058, 0.08, 0.13), mat4.t(CAM_X, CAM_Y, 0))
  const camBore = xform(cylinder(0.014, 0.3, 24), mat4.c(mat4.t(CAM_X, CAM_Y, 0), along.z))
  const mainBore = xform(cylinder(0.031, 0.3, 32), along.z)
  const jacket = xform(tube(DIM.jacketOuter, DIM.linerOuter - 0.0005, 0.155, 48), mat4.t(0, CROWN_TDC - 0.0115 - 0.155 / 2, 0))
  const ops = [
    { op: 'sub' as const, geometry: bore },
    { op: 'sub' as const, geometry: crankCavity },
    { op: 'sub' as const, geometry: sumpOpening },
    { op: 'sub' as const, geometry: camCavity },
    { op: 'sub' as const, geometry: camBore },
    { op: 'sub' as const, geometry: mainBore },
    { op: 'sub' as const, geometry: jacket },
  ]
  for (const z of [DIM.inletZ, DIM.exhaustZ]) {
    ops.push({ op: 'sub', geometry: xform(cylinder(0.0095, 0.32, 20), mat4.t(PUSHROD_X, 0.25, z)) })
    ops.push({ op: 'sub', geometry: xform(cylinder(DIM.tappetR + 0.0008, 0.07, 24), mat4.t(PUSHROD_X, CAM_Y + 0.045, z)) })
  }
  return csg(shell, ops)
}

/** Coolant filling the block water jacket. */
export function jacketCoolant() {
  return xform(tube(DIM.jacketOuter - 0.0003, DIM.linerOuter, 0.155 - 0.0006, 48), mat4.t(0, CROWN_TDC - 0.0115 - 0.155 / 2, 0))
}

export function liner() {
  return cylinderLiner({ bore: DIM.bore, outer: DIM.linerOuter, y0: 0.1, y1: CROWN_TDC })
}

/* ------------------------------ head ------------------------------ */

export const HEAD_X0 = BLOCK_X0
export const HEAD_X1 = BLOCK_X1

function headGeometry() {
  const H = DIM.headHeight
  const body = xform(box(HEAD_X1 - HEAD_X0, H, 2 * BLOCK_Z), mat4.t((HEAD_X0 + HEAD_X1) / 2, H / 2, 0))
  const ops: { op: 'sub'; geometry: THREE.BufferGeometry; matrix?: THREE.Matrix4 }[] = []
  ops.push({ op: 'sub', geometry: pipe(INLET_PORT, 0.0165, 0, 40, 20) })
  ops.push({ op: 'sub', geometry: pipe(EXHAUST_PORT, 0.0145, 0, 40, 20) })
  for (const [z, r] of [
    [DIM.inletZ, DIM.inletHeadR],
    [DIM.exhaustZ, DIM.exhaustHeadR],
  ] as const) {
    // valve guide bore and seat recess
    ops.push({ op: 'sub', geometry: xform(cylinder(DIM.valveStemR + 0.0004, 0.2, 20), mat4.t(DIM.valveX, H / 2 + 0.03, z)) })
    ops.push({ op: 'sub', geometry: xform(lathe([[0, -0.01], [r + 0.0005, -0.01], [r + 0.0005, 0.0008], [r - 0.004, 0.006], [0, 0.006]], 40), mat4.t(DIM.valveX, 0, z)) })
    // pushrod passage
    ops.push({ op: 'sub', geometry: xform(cylinder(0.0095, 0.3, 20), mat4.t(PUSHROD_X, H / 2, z)) })
  }
  // injector bore along its tilted axis
  const injM = new THREE.Matrix4().compose(
    INJECTOR.tip.clone().add(INJECTOR.dir.clone().multiplyScalar(0.08)),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), INJECTOR.dir),
    new THREE.Vector3(1, 1, 1),
  )
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0095, 0.17, 24), injM) })
  return csg(body, ops)
}

function gasketGeometry() {
  // unit height plate, scaled to the deck gap
  const outline = roundedRect(HEAD_X1 - HEAD_X0, 2 * BLOCK_Z, 0.004, (HEAD_X0 + HEAD_X1) / 2, 0)
  const hole = new THREE.Path()
  hole.absarc(0, 0, DIM.bore / 2 + 0.001, 0, PI * 2, true)
  outline.holes.push(hole)
  for (const z of [DIM.inletZ, DIM.exhaustZ]) {
    const h = new THREE.Path()
    h.absarc(PUSHROD_X, z, 0.0095, 0, PI * 2, true)
    outline.holes.push(h)
  }
  const g = extrude(outline, 1, { curveSegments: 32 })
  // extruded along Z → lay flat (XZ) with y from 0 to 1
  return xform(g, mat4.c(mat4.t(0, 0.5, 0), mat4.rx(-PI / 2)))
}

function rockerCover() {
  const top = DIM.headHeight
  const h = 0.085
  const outer = xform(box(0.15, h, 2 * BLOCK_Z - 0.004), mat4.t(-0.04, top + h / 2, 0))
  const inner = xform(box(0.14, h, 2 * BLOCK_Z - 0.014), mat4.t(-0.04, top + h / 2 - 0.005, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

/* ------------------------------ valve train ------------------------------ */
/* The engine parts themselves live in the shared library (src/parts/lib/engine.ts); these wrappers
   size them to this engine and keep the names the tractor's engine imports. */

const PISTON: PistonSpec = { bore: DIM.bore, comp: DIM.pistonComp, skirt: DIM.pistonSkirt, bowl: BOWL }

export function valve(headR: number) {
  return libValve({ headR, stemR: DIM.valveStemR, length: DIM.valveTip })
}

/** Spring of unit length along Y (scaled to the live installed length). */
export const SPRING_SEAT = DIM.headHeight
export const SPRING_FREE = DIM.valveTip - 0.012 - DIM.headHeight
export function valveSpring() {
  return libValveSpring()
}

export function retainer() {
  return valveRetainer({ stemR: DIM.valveStemR })
}

export function rocker() {
  // side profile in XY, pivot at origin, pushrod end at −armPush, valve end at +armValve
  return libRocker({ armPush: DIM.rockerArmPush, armValve: DIM.rockerArmValve })
}

function rockerShaft() {
  return xform(cylinder(0.0058, 0.14, 24), along.z)
}

export function rockerPedestal() {
  return libRockerPedestal({ height: DIM.rockerY - DIM.headHeight })
}

export function tappet() {
  return libTappet({ r: DIM.tappetR, h: DIM.tappetH })
}

/** Pushrod of unit length along Y. */
export function pushrod() {
  return libPushrod()
}

/** Lobe profile from the valve-timing curve: cam angle φ ↔ crank angle 2φ. */
export function lobeLift(which: 'inlet' | 'exhaust') {
  return libLobeLift(which, { timing: VALVE_TIMING, rockerRatio: ROCKER_RATIO })
}

function camshaft() {
  const shaft = xform(cylinder(0.0105, 0.235, 24), mat4.c(mat4.t(0, 0, -0.0075), along.z))
  const inlet = xform(cam(DIM.camBase, lobeLift('inlet'), 0.014), mat4.t(0, 0, DIM.inletZ))
  const exhaust = xform(cam(DIM.camBase, lobeLift('exhaust'), 0.014), mat4.t(0, 0, DIM.exhaustZ))
  const journals = [0.065, -0.065].map((z) => xform(cylinder(0.0138, 0.016, 32), mat4.c(mat4.t(0, 0, z), along.z)))
  return { shaft, lobes: merge(inlet, exhaust), journals: merge(...journals) }
}

/* ------------------------------ crank train ------------------------------ */

export function crankshaft() {
  return libCrankshaft({ ...CRANK_REF, r: DIM.crankR }, [{ z: 0, firingDeg: 0 }], 0.124, {
    outerMainLen: 0.066,
    nose: { r: 0.02, len: 0.055, inset: 0.0025 },
    tail: { r: 0.04, t: 0.012, spigotR: 0.03, spigotLen: 0.018 },
  }).geometry
}

/** the shared library flywheel (with its ring gear) at this engine's size */
export function flywheel() {
  return libFlywheel({ r: 0.15 }).disc
}

export function ringGear() {
  // placed by the scene 8 mm behind the flywheel face; the library seats it 10 mm in
  return xform(libFlywheel({ r: 0.15 }).ring, mat4.t(0, 0, 0.002))
}

export function timingGears() {
  return libTimingGears({ module: DIM.timingModule, crankTeeth: DIM.crankTeeth, camTeeth: DIM.camTeeth })
}

export function pulley() {
  return vPulley({ r: 0.072 })
}

export function conRod() {
  return libConRod({ length: DIM.rodL, pinR: CRANK_REF.pinR, gudgeonR: 0.014, width: 0.028 })
}

export function piston() {
  return libPiston(PISTON)
}

export function rings() {
  const r = pistonRings(PISTON)
  return { compression: r.compression, oil: r.oil! }
}

export function gudgeonPin() {
  return libGudgeonPin(PISTON)
}

/** Gas in the bowl (moves with the piston) and a unit-height column above the crown. */
export function gas() {
  return { bowl: bowlGas(BOWL), column: gasColumn(DIM.bore) }
}

/* ------------------------------ injector ------------------------------ */

export function injector() {
  return libInjector()
}

/* ------------------------------ manifolds, sump ------------------------------ */

export const INTAKE_PATH = (headY: number) =>
  path([
    [HEAD_X1 - 0.001, headY + 0.064, DIM.inletZ + 0.01],
    [0.14, headY + 0.07, DIM.inletZ + 0.01],
    [0.165, headY + 0.11, DIM.inletZ + 0.01],
    [0.17, headY + 0.17, DIM.inletZ + 0.01],
  ])

export const EXHAUST_PATH = (headY: number) =>
  path([
    [HEAD_X1 - 0.001, headY + 0.042, DIM.exhaustZ - 0.01],
    [0.145, headY + 0.04, DIM.exhaustZ - 0.02],
    [0.18, headY + 0.0, DIM.exhaustZ - 0.04],
    [0.2, headY - 0.06, DIM.exhaustZ - 0.05],
  ])

function airCleaner() {
  return lathe([[0, 0], [0.05, 0], [0.055, 0.01], [0.055, 0.11], [0.045, 0.125], [0, 0.125]], 48)
}

function sump() {
  const outer = xform(box(2 * CASE_X, 0.15, 2 * CASE_Z), mat4.t(0, SPLIT_Y - 0.075, 0))
  const inner = xform(box(2 * CASE_X - 0.012, 0.15, 2 * CASE_Z - 0.012), mat4.t(0, SPLIT_Y - 0.075 + 0.006, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function sumpOil() {
  return xform(box(2 * CASE_X - 0.0125, 0.05, 2 * CASE_Z - 0.0125), mat4.t(0, SPLIT_Y - 0.15 + 0.006 + 0.025 + 0.0002, 0))
}

/* ------------------------------ build all (cached) ------------------------------ */

/** Heavy, parameter-independent parts — built once, in the geometry worker. */
export function buildStatic() {
  const cs = camshaft()
  return {
    block: blockGeometry(),
    coolant: jacketCoolant(),
    liner: liner(),
    head: headGeometry(),
    gasket: gasketGeometry(),
    rockerCover: rockerCover(),
    inletValve: valve(DIM.inletHeadR),
    exhaustValve: valve(DIM.exhaustHeadR),
    spring: valveSpring(),
    retainer: retainer(),
    rocker: rocker(),
    rockerShaft: rockerShaft(),
    pedestal: rockerPedestal(),
    tappet: tappet(),
    pushrod: pushrod(),
    camshaft: cs.shaft,
    camLobes: cs.lobes,
    camJournals: cs.journals,
    crankshaft: crankshaft(),
    flywheel: flywheel(),
    ringGear: ringGear(),
    timing: timingGears(),
    pulley: pulley(),
    rod: conRod(),
    piston: piston(),
    rings: rings(),
    pin: gudgeonPin(),
    gas: gas(),
    injector: injector(),
    airCleaner: airCleaner(),
    sump: sump(),
    oil: sumpOil(),
  }
}

export type StaticEngineGeometry = ReturnType<typeof buildStatic>

/** Cheap parts that depend on the head position (compression ratio) — built on the main thread. */
export const dynamicParts = {
  intakePipe: (headY: number) => pipe(INTAKE_PATH(headY), 0.019, 0.016, 40, 24),
  exhaustPipe: (headY: number) => pipe(EXHAUST_PATH(headY), 0.017, 0.014, 40, 24),
  hpPipe: (from: THREE.Vector3) =>
    pipe(new THREE.CatmullRomCurve3([from, from.clone().add(new THREE.Vector3(0.03, 0.02, 0)), new THREE.Vector3(0.2, from.y + 0.03, 0.04)]), 0.0032, 0.0012, 24, 10),
}

let ready: StaticEngineGeometry | null = null

/** Resolve the static geometry (worker) before the scene mounts. */
export async function prepareEngineGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/four-stroke', buildStatic)
  return ready
}

/** Geometry for rendering; builds synchronously if prepare() was skipped (e.g. tests). */
export function buildEngineGeometry(): StaticEngineGeometry & typeof dynamicParts {
  if (!ready) ready = buildStatic()
  return { ...ready, ...dynamicParts }
}
