import * as THREE from 'three'
import { box, cylinder, lathe, merge, tube } from '@/geometry'
import { rim, tyre } from '@/geometry/parts'

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

/** Clevis eye: a flat plate with a round end, along X (pin hole axis along Z is drawn as a boss). */
export function eye(x: number, y: number, len: number, t: number, r: number) {
  return merge(boxAt(Math.abs(len), r * 1.6, t, x + len / 2, y), cyl('z', r, t * 1.4, x, y, 0, 24))
}

/** Tyre + rim with the axle along Z (cached). */
const wheelCache = new Map<string, { tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry }>()
export function wheelZ(radius: number, width: number, pattern: 'R1' | 'F2' | 'smooth' = 'smooth') {
  const key = `${radius}|${width}|${pattern}`
  let w = wheelCache.get(key)
  if (!w) {
    const rr = radius * 0.6
    const t = tyre({ radius, width, rimRadius: rr, pattern, lugs: pattern === 'R1' ? Math.round(radius * 34) : 0 })
    t.rotateX(Math.PI / 2)
    const r = rim(rr, width * 0.9, Math.min(0.08, rr * 0.35), Math.min(0.04, width * 0.15))
    r.rotateX(Math.PI / 2)
    w = { tyre: t, rim: r }
    wheelCache.set(key, w)
  }
  return w
}

/** Gauge dial: a short cylinder (face toward +Z) with a bezel ring. */
export function dial(r: number, depth: number) {
  return lathe(
    [
      [0, -depth / 2],
      [r, -depth / 2],
      [r, depth / 2],
      [r * 0.9, depth / 2],
      [r * 0.9, depth / 2 - 0.004],
      [0, depth / 2 - 0.004],
    ],
    40,
  ).rotateX(Math.PI / 2)
}

/** Needle (thin box) pointing +Y from its pivot at the origin. */
export function needle(len: number, w = 0.006, t = 0.003) {
  const g = box(w, len, t)
  g.translate(0, len / 2 - len * 0.12, 0)
  return g
}
