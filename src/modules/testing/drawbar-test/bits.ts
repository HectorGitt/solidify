import * as THREE from 'three'
import { box, cylinder, tube } from '@/geometry'
import { clevisEye, dialGauge, gaugeNeedle } from '@/parts/lib/chassis'
import { wheel, type TreadPattern } from '@/parts/lib/wheels'

/**
 * Small geometry helpers shared by the drawbar-test, cab and field scenes (cheap, main thread).
 * All solids are closed: boxes, cylinders and lathes from @/geometry.
 */

export type P3 = [number, number, number]

/** Box of size (w, h, d) centred at (x, y, z). */
export function boxAt(w: number, h: number, d: number, x: number, y: number, z = 0) {
  const g = box(w, h, d)
  g.translate(x, y, z)
  return g
}

/** Solid cylinder with its axis along X, Y or Z, centred at (x, y, z). */
export function cyl(axis: 'x' | 'y' | 'z', r: number, len: number, x = 0, y = 0, z = 0, seg = 32) {
  const g = cylinder(r, len, seg)
  if (axis === 'x') g.rotateZ(-Math.PI / 2)
  else if (axis === 'z') g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  return g
}

/** Tube (hollow cylinder) with its axis along X, Y or Z. */
export function tubeAt(axis: 'x' | 'y' | 'z', ro: number, ri: number, len: number, x = 0, y = 0, z = 0, seg = 40) {
  const g = tube(ro, ri, len, seg)
  if (axis === 'x') g.rotateZ(-Math.PI / 2)
  else if (axis === 'z') g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  return g
}

/** Round rod between two points. */
export function rodBetween(a: P3, b: P3, r: number, seg = 14) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = new THREE.Vector3().subVectors(B, A)
  const g = cylinder(r, Math.max(1e-4, d.length()), seg)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()))
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2)
  return g
}

/** Square bar between two points. */
export function barBetween(a: P3, b: P3, s: number) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = new THREE.Vector3().subVectors(B, A)
  const g = box(s, Math.max(1e-4, d.length()), s)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()))
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2)
  return g
}

/** Clevis eye: a flat plate with a round end, along X (parts library `clevisEye`). */
export const eye = clevisEye

/** Wheel (tyre, rim, hub nuts) with the axle along Z, outer face +Z (parts library `wheel`). */
export function wheelZ(radius: number, width: number, pattern: TreadPattern = 'smooth') {
  return wheel({ radius, width, pattern, rimRadius: radius * 0.6 })
}

/** Gauge dial, face toward +Z (parts library `dialGauge`). */
export const dial = dialGauge

/** Needle pointing +Y from its pivot (parts library `gaugeNeedle`). */
export const needle = gaugeNeedle
