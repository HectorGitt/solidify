import * as THREE from 'three'
import { box, cylinder, extrude, gear, lathe, mat4, merge, tube, xform } from '@/geometry'
import { bevelPair, rim, splineShaft, tyre } from '@/geometry/parts'
import { bevelPinion, clutchDisc, clutchDiscThickness, crownWheel, plateStackZ, pressurePlate } from '@/parts/lib/driveline'
import { flywheel } from '@/parts/lib/engine'
import { hollow } from '@/tractor/geometry'
import { AX, AXLE_X, FACE, HOUSING, M, STUBS, Z, type PtoStd } from './model'

/**
 * Cheap, worker-free geometry for the PTO-types schematic (no CSG). Everything that turns is
 * built along +X (the tractor's fore-and-aft axis) and centred on its own axis.
 */

const { PI } = Math
/** Y-axis solid → X axis */
const toX = (g: THREE.BufferGeometry) => xform(g, mat4.rz(-PI / 2))
/** Y-axis solid → Z axis */
const toZ = (g: THREE.BufferGeometry) => xform(g, mat4.rx(PI / 2))

/** solid shaft along X from x0 to x1 */
export const shaftX = (x0: number, x1: number, r: number, seg = 28) => xform(toX(cylinder(r, x1 - x0, seg)), mat4.t((x0 + x1) / 2, 0, 0))
/** tube along X from x0 to x1 */
export const tubeX = (x0: number, x1: number, ro: number, ri: number, seg = 40) => xform(toX(tube(ro, ri, x1 - x0, seg)), mat4.t((x0 + x1) / 2, 0, 0))

/** Spur gear with its axis along X, tooth 0 pointing to −Z (so rotation.x is its tooth angle). */
export function gearX(teeth: number, bore: number) {
  const g = gear({ teeth, module: M, width: FACE, bore })
  g.rotateY(PI / 2)
  return g
}

/** Pitch radius of a gear in this train. */
export const pitchR = (teeth: number) => (teeth * M) / 2

export function engineGeometry() {
  const block = xform(box(0.42, 0.38, 0.3), mat4.t(0.74, 0.37, 0))
  const head = xform(box(0.38, 0.1, 0.26), mat4.t(0.74, 0.61, 0))
  const cover = xform(box(0.34, 0.05, 0.22), mat4.t(0.74, 0.685, 0))
  const sump = xform(box(0.36, 0.1, 0.24), mat4.t(0.74, 0.13, 0))
  return merge(block, head, cover, sump)
}

/**
 * Engine flywheel from the parts library, starter ring gear included; axis X, clutch face at
 * x = 0.47 and the disc towards the engine (+X).
 */
export function flywheelGeometry() {
  const fw = flywheel({ r: 0.172, width: 0.04 })
  // library frame: face at z = 0, disc towards −Z → turn −Z onto +X and move the face to x = 0.47
  const m = mat4.c(mat4.t(0.47, 0, 0), mat4.ry(-PI / 2))
  return { disc: xform(fw.disc, m), ring: xform(fw.ring, m) }
}

/** Z-axis library part → this scene's X axis. */
const zToX = (g: THREE.BufferGeometry) => xform(g, mat4.ry(PI / 2))

/** Clutch plate (linings, core and hub) centred on x = 0, axis X; hub from hx0 to hx1. */
function clutchPlateX(bore: number, hubR: number, hx0: number, hx1: number) {
  const T = clutchDiscThickness({ lining: 0.003, core: 0.002 })
  const d = clutchDisc({ Ro: 0.13, Ri: 0.075, lining: 0.003, core: 0.002, bore, hubR, hubZ0: hx0 + T / 2, hubZ1: hx1 + T / 2 })
  const c = (g: THREE.BufferGeometry) => zToX(xform(g, mat4.t(0, 0, -T / 2)))
  return { friction: merge(c(d.linings), c(d.core)), hub: c(d.hub) }
}

