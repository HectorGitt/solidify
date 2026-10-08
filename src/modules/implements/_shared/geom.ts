import * as THREE from 'three'
import { box, cylinder, extrude, finalize } from '@/geometry'

/**
 * Small generators shared by the implements scenes. All return closed, outward-facing solids.
 */

export type P3 = [number, number, number]

function signedVolume(pos: number[], idx: number[]) {
  let v = 0
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3
    const b = idx[t + 1] * 3
    const c = idx[t + 2] * 3
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2]
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2]
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2]
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }
  return v
}

/**
 * Sweep a closed ring of points through stations (every ring has the same point count) and cap
 * both ends with a fan from the ring centroid. Rings should be convex-ish and must not cross.
 * Orientation is fixed automatically so the solid faces outward.
 */
export function sweepRings(rings: THREE.Vector3[][], crease = Math.PI / 5, ladder = false) {
  const n = rings[0].length
  const pos: number[] = []
  const idx: number[] = []
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z)
  for (let k = 0; k < rings.length - 1; k++)
    for (let j = 0; j < n; j++) {
      const a = k * n + j
      const b = k * n + ((j + 1) % n)
      const c = (k + 1) * n + j
      const d = (k + 1) * n + ((j + 1) % n)
      idx.push(a, b, d, a, d, c)
    }
  for (const [k, flip] of [
    [0, true],
    [rings.length - 1, false],
  ] as const) {
    if (ladder) {
      // thin strip ring (front line then back line reversed): cap with a ladder of quads
      const m = n / 2
      for (let j = 0; j < m - 1; j++) {
        const a = k * n + j
        const b = k * n + j + 1
        const c = k * n + (2 * m - 2 - j)
        const d = k * n + (2 * m - 1 - j)
        if (flip) idx.push(a, c, b, a, d, c)
        else idx.push(a, b, c, a, c, d)
      }
      continue
    }
    const r = rings[k]
    const cIdx = pos.length / 3
    const c = r.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / n)
    pos.push(c.x, c.y, c.z)
    for (let j = 0; j < n; j++) {
      const a = k * n + j
      const b = k * n + ((j + 1) % n)
      if (flip) idx.push(cIdx, b, a)
      else idx.push(cIdx, a, b)
    }
  }
  if (signedVolume(pos, idx) < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return finalize(g, crease)
}

/**
 * A thick plate following a surface S(u, v), u, v ∈ [0, 1]: each u-station is a ring made of the
 * v-line on the face and the same line offset by `t` along the local normal.
 */
export function thickSurface(S: (u: number, v: number) => THREE.Vector3, nu: number, nv: number, t: number, crease = Math.PI / 5) {
  const rings: THREE.Vector3[][] = []
  const du = 1e-3
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    const front: THREE.Vector3[] = []
    const back: THREE.Vector3[] = []
    for (let j = 0; j <= nv; j++) {
      const v = j / nv
      const p = S(u, v)
      const pu = S(Math.min(1, u + du), v).sub(S(Math.max(0, u - du), v))
      const pv = S(u, Math.min(1, v + du)).sub(S(u, Math.max(0, v - du)))
      const nrm = pu.cross(pv).normalize()
      front.push(p)
      back.push(p.clone().addScaledVector(nrm, -t))
    }
    rings.push([...front, ...back.reverse()])
  }
  return sweepRings(rings, crease, true)
}

/** Horizontal plate from a top-view outline [x, z] (any winding), thickness t, top face at y. */
export function plateXZ(points: [number, number][], t: number, y = 0) {
  const s = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = extrude(s, t, { curveSegments: 12 })
  g.rotateX(Math.PI / 2)
  g.translate(0, y - t / 2, 0)
  return g
}

/** Vertical plate from a side-view outline [x, y], thickness t centred on z. */
export function plateXY(points: [number, number][], t: number, z = 0) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = extrude(s, t, { curveSegments: 12 })
  g.translate(0, 0, z)
  return g
}

const UP = new THREE.Vector3(0, 1, 0)

/** Round rod between two points. */
export function rod(a: P3, b: P3, r: number, seg = 14) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = B.clone().sub(A)
  const g = cylinder(r, d.length(), seg)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()))
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  return g
}

/** Rectangular bar (w across, h high) between two points; the bar's local Y stays as vertical as possible. */
export function bar(a: P3, b: P3, w: number, h: number) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = B.clone().sub(A)
  const L = d.length()
  const g = box(L, h, w)
  const xAxis = d.normalize()
  let zAxis = new THREE.Vector3().crossVectors(xAxis, UP)
  if (zAxis.lengthSq() < 1e-8) zAxis = new THREE.Vector3(0, 0, 1)
  zAxis.normalize()
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis)
  g.applyMatrix4(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  return g
}

/** Smoothstep 0…1. */
export const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** Deterministic pseudo-random 0…1 from a number. */
export const hash = (x: number) => {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
