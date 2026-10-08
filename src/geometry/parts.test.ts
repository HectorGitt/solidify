import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bevelGear, bevelPair, beltBand, chainLink, hexBolt, loopPath, rim, splineShaft, sprocket, sprocketRadius, torus, tyre } from './parts'

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

describe('shared part generators are closed and outward-facing', () => {
  const closed: [string, () => THREE.BufferGeometry][] = [
    ['bevel gear', () => bevelGear({ teeth: 11, module: 0.008, faceWidth: 0.04, pitchAngleDeg: bevelPair(11, 41).pinion, bore: 0.02 })],
    ['bevel crown wheel', () => bevelGear({ teeth: 41, module: 0.008, faceWidth: 0.04, pitchAngleDeg: bevelPair(11, 41).gear })],
    ['spline shaft (PTO 6 × Ø35)', () => splineShaft(6, 0.0175, 0.0145, 0.08)],
    ['sprocket', () => sprocket(17, 0.01905, 0.0119, 0.011, 0.012)],
    ['belt band', () => beltBand(loopPath(new THREE.Vector2(0, 0), 0.125, new THREE.Vector2(1.25, 0), 0.25).path, 0.09, 0.006)],
  ]
  for (const [name, make] of closed) {
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  }
  for (const [name, make] of [
    ['tyre R-1', () => tyre({ radius: 0.7, width: 0.38, rimRadius: 0.36, lugs: 22, pattern: 'R1' })],
    ['tyre F-2', () => tyre({ radius: 0.4, width: 0.17, rimRadius: 0.2, pattern: 'F2' })],
    ['rim', () => rim(0.36, 0.3)],
    ['chain link', () => chainLink(0.01905, 0.0119, 0.017)],
    ['hex bolt', () => hexBolt(0.012, 0.05)],
    ['torus', () => torus(0.03, 0.003)],
  ] as [string, () => THREE.BufferGeometry][]) {
    it(`${name} (merged solids: positive volume)`, () => expect(volume(make())).toBeGreaterThan(0))
  }
})

describe('belt geometry — AEE503 Module 4', () => {
  it('crossed belt 250/500 mm at C = 1.25 m wraps 214.9° on both pulleys (MG15/T19)', () => {
    const { wrap1, wrap2 } = loopPath(new THREE.Vector2(0, 0), 0.125, new THREE.Vector2(1.25, 0), 0.25, true)
    expect((wrap1 * 180) / Math.PI).toBeCloseTo(214.9, 1)
    expect(wrap2).toBeCloseTo(wrap1, 9)
  })
  it('open belt: α1 = 180° − 2β on the small pulley, α2 = 180° + 2β on the large, sin β = (R − r)/C', () => {
    const r = 0.125
    const R = 0.25
    const C = 1.25
    const { wrap1, wrap2, length } = loopPath(new THREE.Vector2(0, 0), R, new THREE.Vector2(C, 0), r)
    const beta = Math.asin((R - r) / C)
    expect(wrap2).toBeCloseTo(Math.PI - 2 * beta, 9) // small pulley
    expect(wrap1).toBeCloseTo(Math.PI + 2 * beta, 9) // large pulley
    // exact open-belt length: 2C cos β + R(π + 2β) + r(π − 2β)
    expect(length).toBeCloseTo(2 * C * Math.cos(beta) + R * (Math.PI + 2 * beta) + r * (Math.PI - 2 * beta), 2) // arcs are polylines
  })
  it('straight spans are tangent to both pulleys (no kink) for open and crossed belts', () => {
    for (const crossed of [false, true]) {
      const c1 = new THREE.Vector2(0, 0)
      const c2 = new THREE.Vector2(1.25, 0)
      const { path } = loopPath(c1, 0.25, c2, 0.125, crossed)
      const curves = path.curves as THREE.LineCurve3[]
      // find the two long straight spans and check each is perpendicular to the radius at both ends
      const spans = curves.filter((c) => c.v1.distanceTo(c.v2) > 0.3)
      expect(spans.length).toBe(2)
      for (const s of spans) {
        const dir = s.v2.clone().sub(s.v1).normalize()
        for (const [p, c] of [
          [s.v1, s.v1.distanceTo(new THREE.Vector3(0, 0, 0)) < 0.3 ? c1 : c2],
          [s.v2, s.v2.distanceTo(new THREE.Vector3(0, 0, 0)) < 0.3 ? c1 : c2],
        ] as [THREE.Vector3, THREE.Vector2][]) {
          const radius = p.clone().sub(new THREE.Vector3(c.x, c.y, 0)).normalize()
          expect(Math.abs(radius.dot(dir))).toBeLessThan(1e-6)
        }
      }
      if (crossed) {
        // the spans cross: they intersect between the pulleys
        const [a, b] = spans
        const denom = (a.v2.x - a.v1.x) * (b.v2.y - b.v1.y) - (a.v2.y - a.v1.y) * (b.v2.x - b.v1.x)
        expect(Math.abs(denom)).toBeGreaterThan(1e-6)
      }
    }
  })

  it('sprocket pitch radius = p / (2 sin(π/z))', () => {
    expect(sprocketRadius(17, 0.01905)).toBeCloseTo(0.01905 / (2 * Math.sin(Math.PI / 17)), 12)
  })
})
