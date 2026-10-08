import * as THREE from 'three'
import { box, cylinder, extrude, lathe, mat4, merge, tube, xform } from '@/geometry'
import { torus } from '@/geometry/parts'

/**
 * Shared Hooke's (cardan) joint hardware for the PTO module: yoke, cross (spider) with
 * needle-roller cups, shafts and pillow-block bearings, plus the frame maths that orients
 * each member from the real joint geometry (so the 3D motion is the true kinematics, not
 * a replay of the formula).
 *
 * Proportions are those of a medium tractor PTO driveline joint (cross 94 mm over the cups,
 * 17 mm trunnions) — typical values; the notes give no dimensions.
 *
 * Local frame of a yoke: joint centre at the origin, shaft along −X, pin (trunnion) axis
 * along Y.
 */
export const J = {
  trunnionR: 0.0085,
  centreHalf: 0.016,
  trunnionEnd: 0.0435,
  cupInnerR: 0.0125,
  cupOuterR: 0.0155,
  cupOpen: 0.026,
  cupBottom: 0.0445,
  cupEnd: 0.047,
  needleR: 0.0019,
  needles: 16,
  earIn: 0.03,
  earOut: 0.044,
  earR: 0.023,
  earLen: 0.062,
  bridge: 0.078,
  hubEnd: 0.108,
  hubR: 0.025,
  shaftR: 0.0175,
}

const { PI } = Math

/** Yoke: two ears with cup bores, a bridge and a hub (shaft along −X, pin along Y). */
export function yokeGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-J.earLen, -J.earR)
  s.absarc(0, 0, J.earR, -PI / 2, PI / 2, false)
  s.lineTo(-J.earLen, J.earR)
  const hole = new THREE.Path()
  hole.absarc(0, 0, J.cupOuterR, 0, 2 * PI, true)
  s.holes.push(hole)
  const t = J.earOut - J.earIn
  // extruded in XY along Z → rotate so the plate lies in XZ, thickness along Y
  const ear = xform(extrude(s, t, { curveSegments: 32 }), mat4.rx(-PI / 2))
  const earTop = xform(ear, mat4.t(0, (J.earIn + J.earOut) / 2, 0))
  const earBot = xform(ear, mat4.t(0, -(J.earIn + J.earOut) / 2, 0))
  const bridgeW = J.bridge - J.earLen
  const bridge = xform(box(bridgeW, 2 * J.earOut, 2 * J.earR), mat4.t(-(J.earLen + J.bridge) / 2, 0, 0))
  const hubLen = J.hubEnd - J.bridge
  const hub = xform(cylinder(J.hubR, hubLen, 40), mat4.c(mat4.t(-(J.bridge + J.hubEnd) / 2, 0, 0), mat4.rz(PI / 2)))
  return merge(earTop, earBot, bridge, hub)
}

/** Cross (spider): centre block and four trunnions — arms along ±Y and ±Z. */
export function crossGeometry() {
  const c = J.centreHalf
  const centre = box(2 * c, 2 * c, 2 * c)
  const len = J.trunnionEnd - c
  const arm = cylinder(J.trunnionR, len, 28)
  const mid = c + len / 2
  const arms = [
    xform(arm, mat4.t(0, mid, 0)),
    xform(arm, mat4.t(0, -mid, 0)),
    xform(arm, mat4.c(mat4.rx(PI / 2), mat4.t(0, mid, 0))),
    xform(arm, mat4.c(mat4.rx(-PI / 2), mat4.t(0, mid, 0))),
  ]
  return merge(centre, ...arms)
}

/** Unit transforms that carry a +Y-pointing part to each of the four trunnion directions. */
const ARM_DIRS = [mat4.rx(0), mat4.rx(PI), mat4.rx(PI / 2), mat4.rx(-PI / 2)]

/** Four closed-end needle-bearing cups (with circlips), one on each trunnion. */
export function cupsGeometry() {
  const cup = lathe(
    [
      [J.cupInnerR, J.cupOpen],
      [J.cupOuterR, J.cupOpen],
      [J.cupOuterR, J.cupEnd],
      [0, J.cupEnd],
      [0, J.cupBottom],
      [J.cupInnerR, J.cupBottom],
    ],
    40,
  )
  const clip = xform(torus(J.cupOuterR - 0.0012, 0.0011, 8, 32), mat4.c(mat4.t(0, J.earOut + 0.0014, 0), mat4.rx(PI / 2)))
  return merge(...ARM_DIRS.flatMap((m) => [xform(cup, m), xform(clip, m)]))
}

/** Needle rollers (16 per cup) between trunnion and cup. */
export function needlesGeometry() {
  const len = J.cupBottom - J.cupOpen - 0.004
  const n = cylinder(J.needleR, len, 8)
  const rc = J.trunnionR + J.needleR
  const ring: THREE.BufferGeometry[] = []
  for (let i = 0; i < J.needles; i++) {
    const a = (i / J.needles) * 2 * PI
    ring.push(xform(n, mat4.t(rc * Math.cos(a), J.cupOpen + 0.002 + len / 2, rc * Math.sin(a))))
  }
  const one = merge(...ring)
  return merge(...ARM_DIRS.map((m) => xform(one, m)))
}

/** Lip seals at the open end of each cup. */
export function sealsGeometry() {
  const seal = xform(tube(J.cupInnerR + 0.0005, J.trunnionR + 0.0002, 0.003, 32), mat4.t(0, J.cupOpen - 0.0016, 0))
  return merge(...ARM_DIRS.map((m) => xform(seal, m)))
}

/** Plain round shaft along +X from x0 to x1 (solid). */
export function shaftGeometry(x0: number, x1: number, r = J.shaftR) {
  return xform(cylinder(r, x1 - x0, 32), mat4.c(mat4.t((x0 + x1) / 2, 0, 0), mat4.rz(PI / 2)))
}

/** Tubular shaft along +X. */
export function tubeShaftGeometry(x0: number, x1: number, ro: number, ri: number) {
  return xform(tube(ro, ri, x1 - x0, 40), mat4.c(mat4.t((x0 + x1) / 2, 0, 0), mat4.rz(PI / 2)))
}

/**
 * Pillow-block bearing around the X axis at the origin: cast housing with base and bolt
 * bosses (sectioned when cut). `drop` is the distance from the shaft axis to the base.
 */
export function pillowBlock(bore: number, drop: number) {
  const ro = bore + 0.022
  const w = 0.05
  const foot = 0.014
  const prof = new THREE.Shape()
  prof.moveTo(-ro, -drop + foot)
  prof.lineTo(ro, -drop + foot)
  prof.absarc(0, 0, ro, 0, PI, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, bore + 0.006, 0, 2 * PI, true)
  prof.holes.push(hole)
  const body = xform(extrude(prof, w, { curveSegments: 40 }), mat4.ry(PI / 2))
  const base = xform(box(w + 0.02, foot, 2 * ro + 0.09), mat4.t(0, -drop + foot / 2, 0))
  return { housing: merge(body, base), insert: xform(tube(bore + 0.006, bore, w * 0.8, 40), mat4.rz(PI / 2)) }
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
