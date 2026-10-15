import * as THREE from 'three'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { UJ, ujCross, ujYoke } from '@/parts/lib/driveline'
import { AXLE_Y } from './geometry'

/**
 * The shared tractor as an articulated 4WD: two frames joined by a vertical hinge behind the clutch
 * housing. The front frame carries the engine, bonnet and radiator and a rigid driven front axle
 * with the same wheels as the rear; the rear frame carries the gearbox, centre housing, operator
 * station and linkage. Two steering rams fold the frames about the hinge, so the rear wheels follow
 * in the front wheels' tracks. Frame as the tractor (+X forward, Y up, +Z right).
 */

const { PI } = Math
/** hinge (vertical pin axis) x, between the gearbox and the clutch housing */
export const HINGE_X = 0.6
/** front axle x: ahead of the radiator, clear of the engine for the big front wheels */
export const ART_AXLE_X = 2.3
/** articulation angle (rad) per unit of pose steer, and its limit */
export const ART_GAIN = 1.6
export const ART_MAX = 0.7
/** steering-ram anchors on the rear and front frames (z = ±) */
export const RAM_REAR = new THREE.Vector3(0.28, 0.5, 0.3)
export const RAM_FRONT = new THREE.Vector3(1.0, 0.5, 0.3)
/** drive into the front frame: from the transfer output under the gearbox, through a joint at the hinge */
export const ART_PROP_FROM = new THREE.Vector3(HINGE_X + 0.04, 0.27, -0.09)
const PROP_TO = new THREE.Vector3(ART_AXLE_X - 0.2, AXLE_Y - 0.06, -0.09)
export const ART_PROP_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), PROP_TO.clone().sub(ART_PROP_FROM).normalize())

const zAlong = mat4.rx(PI / 2)
const xAlong = mat4.rz(-PI / 2)

/** A propeller shaft along +X from a joint at the origin to one at x = len (universal joints at both ends). */
export function propShaft(len: number) {
  const shaft = xform(cylinder(0.03, len - 2 * UJ.hubEnd, 24), mat4.c(mat4.t(len / 2, 0, 0), xAlong))
  const yoke = ujYoke()
  const joint = (at: number, flip: boolean) =>
    merge(xform(yoke, mat4.c(mat4.t(at, 0, 0), flip ? mat4.ry(PI) : new THREE.Matrix4())), xform(yoke, mat4.c(mat4.t(at, 0, 0), flip ? new THREE.Matrix4() : mat4.ry(PI), mat4.rx(PI / 2))), xform(ujCross(), mat4.t(at, 0, 0)))
  return merge(shaft, joint(0, true), joint(len, false))
}

/**
 * Geometry for the articulated layout. `trumpets` are the rear axle housings (reused at the front).
 */
export function articulatedGeometry(trumpets: THREE.BufferGeometry) {
  const x = ART_AXLE_X
  const diff = xform(lathe([[0.07, -0.12], [0.13, -0.11], [0.16, -0.05], [0.16, 0.05], [0.13, 0.11], [0.07, 0.12]], 40), mat4.c(mat4.t(x, AXLE_Y, 0), zAlong))
  const nose = xform(lathe([[0.05, 0], [0.08, 0], [0.07, 0.17], [0.05, 0.21]], 32), mat4.c(mat4.t(x - 0.11, AXLE_Y - 0.06, -0.09), mat4.rz(PI / 2)))
  const frontAxle = merge(trumpets.clone().translate(x, 0, 0), diff, nose)
  // front frame: rails from the front support out to the axle, and a nose weight
  const rails = merge(...[1, -1].map((s) => xform(box(0.62, 0.16, 0.08), mat4.t(2.15, AXLE_Y + 0.12, s * 0.2))), xform(box(0.2, 0.34, 0.5), mat4.t(2.6, AXLE_Y + 0.1, 0)))
  // hinge: upper and lower clevis plates with their pins, above and below the driveline
  const clevis = (y: number) => merge(xform(box(0.24, 0.035, 0.26), mat4.t(HINGE_X, y + 0.04, 0)), xform(box(0.24, 0.035, 0.26), mat4.t(HINGE_X, y - 0.04, 0)), xform(cylinder(0.035, 0.14, 20), mat4.t(HINGE_X, y, 0)))
  const hinge = merge(clevis(0.95), clevis(0.33))
  // a universal joint in the clutch shaft at the hinge
  const yoke = ujYoke()
  const hingeJoint = merge(xform(yoke, mat4.c(mat4.t(0, 0, 0), mat4.ry(PI))), xform(yoke, mat4.rx(PI / 2)), ujCross())
  const ramBarrel = xform(cylinder(0.045, 0.38, 20), mat4.c(mat4.t(0.19, 0, 0), xAlong))
  const ramRod = merge(xform(cylinder(0.022, 0.42, 16), mat4.c(mat4.t(0.21, 0, 0), xAlong)), xform(cylinder(0.03, 0.06, 16), mat4.rx(PI / 2)))
  const prop = propShaft(ART_PROP_FROM.distanceTo(PROP_TO))
  return { frontAxle, rails, hinge, hingeJoint, ramBarrel, ramRod, prop }
}
export type ArticulatedGeometry = ReturnType<typeof articulatedGeometry>
