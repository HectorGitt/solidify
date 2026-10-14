import * as THREE from 'three'
import { box, cam, csg, cylinder, extrude, lathe, mat4, merge, pipe, tube, xform, type V2 } from '@/geometry'
import { beltBand, loopPath } from '@/geometry/parts'
import { FIRING, FLOOR, FLY_C, GEAR_MODULE, HEAD_TOP, PINION_TEETH, PLUG_X, PLUG_Z, RING_TEETH, STARTER_C } from './model'
import { alternator as alternatorLib, battery, dynamo as dynamoLib, sparkPlug as sparkPlugLib, starterMotor, wireTurns } from '@/parts/lib/electrical'
import { flywheel, vPulley } from '@/parts/lib/engine'
export { battery }
/** the bench alternator, with its pulley on the belt line */
export const alternator = () => alternatorLib({ pulleyR: R_ALT, pulleyZ: PULLEY_Z - 0.009 - 0.016 })

/**
 * Ignition, starting and charging hardware (worker-safe). Every assembly stands on y = FLOOR.
 * Sizes are typical for a tractor petrol/diesel engine; the notes give the circuits, turns and
 * gaps but not component dimensions.
 */

const { PI } = Math
const alongZ = mat4.rx(PI / 2)
const alongX = mat4.rz(-PI / 2)

const turns = wireTurns

/* ------------------------------ shared: spark plug ------------------------------ */

/** Plug with local y = 0 at the end of the thread; `seat` = where the insulator nose meets the shell (nose length). */
export function sparkPlug(seat: number) {
  return sparkPlugLib({ seat })
}

/* ------------------------------ (a) coil ignition ------------------------------ */

export const DIST: [number, number, number] = [0.135, 0, 0]
export const COIL_P: [number, number, number] = [0.215, -0.05, 0]
export const BATT: [number, number, number] = [0.37, FLOOR + 0.085, 0.08]
export const DASH: [number, number, number] = [0.37, 0.1, -0.12]
export const CAP_R = 0.0235
/** distributor-cap electrode angle (rad, about +Y from +X) for cylinder c (1-based): rotor angle at its spark */
export const capAngle = (c: number) => ((FIRING[c - 1] / 2) * PI) / 180

/** breaker-cam lift for the 4-corner cam (L4): flat-follower lift vs cam angle (rad); dwell ≈ 60 % */
export function camLift(phi: number) {
  const c0 = Math.cos(4 * (0.4 * PI / 4))
  return 0.0006 * Math.max(0, (Math.cos(4 * phi) - c0) / (1 - c0)) ** 1.5
}

