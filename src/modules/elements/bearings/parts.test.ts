import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { bearingGeometry, housingGeometry } from './parts'
import { TYPES, type BearingType } from './model'

function volume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  let v = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const idx = g.index
  const n = idx ? idx.count : p.count
  const at = (i: number) => (idx ? idx.getX(i) : i)
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, at(i))
    b.fromBufferAttribute(p, at(i + 1))
    c.fromBufferAttribute(p, at(i + 2))
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

function openEdges(g: THREE.BufferGeometry, eps = 1e-7) {
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

const types = Object.keys(TYPES) as BearingType[]

describe('bearing solids are closed and outward-facing (sectioned parts)', () => {
  for (const t of types) {
    it(`${t}: races, bush, oil film, housing and pedestal`, () => {
      const g = bearingGeometry(t)
      const h = housingGeometry(t)
      const solids = [g.inner, g.outer, g.bush, g.oil, h.housing, h.pedestal].filter(Boolean) as THREE.BufferGeometry[]
      for (const s of solids) {
        expect(openEdges(s)).toBe(0)
        expect(volume(s)).toBeGreaterThan(0)
      }
    })
  }
  it('6208: 9 balls of 12 mm on a 60 mm pitch circle (M7 Example 1)', () => {
    expect(bearingGeometry('ball').placements).toHaveLength(9)
    const p = new THREE.Vector3().setFromMatrixPosition(bearingGeometry('ball').placements[3])
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(0.03, 9)
  })
  it('tapered rollers point at a common apex on the axis', () => {
    const g = bearingGeometry('taper')
    for (const m of g.placements.slice(0, 4)) {
      const pos = new THREE.Vector3().setFromMatrixPosition(m)
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(m))
      // move along the roller axis until the radius is zero
      const s = Math.hypot(pos.x, pos.z) / Math.hypot(axis.x, axis.z)
      const apex = pos.clone().addScaledVector(axis, s)
      expect(Math.hypot(apex.x, apex.z)).toBeLessThan(1e-9)
      expect(apex.y).toBeCloseTo(0.03 / Math.tan((13 * Math.PI) / 180), 6)
    }
  })
})