export function staticGeometry() {
  const H = HOUSING
  const t = 0.012
  const outer = xform(box(H.x1 - H.x0, H.y1 - H.y0, 2 * H.z), mat4.t((H.x0 + H.x1) / 2, (H.y0 + H.y1) / 2, 0))
  const inner = xform(box(H.x1 - H.x0 - 2 * t, H.y1 - H.y0 - 2 * t, 2 * H.z - 2 * t), mat4.t((H.x0 + H.x1) / 2, (H.y0 + H.y1) / 2, 0))
  const gearbox = hollow(outer, inner)
  const bell = xform(tubeX(H.x1, 0.53, 0.215, 0.2, 64), mat4.t(0, AX.top.y, 0))
  const trumpet = xform(toZ(tube(0.06, 0.045, 0.27, 40)), mat4.t(AXLE_X, AX.top.y, -(H.z + 0.135)))
  // PTO master shield: an arch over the stub, open underneath
  const arch = new THREE.Shape()
  arch.absarc(0, 0, 0.075, 0, PI, false)
  arch.absarc(0, 0, 0.069, PI, 0, true)
  const shield = xform(extrude(arch, 0.11, { curveSegments: 32 }), mat4.c(mat4.t(H.x0 - 0.055, AX.pto.y + 0.005, 0), mat4.ry(PI / 2)))
  const idlerPin = shaftX(-0.16, -0.08, 0.009, 16)
  return { gearbox, bell, trumpet, shield, idlerPin }
}

export function clutchGeometry() {
  return {
    cover: tubeX(0.36, 0.47, 0.162, 0.152, 64),
    pressurePlate: zToX(xform(pressurePlate({ rIn: 0.05, rOut: 0.135, t: 0.014, segments: 56 }), mat4.t(0, 0, -0.007))),
    /** transmission plate, hub splined to the input shaft */
    discIn: clutchPlateX(0.0182, 0.04, -0.005, 0.025),
    /** PTO plate, hub splined to the hollow PTO shaft */
    discPto: clutchPlateX(0.0302, 0.045, -0.03, 0.0),
    /** independent PTO: drive flange splined to the flywheel */
    driveFlange: tubeX(-0.006, 0.006, 0.11, 0.0302, 56),
  }
}

export function shaftsGeometry() {
  const { pinion: gp, gear: gg } = bevelPair(Z.bevel[0], Z.bevel[1])
  const crownR = pitchR(Z.bevel[1])
  const pinR = pitchR(Z.bevel[0])
  const crown = crownWheel({ teeth: Z.bevel[1], module: M, face: 0.02, pitchAngleDeg: gg, bore: 0.025 }).teeth
  crown.translate(0, 0, -crownR / Math.tan((gg * PI) / 180))
  const pinion = bevelPinion({ teeth: Z.bevel[0], module: M, face: 0.02, pitchAngleDeg: gp }).teeth
  pinion.translate(0, 0, -pinR / Math.tan((gp * PI) / 180))
  pinion.rotateY(-PI / 2)
  pinion.translate(AXLE_X, 0, 0)
  const pinionEnd = AXLE_X + pinR / Math.tan((gp * PI) / 180)
  return {
    input: shaftX(0.04, 0.47, 0.018),
    hollow: tubeX(0.25, 0.45, 0.03, 0.0195),
    hollowLong: tubeX(0.25, 0.43, 0.03, 0.0195),
    lay: tubeX(-0.14, 0.205, 0.022, 0.0125),
    layDog: tubeX(-0.15, -0.14, 0.026, 0.0125, 24),
    ptoDrive: shaftX(-0.15, 0.3, 0.011),
    output: shaftX(pinionEnd + 0.004, 0.035, 0.018),
    pinion,
    crown,
    halfShaft: xform(toZ(cylinder(0.025, 0.5, 24)), mat4.t(0, 0, -0.25)),
    diff: toZ(lathe([[0.026, -0.05], [0.055, -0.045], [0.06, 0], [0.055, 0.045], [0.026, 0.05]], 32)),
    ptoUp: shaftX(-0.345, -0.145, 0.015),
    collar: tubeX(-0.01, 0.01, 0.03, 0.0152, 32),
    lower: shaftX(HOUSING.x0, -0.205, 0.016),
    iptoDrum: tubeX(-0.03, 0.03, 0.052, 0.046, 48),
    iptoPlates: zToX(plateStackZ({ count: 5, z0: -0.0225, pitch: 0.01, t: 0.005, a: { rOut: 0.045, rIn: 0.016 }, segments: 40 }).all),
  }
}

/** Splined PTO stub for a standard, projecting `len` behind the housing (axis X, from x = 0 to −len). */
export function stubGeometry(std: PtoStd, len = 0.1) {
  const s = STUBS[std]
  const g = splineShaft(s.splines, s.od / 2, s.root / 2, len, s.splines > 6 ? 0.5 : 0.42)
  g.rotateZ(PI / 2) // +Y → −X
  g.translate(-len / 2, 0, 0)
  return g
}

export function wheelGeometry() {
  const t = tyre({ radius: 0.35, width: 0.17, rimRadius: 0.2, lugs: 18, pattern: 'R1' })
  const r = rim(0.2, 0.15, 0.06, 0.03)
  return { tyre: toZ(t), rim: toZ(r) }
}