export function coilIgnition() {
  const block = xform(box(0.16, 0.2, 0.4), mat4.t(0, FLOOR + 0.1, 0))
  const holes = merge(...PLUG_Z.map((z) => xform(cylinder(0.0072, 0.2, 24), mat4.t(PLUG_X, 0, z))))
  const chambers = merge(...PLUG_Z.map((z) => xform(cylinder(0.016, 0.02, 32), mat4.t(PLUG_X - 0.004, -0.04, z))))
  const head = csg(xform(box(0.15, 0.07, 0.38), mat4.t(0, -0.015, 0)), [
    { op: 'sub', geometry: holes },
    { op: 'sub', geometry: chambers },
  ])
  const cover = xform(box(0.07, 0.035, 0.36), mat4.t(-0.036, HEAD_TOP + 0.0175, 0))
  // distributor (local: x, z about the shaft; y up from the body top at 0)
  const body = lathe([[0.0056, -0.15], [0.012, -0.15], [0.012, -0.062], [0.03, -0.06], [0.03, 0], [0.027, 0], [0.027, -0.052], [0.0056, -0.052]], 48)
  const bracket = xform(box(0.05, 0.018, 0.024), mat4.t(-0.032, -0.11, 0))
  const shaft = xform(cylinder(0.005, 0.157, 20), mat4.t(0, -0.0715, 0))
  const plate = xform(tube(0.026, 0.0062, 0.003, 40), mat4.t(0, -0.049, 0))
  const breakerCam = xform(cam(0.0075, camLift, 0.008), mat4.c(mat4.t(0, -0.034, 0), mat4.rx(-PI / 2)))
  const fixedContact = merge(xform(box(0.004, 0.008, 0.005), mat4.t(0.00825, -0.034, 0.0125)), xform(box(0.004, 0.008, 0.005), mat4.t(0.00825, -0.042, 0.0125)))
  // moving arm, pivot at (0.013, z −0.017); contact faces −X
  const arm = merge(
    xform(box(0.0025, 0.007, 0.031), mat4.t(0, 0, 0.0155)),
    xform(box(0.003, 0.006, 0.005), mat4.t(-0.0039, 0, 0.017)),
    xform(box(0.0015, 0.004, 0.004), mat4.t(-0.002, 0, 0.0295)),
  )
  const pivot = xform(cylinder(0.0018, 0.014, 12), mat4.t(0.013, -0.042, -0.017))
  const condenser = lathe([[0, 0], [0.008, 0], [0.008, 0.028], [0.0025, 0.03], [0, 0.03]], 24)
  const cap = lathe([[0.027, 0.0002], [0.031, 0.0002], [0.031, 0.028], [0.022, 0.041], [0.0085, 0.044], [0.0085, 0.056], [0.0042, 0.056], [0.0042, 0.039], [0.019, 0.036], [0.027, 0.026]], 48)
  const towers = merge(...[1, 2, 3, 4].map((c) => xform(tube(0.0048, 0.0028, 0.011, 16), mat4.t(CAP_R * Math.cos(capAngle(c)), 0.0475, -CAP_R * Math.sin(capAngle(c))))))
  const segments = merge(
    ...[1, 2, 3, 4].map((c) => xform(cylinder(0.0017, 0.03, 10), mat4.t(CAP_R * Math.cos(capAngle(c)), 0.024, -CAP_R * Math.sin(capAngle(c))))),
    xform(cylinder(0.0021, 0.032, 10), mat4.t(0, 0.023, 0)),
  )
  const rotor = merge(xform(box(0.026, 0.004, 0.009), mat4.t(0.006, 0.0035, 0)), xform(tube(0.0062, 0.0045, 0.008, 20), mat4.t(0, 0.002, 0)))
  const rotorStrip = xform(box(0.021, 0.0012, 0.0036), mat4.t(0.011, 0.0062, 0))
  // coil (local y = 0 at the can base)
  const can = lathe([[0, -0.004], [0.029, -0.004], [0.029, 0.12], [0.026, 0.12], [0.026, 0.0], [0, 0.0]], 48)
  const top = lathe([[0, 0.12], [0.029, 0.12], [0.029, 0.127], [0.0095, 0.134], [0.0095, 0.15], [0.0042, 0.15], [0.0042, 0.13], [0, 0.13]], 48)
  const core = xform(cylinder(0.0078, 0.104, 24), mat4.t(0, 0.06, 0))
  const secondary = xform(tube(0.0158, 0.0083, 0.094, 40), mat4.t(0, 0.061, 0))
  const primary = xform(turns(0.0192, 0.0013, 0.088, 16), mat4.t(0, 0.017, 0))
  const coilTerms = merge(xform(cylinder(0.0028, 0.012, 12), mat4.t(0.017, 0.133, 0)), xform(cylinder(0.0028, 0.012, 12), mat4.t(-0.017, 0.133, 0)))
  const pedestal = xform(box(0.07, COIL_P[1] - 0.004 - FLOOR, 0.07), mat4.t(0, (FLOOR - COIL_P[1] - 0.004) / 2, 0))
  // battery (simple, for the circuit)
  const battCase = csg(box(0.2, 0.17, 0.12), [{ op: 'sub', geometry: xform(box(0.19, 0.17, 0.11), mat4.t(0, 0.01, 0)) }])
  const battLid = xform(box(0.2, 0.012, 0.12), mat4.t(0, 0.091, 0))
  const battCaps = merge(...[0, 1, 2, 3, 4, 5].map((i) => xform(cylinder(0.009, 0.01, 16), mat4.t(-0.083 + i * 0.0333, 0.102, 0.03))))
  const posts = { pos: xform(cylinder(0.0085, 0.02, 20), mat4.t(-0.075, 0.105, -0.03)), neg: xform(cylinder(0.0075, 0.02, 20), mat4.t(0.075, 0.105, -0.03)) }
  // dashboard: ammeter and key switch, facing +Z
  const panel = box(0.15, 0.075, 0.006)
  const post = xform(box(0.02, DASH[1] - FLOOR - 0.0375, 0.02), mat4.t(0, -(DASH[1] - FLOOR - 0.0375) / 2 - 0.0375, -0.005))
  const ammeter = xform(lathe([[0, 0], [0.026, 0], [0.026, 0.006], [0.022, 0.009], [0, 0.007]], 40), mat4.c(mat4.t(-0.035, 0, 0.003), alongZ))
  const switchBody = xform(lathe([[0, 0], [0.014, 0], [0.014, 0.008], [0.009, 0.012], [0, 0.012]], 32), mat4.c(mat4.t(0.04, 0, 0.003), alongZ))
  const key = merge(xform(box(0.003, 0.012, 0.012), mat4.t(0, 0, 0.012)), xform(box(0.02, 0.016, 0.003), mat4.t(0, 0.0, 0.025)))
  const needle = xform(box(0.0015, 0.019, 0.0012), mat4.t(0, 0.0095, 0))
  return {
    block,
    head,
    cover,
    plug: sparkPlug(0.012),
    dist: { body, bracket, shaft, plate, cam: breakerCam, fixedContact, arm, pivot, condenser, cap, towers, segments, rotor, rotorStrip },
    coil: { can, top, core, secondary, primary, terms: coilTerms, pedestal },
    batt: { case: battCase, lid: battLid, caps: battCaps, ...posts },
    dash: { panel, post, ammeter, switchBody, key, needle },
  }
}

