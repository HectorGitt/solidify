import * as THREE from 'three'
import { csg, cylinder, helixSpring, lathe, mat4, merge, xform, type CsgOp, type V2 } from '@/geometry'

/**
 * Shared parts library — diesel fuel-injection parts. The nozzle-and-holder injector here is the
 * sectioned workshop version (TB Fig 4.9) with its needle, spindle, spring and adjusting screw;
 * the compact in-engine injector is `injector` in engine.ts.
 *
 * Injector local frame: nozzle tip at the origin, axis +Y; fuel inlet boss on −X, leak-off on +X.
 */

const { PI } = Math
const alongX = mat4.rz(PI / 2)

/** Injector local frame: tip at the origin, axis +Y. */
export const INJ = {
  inletY: 0.095,
  leakY: 0.124,
  springBottom: 0.07,
  screwTop: 0.142,
}

function injectorBody() {
  const outer: V2[] = [
    [0, 0.0006],
    [0.0016, 0.0006],
    [0.0026, 0.003],
    [0.0045, 0.006],
    [0.0045, 0.012],
    [0.0095, 0.013],
    [0.0095, 0.04],
    [0.0105, 0.041],
    [0.0105, 0.118],
    [0.0085, 0.12],
    [0.0085, 0.134],
    [0.0045, 0.134],
    [0.0045, 0.118],
    [0.0055, 0.118],
    [0.0055, 0.037],
    [0.0028, 0.035],
    [0.0028, 0.012],
    [0.002, 0.0108],
    [0.0021, 0.0075],
    [0.0012, 0.0035],
    [0, 0.0027],
  ]
  const body = lathe(outer, 48)
  const ops: CsgOp[] = []
  // fuel inlet boss facing the pump (−X) and its drilling down to the nozzle gallery
  ops.push({ op: 'add', geometry: xform(cylinder(0.0065, 0.018, 24), mat4.c(mat4.t(-0.016, INJ.inletY, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0014, 0.03, 12), mat4.c(mat4.t(-0.016, INJ.inletY, 0), alongX)) })
  const a = new THREE.Vector3(-0.0075, INJ.inletY + 0.001, 0)
  const b = new THREE.Vector3(-0.0024, 0.0095, 0)
  const len = a.distanceTo(b)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize())
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0009, len, 12), new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))) })
  // leak-off boss and drilling from the spring chamber
  ops.push({ op: 'add', geometry: xform(cylinder(0.0045, 0.012, 20), mat4.c(mat4.t(0.012, INJ.leakY, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0012, 0.03, 12), mat4.c(mat4.t(0.01, INJ.leakY, 0), alongX)) })
  return csg(body, ops)
}

function needle() {
  return lathe(
    [
      [0, 0.0029],
      [0.0011, 0.0037],
      [0.0019, 0.0075],
      [0.0019, 0.0108],
      [0.0027, 0.0122],
      [0.0027, 0.034],
      [0.0015, 0.0352],
      [0.0015, 0.04],
      [0, 0.04],
    ],
    32,
  )
}

function spindle() {
  return merge(lathe([[0, 0.04], [0.0018, 0.04], [0.0018, 0.0675], [0, 0.0675]], 20), lathe([[0, 0.0675], [0.005, 0.0675], [0.005, INJ.springBottom], [0, INJ.springBottom]], 32))
}

function adjustingScrew() {
  // unit placed with its lower face at y = 0
  return merge(
    lathe([[0, 0], [0.005, 0], [0.005, 0.003], [0.0042, 0.003], [0.0042, 0.05], [0, 0.05]], 32),
    xform(lathe([[0.0043, 0], [0.008, 0], [0.008, 0.006], [0.0043, 0.006]], 6), mat4.t(0, 0.034, 0)),
  )
}

/** The whole nozzle holder: body, needle, spindle, spring (unit length, scale to INJ.springBottom … screw) and adjusting screw (lower face at y = 0). */
export function injectorHolder() {
  return { body: injectorBody(), needle: needle(), spindle: spindle(), spring: helixSpring(0.0042, 0.0008, 1, 8), screw: adjustingScrew() }
}
