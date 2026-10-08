import * as THREE from 'three'
import { box, cylinder } from '@/geometry'
import { rim, tyre } from '@/geometry/parts'

/** Cached wheel geometry (tyre + rim) with the axle along Z, centred on the origin. */
const cache = new Map<string, { tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry }>()

export function wheelGeo(radius: number, width: number, pattern: 'R1' | 'F2' | 'smooth' = 'R1', lugs = 0) {
  const key = `${radius}|${width}|${pattern}|${lugs}`
  let w = cache.get(key)
  if (!w) {
    const rr = radius * 0.58
    const t = tyre({ radius, width, rimRadius: rr, pattern, lugs: pattern === 'R1' ? lugs || Math.round(radius * 34) : 0 })
    t.rotateX(Math.PI / 2)
    const r = rim(rr, width * 0.9, Math.min(0.08, rr * 0.35), Math.min(0.04, width * 0.15))
    r.rotateX(Math.PI / 2)
    w = { tyre: t, rim: r }
    cache.set(key, w)
  }
  return w
}

/** Box from (x0, y0) to (x1, y1) in side view, d wide in Z, centred on z. */
export function slab(x0: number, y0: number, x1: number, y1: number, d: number, z = 0) {
  const g = box(Math.abs(x1 - x0), Math.abs(y1 - y0), d)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z)
  return g
}

/** Straight bar between two points (any direction), square section s. */
export function bar(a: [number, number, number], b: [number, number, number], s: number) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = new THREE.Vector3().subVectors(B, A)
  const g = box(s, d.length(), s)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()))
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2)
  return g
}

/** Round rod between two points. */
export function rod(a: [number, number, number], b: [number, number, number], r: number) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = new THREE.Vector3().subVectors(B, A)
  const g = cylinder(r, d.length(), 12)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()))
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2)
  return g
}