/* ------------------------------ (b) magneto + impulse coupling ------------------------------ */

/** rotor centre */
export const MAG_C: [number, number, number] = [0, -0.155, 0]
export const STOP_PIN_DEG = 14
export const PAWL_R = 0.016

export function magneto() {
  const housing = csg(xform(box(0.1, 0.125, 0.08), mat4.t(0, 0.0175, 0)), [
    { op: 'sub', geometry: xform(box(0.074, 0.098, 0.062), mat4.t(0, 0.019, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.0068, 0.2, 24), alongZ) },
  ])
  const base = xform(box(0.13, 0.05, 0.1), mat4.t(0, FLOOR - MAG_C[1] + 0.025, 0))
  // pole shoes (soft iron) with concave faces round the rotor
  const s = new THREE.Shape()
  const yi = Math.sqrt(0.0215 ** 2 - 0.0125 ** 2)
  const a = Math.atan2(yi, 0.0125)
  s.moveTo(0.036, -0.02)
  s.lineTo(0.036, 0.042)
  s.lineTo(0.0125, 0.042)
  s.lineTo(0.0125, yi)
  s.absarc(0, 0, 0.0215, a, -a, true)
  s.lineTo(0.0125, -0.02)
  const shoe = extrude(s, 0.052, { curveSegments: 24 })
  const shoes = merge(shoe, xform(shoe, mat4.ry(PI)))
  const coreBar = merge(xform(cylinder(0.0062, 0.06, 20), mat4.c(mat4.t(0, 0.05, 0), alongX)), xform(box(0.012, 0.016, 0.03), mat4.t(0.03, 0.05, 0)), xform(box(0.012, 0.016, 0.03), mat4.t(-0.03, 0.05, 0)))
  const primary = xform(turns(0.0078, 0.0011, 0.04, 10), mat4.c(mat4.t(0.02, 0.05, 0), mat4.rz(PI / 2)))
  const secondary = xform(tube(0.0158, 0.0098, 0.04, 36), mat4.c(mat4.t(0, 0.05, 0), alongX))
  const half = new THREE.Shape()
  half.moveTo(0, -0.02)
  half.absarc(0, 0, 0.02, -PI / 2, PI / 2, false)
  half.lineTo(0, -0.02)
  const north = extrude(half, 0.05, { curveSegments: 24 })
  const south = xform(north, mat4.rz(PI))
  const shaft = xform(cylinder(0.006, 0.14, 20), alongZ)
  // contact breaker at the back (−Z): two-lobe cam, two sparks per revolution (TB p28)
  const breakerCam = xform(cam(0.0085, (p) => 0.0007 * Math.max(0, Math.cos(2 * p) - 0.8) / 0.2, 0.008), mat4.t(0, 0, -0.05))
  const arm = merge(xform(box(0.034, 0.0025, 0.007), mat4.t(0.017, 0, 0)), xform(box(0.005, 0.003, 0.006), mat4.t(0.02, -0.0025, 0)), xform(box(0.004, 0.0015, 0.004), mat4.t(0.032, -0.002, 0)))
  const fixedContact = xform(box(0.006, 0.006, 0.006), mat4.t(0.012, 0.0068, -0.05))
  const condenser = xform(lathe([[0, 0], [0.007, 0], [0.007, 0.024], [0, 0.024]], 20), mat4.c(mat4.t(-0.03, -0.02, -0.05), alongX))
  // impulse coupling (front, +Z)
  const plate = xform(lathe([[0.0062, 0], [0.026, 0], [0.026, 0.004], [0.0062, 0.004]], 48), mat4.c(mat4.t(0, 0, 0.044), alongZ))
  const pawl = merge(xform(box(0.0145, 0.004, 0.004), mat4.t(0.006, 0, 0)), xform(cylinder(0.0022, 0.005, 12), alongZ))
  const stopPin = xform(cylinder(0.0024, 0.014, 12), mat4.c(mat4.t(-0.0295 * Math.sin((STOP_PIN_DEG * PI) / 180), 0.0295 * Math.cos((STOP_PIN_DEG * PI) / 180), 0.047), alongZ))
  const spiralPts: THREE.Vector3[] = []
  for (let i = 0; i <= 96; i++) {
    const t = i / 96
    const a = t * 3 * 2 * PI
    const r = 0.008 + 0.016 * t
    spiralPts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0))
  }
  const spiral = pipe(new THREE.CatmullRomCurve3(spiralPts), 0.0011, 0, 160, 8)
  const hub = merge(
    xform(lathe([[0.0062, 0], [0.035, 0], [0.035, 0.006], [0.0062, 0.006]], 56), mat4.c(mat4.t(0, 0, 0.066), alongZ)),
    xform(box(0.008, 0.01, 0.012), mat4.t(0.03, 0, 0.061)),
    xform(box(0.008, 0.01, 0.012), mat4.t(-0.03, 0, 0.061)),
    xform(cylinder(0.0065, 0.04, 20), mat4.c(mat4.t(0, 0, 0.092), alongZ)),
  )
  const terminal = xform(cylinder(0.0035, 0.016, 16), mat4.t(0, 0.083, 0))
  return { housing, base, shoes, coreBar, primary, secondary, north, south, shaft, cam: breakerCam, arm, fixedContact, condenser, plate, pawl, stopPin, spiral: xform(spiral, mat4.t(0, 0, 0.057)), hub, terminal }
}

