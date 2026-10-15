import * as THREE from 'three'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { UJ, ujCross, ujYoke } from '@/parts/lib/driveline'
import { wheel, type WheelSpec } from '@/parts/lib/wheels'
import { frontSupport } from '@/parts/lib/chassis'
import { TRACTOR } from './dims'

/**
 * Mechanical front-wheel drive (MFWD, "4WD") for the shared tractor: a driven, steered front axle
 * with a centre differential and epicyclic hub reductions in the swivel housings, fed by a
 * propeller shaft from a transfer box under the gearbox. Bigger lugged front tyres (11.2-24) run at
 * the same ground speed as the rears.
 * Frame as the tractor: +X forward, Y up, +Z right, origin on the ground under the rear axle.
 */

const { PI } = Math

/** driven front tyre 11.2-24 */
export const FRONT_4WD: WheelSpec & { rolling: number } = { radius: 0.56, width: 0.28, rimRadius: 0.305, pattern: 'R1', lugs: 20, rimWidth: 0.24, hubR: 0.09, dish: 0.05, studs: 8, studCircle: 0.07, studR: 0.009, studLen: 0.02, capR: 0.045, rolling: 0.54 }
/** front axle centre height (= wheel centre) */
export const AXLE4_Y = FRONT_4WD.radius
/** swivel (kingpin) axis z: just inboard of the tyre's inner face */
export const KINGPIN4_Z = TRACTOR.front.track / 2 - 0.19
/** the differential sits off-centre to the left, clear of the sump */
const DIFF_Z = -0.09
/** transfer box under the gearbox: its output, and the front pinion's input */
export const PROP_FROM = new THREE.Vector3(0.52, 0.26, DIFF_Z)
export const PROP_TO = new THREE.Vector3(TRACTOR.wheelbase - 0.2, AXLE4_Y - 0.06, DIFF_Z)
/** wheel turns per crown-wheel (pinion ÷ 1) turn of the front axle: same ground speed as the rear */
export const FRONT_SPEED = TRACTOR.rear.rolling / FRONT_4WD.rolling

const zAlong = mat4.rx(PI / 2)
const xAlong = mat4.rz(-PI / 2)

export function mfwdGeometry() {
  const W = wheel(FRONT_4WD)
  const x = TRACTOR.wheelbase
  const y = AXLE4_Y
  // axle housing: tubes either side of the centre casing, out to the swivel housings
  const tube = (z0: number, z1: number, r: number) => xform(cylinder(r, z1 - z0, 32), mat4.c(mat4.t(x, y, (z0 + z1) / 2), zAlong))
  const diffCase = xform(
    lathe([[0.06, -0.1], [0.11, -0.09], [0.135, -0.04], [0.135, 0.04], [0.11, 0.09], [0.06, 0.1]], 40),
    mat4.c(mat4.t(x, y, DIFF_Z), zAlong),
  )
  const nose = xform(lathe([[0.05, 0], [0.075, 0], [0.065, 0.16], [0.045, 0.2]], 32), mat4.c(mat4.t(x - 0.1, PROP_TO.y, DIFF_Z), mat4.rz(PI / 2)))
  const housing = merge(tube(-KINGPIN4_Z + 0.09, DIFF_Z - 0.08, 0.055), tube(DIFF_Z + 0.08, KINGPIN4_Z - 0.09, 0.055), diffCase, nose)
  // centre pivot: the axle oscillates about a fore-and-aft pin under the front support
  const pivot = merge(xform(cylinder(0.035, 0.36, 24), mat4.c(mat4.t(x, y + 0.1, 0), xAlong)), xform(box(0.1, 0.07, 0.12), mat4.t(x - 0.12, y + 0.08, 0)), xform(box(0.1, 0.07, 0.12), mat4.t(x + 0.12, y + 0.08, 0)))
  // front support casting above the axle (replaces the 2WD bolster); its neck passes over the crank
  // pulley (top at y 0.712) and bolts to the front of the crankcase
  const fs = frontSupport({ l: 0.32, h: 0.17, w: 0.34, neck: { l: 1.76 - 1.385, h: 0.08, dy: -0.015 } })
  const atSupport = mat4.t(1.92, y + 0.215, 0)
  const support = xform(fs.body, atSupport)
  const supportSteel = xform(merge(fs.bolts, fs.eye), atSupport)
  /** swivel housing with the hub reduction, local: kingpin axis Y through the origin, wheel side +Z */
  const swivel = merge(
    lathe([[0, -0.1], [0.07, -0.09], [0.1, -0.04], [0.1, 0.04], [0.07, 0.09], [0, 0.1]], 32),
    xform(cylinder(0.03, 0.26, 16), mat4.t(0, 0, 0)),
    xform(lathe([[0.07, 0], [0.14, 0], [0.14, 0.09], [0.1, 0.12], [0.07, 0.12]], 40), mat4.c(mat4.t(0, 0, 0.04), zAlong)),
    // steering arm
    xform(box(0.2, 0.04, 0.05), mat4.t(-0.12, 0.08, -0.02)),
  )
  // track rod behind the axle between the steering arms (static display)
  const trackRod = xform(cylinder(0.018, 2 * KINGPIN4_Z - 0.1, 16), mat4.c(mat4.t(x - 0.22, y + 0.08, 0), zAlong))
  // transfer box and propeller shaft
  const transfer = xform(box(0.26, 0.14, 0.2), mat4.t(0.38, PROP_FROM.y, DIFF_Z))
  const len = PROP_FROM.distanceTo(PROP_TO)
  /** propeller shaft, local: along +X from the rear joint (origin) to the front joint at x = len */
  const shaft = xform(cylinder(0.03, len - 2 * UJ.hubEnd, 24), mat4.c(mat4.t(len / 2, 0, 0), xAlong))
  const yokeOut = ujYoke()
  const joint = (at: number, flip: boolean) => {
    const toShaft = flip ? mat4.ry(PI) : new THREE.Matrix4()
    const other = flip ? new THREE.Matrix4() : mat4.ry(PI)
    return merge(xform(yokeOut, mat4.c(mat4.t(at, 0, 0), toShaft)), xform(yokeOut, mat4.c(mat4.t(at, 0, 0), other, mat4.rx(PI / 2))), xform(ujCross(), mat4.t(at, 0, 0)))
  }
  const prop = merge(shaft, joint(0, true), joint(len, false))
  return { tyre: W.tyre, rim: W.rim, hub: W.hub!, housing, pivot, support, supportSteel, swivel, trackRod, transfer, prop, propLen: len }
}
export type MfwdGeometry = ReturnType<typeof mfwdGeometry>

/** the propeller shaft's orientation (its +X along the shaft, rear to front) */
export const PROP_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), PROP_TO.clone().sub(PROP_FROM).normalize())
