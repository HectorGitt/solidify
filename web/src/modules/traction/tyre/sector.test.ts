import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { latheSector } from './sector'

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

describe('latheSector is watertight and outward-facing', () => {
  const ring: [number, number][] = [
    [0.5, -0.1],
    [0.6, -0.1],
    [0.6, 0.1],
    [0.5, 0.1],
  ]
  const exact = (len: number) => (len / 2) * (0.6 ** 2 - 0.5 ** 2) * 0.2
  for (const len of [0.5, 2, 5.5]) {
    it(`rectangular ring sector, ${len} rad`, () => {
      const g = latheSector(ring, 1.2, len, 96)
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeCloseTo(exact(len), 3)
    })
  }
  it('curved (crescent) profile, as used for tyre layers', () => {
    const prof: [number, number][] = []
    for (let i = 0; i <= 20; i++) prof.push([0.7 + 0.1 * Math.cos(-Math.PI / 2 + (Math.PI * i) / 20), 0.15 * Math.sin(-Math.PI / 2 + (Math.PI * i) / 20)])
    for (let i = 20; i >= 0; i--) prof.push([0.7 + 0.09 * Math.cos(-Math.PI / 2 + (Math.PI * i) / 20), 0.14 * Math.sin(-Math.PI / 2 + (Math.PI * i) / 20)])
    const g = latheSector(prof, 0.3, 4, 64)
    expect(openEdges(g)).toBe(0)
    expect(volume(g)).toBeGreaterThan(0)
  })
  it('full revolution falls back to a closed lathe', () => {
    const g = latheSector(ring, 0, 2 * Math.PI, 64)
    expect(volume(g)).toBeCloseTo(Math.PI * (0.6 ** 2 - 0.5 ** 2) * 0.2, 2)
  })
})