/* ------------------------------ (c) spark plugs: hot vs cold ------------------------------ */

export const PLUG_BLOCK_TOP = FLOOR + 0.035
export const HOT_X = -0.025
export const COLD_X = 0.025

export function plugBench() {
  const holes = merge(...[HOT_X, COLD_X].map((x) => xform(cylinder(0.0072, 0.1, 24), mat4.t(x, FLOOR, 0))))
  const chambers = merge(...[HOT_X, COLD_X].map((x) => xform(cylinder(0.012, 0.03, 32), mat4.t(x, FLOOR, 0))))
  const block = csg(xform(box(0.1, 0.035, 0.05), mat4.t(0, FLOOR + 0.0175, 0)), [
    { op: 'sub', geometry: holes },
    { op: 'sub', geometry: chambers },
  ])
  const gauge = merge(xform(box(0.04, 0.0006, 0.0075), mat4.t(0.017, 0, 0)), xform(box(0.012, 0.004, 0.012), mat4.t(0.042, 0, 0)))
  return { block, hot: sparkPlug(0.016), cold: sparkPlug(0.006), gauge }
}

/* ------------------------------ (d) starter motor & ring gear ------------------------------ */

export const RING_Z = 0.014
export const PINION_REST_Z = RING_Z - 0.022

export function starter() {
  // the library flywheel, turned to face +Z; its ring re-centred on z = 0 (the scene places it at RING_Z)
  const fw = flywheel({ r: 0.124, width: 0.032, boreR: 0.026, ringModule: GEAR_MODULE, ringTeeth: RING_TEETH, ringWidth: 0.016 })
  const flip = mat4.ry(PI)
  const fly = xform(fw.disc, flip)
  const ring = xform(fw.ring, mat4.c(mat4.t(0, 0, -(0.002 + fw.ringWidth / 2)), flip))
  const crankStub = xform(cylinder(0.025, 0.1, 32), mat4.c(mat4.t(0, 0, -0.045), alongZ))
  const pedestal = csg(xform(box(0.09, FLY_C[1] + 0.04 - FLOOR, 0.05), mat4.t(0, (FLY_C[1] + 0.04 + FLOOR) / 2, -0.07)), [{ op: 'sub', geometry: xform(cylinder(0.0255, 0.2, 32), mat4.c(mat4.t(0, FLY_C[1], 0), alongZ)) }])
  const motor = starterMotor({ module: GEAR_MODULE, pinionTeeth: PINION_TEETH })
  const mount = xform(box(0.07, STARTER_C[1] - 0.041 - FLOOR, 0.05), mat4.t(0, (FLOOR - STARTER_C[1] + 0.041) / 2 - 0.041, -0.09))
  return { fly, ring, crankStub, pedestal, ...motor, mount }
}

