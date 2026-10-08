import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildTractorGeometry } from './geometry'
/** Every edge of a closed 2-manifold is shared by exactly two triangles. */
function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const pos = g.getAttribute('position')
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
  const edges = new Map<string, number>()
  const tri = pos.count / 3
  for (let t = 0; t < tri; t++) {
    const k = [key(3 * t), key(3 * t + 1), key(3 * t + 2)]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue // degenerate
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

/** Signed volume via divergence theorem: positive for outward-facing closed meshes. */
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


describe('shared tractor geometry', () => {
  const G = buildTractorGeometry()
  for (const [name, g] of Object.entries(G)) {
    it(`${name} is closed and outward-facing`, () => {
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  }
  it('stays inside the triangle budget (≈150k per scene)', () => {
    const tris = Object.values(G).reduce((n, g) => n + g.getAttribute('position').count / 3, 0)
    expect(tris).toBeLessThan(120_000)
  })
})
