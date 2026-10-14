import * as THREE from 'three'
import { cylinder, mat4, tube, xform } from '@/geometry'
import { UJ } from '@/parts/lib/driveline'

/**
 * Shared Hooke's (cardan) joint helpers for the PTO module: plain shafts, plus the frame maths
 * that orients each member from the real joint geometry (so the 3D motion is the true
 * kinematics, not a replay of the formula). The joint hardware itself (yoke, cross, cups,
 * needles, seals, pillow block) lives in the shared parts library (src/parts/lib/driveline.ts);
 * the old names are re-exported here.
 */
export {
  UJ as J,
  ujYoke as yokeGeometry,
  ujCross as crossGeometry,
  ujCups as cupsGeometry,
  ujNeedles as needlesGeometry,
  ujSeals as sealsGeometry,
  pillowBlockX as pillowBlock,
} from '@/parts/lib/driveline'

const { PI } = Math
const J = UJ

/** Plain round shaft along +X from x0 to x1 (solid). */
export function shaftGeometry(x0: number, x1: number, r = J.shaftR) {
  return xform(cylinder(r, x1 - x0, 32), mat4.c(mat4.t((x0 + x1) / 2, 0, 0), mat4.rz(PI / 2)))
}

/** Tubular shaft along +X. */
export function tubeShaftGeometry(x0: number, x1: number, ro: number, ri: number) {
  return xform(tube(ro, ri, x1 - x0, 40), mat4.c(mat4.t((x0 + x1) / 2, 0, 0), mat4.rz(PI / 2)))
}

/* ------------------------------ kinematics ------------------------------ */

const X = new THREE.Vector3(1, 0, 0)
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _m = new THREE.Matrix4()

/**
 * Rotation φ about local X that, after the base rotation `base` (local X → shaft axis),
 * carries the local pin direction `pinLocal` onto the world pin direction `pinWorld`.
 */
export function shaftAngleFor(base: THREE.Quaternion, pinLocal: THREE.Vector3, pinWorld: THREE.Vector3) {
  _q.copy(base).invert()
  _v.copy(pinWorld).applyQuaternion(_q) // into the shaft's base frame
  _v.x = 0
  _v.normalize()
  _w.copy(pinLocal).cross(_v)
  return Math.atan2(_w.dot(X), pinLocal.dot(_v))
}

/**
 * Driven pin of a Hooke's joint: perpendicular to the driving pin u1 and to the driven
 * shaft axis a2 (the cross keeps its arms at right angles).
 */
export function drivenPin(a2: THREE.Vector3, u1: THREE.Vector3, out: THREE.Vector3) {
  return out.copy(a2).cross(u1).normalize()
}

/** Orientation of a cross whose arms lie along u1 (local Y) and u2 (local Z). */
export function crossQuaternion(u1: THREE.Vector3, u2: THREE.Vector3, out: THREE.Quaternion) {
  _v.copy(u1).cross(u2)
  _m.makeBasis(_v, u1, u2)
  return out.setFromRotationMatrix(_m)
}

/** Quaternion from local X → axis by rotation about world Y by `yaw` (bend in the horizontal plane). */
export const yawQuat = (yaw: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)

/** Unwrap an angle so it stays continuous with the previous value. */
export function unwrap(prev: number, next: number) {
  let d = next - prev
  d -= Math.round(d / (2 * PI)) * 2 * PI
  return prev + d
}