/* ------------------------------ (e) battery, dynamo, alternator ------------------------------ */

export const BAT_C: [number, number, number] = [-0.24, FLOOR + 0.095, 0]
export const DYN_C: [number, number, number] = [0.03, -0.085, 0]
export const ALT_C: [number, number, number] = [0.25, -0.085, 0]
export const CRANK_P: [number, number, number] = [0.14, -0.195, 0]
export const PULLEY_Z = -0.095
export const R_CRANK = 0.05
export const R_DYN = 0.03
export const R_ALT = 0.02

export function dynamo() {
  return dynamoLib({ pulleyR: R_DYN, pulleyZ: PULLEY_Z - DYN_C[2] })
}

export function charging() {
  const crank = merge(
    // two-groove crankshaft pulley (dynamo and alternator belts)
    xform(vPulley({ r: R_CRANK + 0.004, bore: 0.008, grooves: 2, land: 0.003, grooveW: 0.012, grooveDepth: 0.008 }), mat4.t(0, 0, PULLEY_Z - 0.021)),
    xform(cylinder(0.012, 0.08, 24), mat4.c(mat4.t(0, 0, PULLEY_Z - 0.05), alongZ)),
  )
  const c = new THREE.Vector2(CRANK_P[0], CRANK_P[1])
  const b1 = loopPath(c, R_CRANK, new THREE.Vector2(DYN_C[0], DYN_C[1]), R_DYN)
  const b2 = loopPath(c, R_CRANK, new THREE.Vector2(ALT_C[0], ALT_C[1]), R_ALT)
  const belts = merge(xform(beltBand(b1.path, 0.009, 0.006), mat4.t(0, 0, PULLEY_Z)), xform(beltBand(b2.path, 0.009, 0.006), mat4.t(0, 0, PULLEY_Z - 0.012)))
  const stand = xform(box(0.04, CRANK_P[1] - FLOOR + 0.0, 0.04), mat4.t(CRANK_P[0], (CRANK_P[1] + FLOOR) / 2, PULLEY_Z - 0.09))
  const mounts = merge(...[DYN_C, ALT_C].map((p) => xform(box(0.06, p[1] - FLOOR - 0.05, 0.08), mat4.t(p[0], (FLOOR + p[1] - 0.05) / 2, 0))))
  const regulator = xform(box(0.07, 0.04, 0.05), mat4.t(DYN_C[0], DYN_C[1] + 0.075, -0.02))
  const lamp = merge(xform(lathe([[0, 0], [0.03, 0.0], [0.034, 0.03], [0, 0.03]], 40), alongZ))
  const lens = xform(lathe([[0, 0], [0.033, 0], [0.033, 0.004], [0, 0.006]], 40), mat4.c(mat4.t(0, 0, 0.03), alongZ))
  return { crank, belts, stand, mounts, regulator, lamp, lens }
}

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  return { coil: coilIgnition(), magneto: magneto(), plug: plugBench(), starter: starter(), charging: { ...charging(), battery: battery(), dynamo: dynamo(), alternator: alternator() } }
}

export type IgnGeometry = ReturnType<typeof buildStatic>

let ready: IgnGeometry | null = null

export async function prepareIgnitionGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/ignition', buildStatic)
  return ready
}

export function getIgnitionGeometry(): IgnGeometry {
  if (!ready) ready = buildStatic()
  return ready
}

export type { V2 }
