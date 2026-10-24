import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { chainMat, concaveDisc, discDish, landWheel, lBlade, pathBar, pathRod, shovel, spike, steelWheel, sweepBlade } from './parts'

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

describe('tillage generators are watertight and outward-facing', () => {
  const cases: [string, () => THREE.BufferGeometry][] = [
    ['concave disc', () => concaveDisc(0.33, 0.07, 0.006)],
    ['concave disc with hub hole', () => concaveDisc(0.25, 0.04, 0.005, 48, 0.03)],
    ['path bar (C-shank)', () => pathBar([[0, 0, 0], [-0.1, -0.2, 0], [-0.05, -0.45, 0], [0.05, -0.5, 0]], 0.03, 0.012)],
    ['path rod', () => pathRod([[0, 0, 0], [0.2, 0.1, 0], [0.3, 0.4, 0.1]], 0.01)],
    ['shovel', () => shovel(0.06, 0.18)],
    ['sweep blade', () => sweepBlade(0.3, 0.1, 0.06)],
    ['L-blade', () => lBlade(0.1, 0.24, 0.09)],
    ['spike', () => spike(0.18)],
    ['chain mat', () => chainMat(3, 3, 0.06, 0.006)],
    ['steel wheel', () => steelWheel(0.3, 0.06, 6, 8)],
    ['land wheel tyre', () => landWheel(0.25, 0.1).tyre],
  ]
  for (const [name, make] of cases)
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  it('disc dish: zero at the rim, c at the centre', () => {
    expect(discDish(0.33, 0.07, 0.33)).toBeCloseTo(0, 9)
    expect(discDish(0.33, 0.07, 0)).toBeCloseTo(0.07, 9)
  })
})
