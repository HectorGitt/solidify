import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { bar, plateXY, plateXZ, rod, sweepRings, thickSurface } from './geom'

function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const pos = g.getAttribute('position')
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
  const edges = new Map<string, number>()
  for (let t = 0; t < pos.count / 3; t++) {
    const k = [key(3 * t), key(3 * t + 1), key(3 * t + 2)]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue
    for (let e = 0; e < 3; e++) {
      const a = k[e]
      const b = k[(e + 1) % 3]
      const id = a < b ? `${a}|${b}` : `${b}|${a}`
      edges.set(id, (edges.get(id) ?? 0) + 1)
    }
  }
  let open = 0
  for (const c of edges.values()) if (c !== 2) open++
  return open
}

function volume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  let v = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

describe('implements shared generators are watertight and outward-facing', () => {
  const sq = (x: number) => [new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 1, 0), new THREE.Vector3(x, 1, 1), new THREE.Vector3(x, 0, 1)]
  const cases: [string, () => THREE.BufferGeometry, number?][] = [
    ['sweepRings unit cube', () => sweepRings([sq(0), sq(1)]), 1],
    ['sweepRings reversed', () => sweepRings([sq(1), sq(0)]), 1],
    ['thickSurface flat', () => thickSurface((u, v) => new THREE.Vector3(u, 0, v), 4, 4, 0.1), 0.1],
    ['thickSurface twisted', () => thickSurface((u, v) => new THREE.Vector3(u * 0.5, v * 0.3, -v * 0.2 * (1 + u)), 10, 8, 0.01)],
    ['plateXZ', () => plateXZ([[0, 0], [1, 0], [0, 1]], 0.1), 0.05],
    ['plateXY', () => plateXY([[0, 0], [1, 0], [1, 1], [0, 1]], 0.2), 0.2],
    ['rod', () => rod([0, 0, 0], [1, 1, 0], 0.05)],
    ['bar', () => bar([0, 0, 0], [1, 0.2, 0.5], 0.1, 0.05)],
  ]
  for (const [name, make, vol] of cases)
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      const v = volume(g)
      expect(v).toBeGreaterThan(0)
      if (vol !== undefined) expect(v).toBeCloseTo(vol, 3)
    })
})
