import * as THREE from 'three'

const Y = new THREE.Vector3(0, 1, 0)
const a = new THREE.Vector3()
const b = new THREE.Vector3()
const d = new THREE.Vector3()
const q = new THREE.Quaternion()

/** Lay a unit-long, y-axis object between two points: for links, arms and wires that change length or lean. */
export function placeBetween(o: THREE.Object3D | null, p: [number, number, number], r: [number, number, number]) {
  if (!o) return
  a.set(...p)
  b.set(...r)
  d.subVectors(b, a)
  const len = d.length()
  o.position.copy(a).addScaledVector(d, 0.5)
  if (len > 1e-9) o.quaternion.copy(q.setFromUnitVectors(Y, d.divideScalar(len)))
  o.scale.set(1, Math.max(len, 1e-6), 1)
}

/** a unit cylinder along y, for placeBetween */
export const unitRod = (radius: number, segments = 14) => new THREE.CylinderGeometry(radius, radius, 1, segments)
