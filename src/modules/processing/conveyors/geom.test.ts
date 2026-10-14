import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  auger,
  boxShell,
  centrifugalFan,
  conveyorPulley,
  cyclone,
  elevatorBucket,
  electricMotor,
  gearbox,
  hopper,
  prism,
  rotaryValve,
  screwFlight,
  sweepRing,
  thickPolyline,
  troughedBelt,
  troughingIdlers,
  uTrough,
} from '@/parts/lib/processing'
import { arrowSolid } from './geom'

function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const ng = g.index ? g.toNonIndexed() : g
  const pos = ng.getAttribute('position')
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
  const ng = g.index ? g.toNonIndexed() : g
  const p = ng.getAttribute('position')
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

describe('processing geometry helpers are closed and outward-facing', () => {
  const ring = new THREE.EllipseCurve(0, 0, 1, 1, 0, 2 * Math.PI, false, 0)
  const pts = ring.getSpacedPoints(64).slice(0, -1).map((p) => new THREE.Vector3(p.x, p.y, 0))
  const cases: [string, () => THREE.BufferGeometry, number?][] = [
    [
      'sweepRing (belt band)',
      () =>
        sweepRing(pts, () => [
          [-0.1, 0],
          [0.1, 0],
          [0.1, 0.01],
          [-0.1, 0.01],
        ]).toNonIndexed(),
    ],
    ['hopper', () => hopper({ top: 0.6, bottom: 0.15, h: 0.5 })],
    ['uTrough', () => uTrough({ r: 0.1, t: 0.005, L: 1, hs: 0.12 })],
    ['screwFlight', () => screwFlight({ rIn: 0.03, rOut: 0.1, pitch: 0.2, L: 0.8, t: 0.006 })],
    ['auger shaft', () => auger({ D: 0.2, d: 0.06, pitch: 0.2, L: 0.8 }).shaft],
    ['boxShell', () => boxShell({ w: 0.3, d: 0.2, h: 1, t: 0.01 }), 0.3 * 0.2 - 0.28 * 0.18],
    ['thick polyline prism', () => prism(thickPolyline([[0, 0], [0.1, 0], [0.1, 0.1]], 0.01), 0.2)],
    ['troughed belt', () => troughedBelt({ c: 1.6, r: 0.16, B: 0.6, t: 0.012, trough: 0.35 }).toNonIndexed()],
    ['conveyor pulley drum', () => conveyorPulley({ r: 0.16, width: 0.62 }).drum],
    ['troughing idlers (one roll set)', () => troughingIdlers({ B: 0.6, trough: 0.35, xs: [0], returnXs: [0] }).carry],
    ['elevator bucket', () => elevatorBucket({ w: 0.26 })],
    ['cyclone body', () => cyclone({ rBarrel: 0.36, rApex: 0.08, hBarrel: 0.8, hCone: 0.8 }).body],
    ['cyclone roof', () => cyclone({ rBarrel: 0.36, rApex: 0.08, hBarrel: 0.8, hCone: 0.8 }).roof],
    ['fan impeller hub', () => centrifugalFan({ r: 0.3, width: 0.22 }).impeller],
    ['airlock rotor', () => rotaryValve({ r: 0.1, width: 0.2 }).rotor],
    ['electric motor', () => electricMotor({ r: 0.11, length: 0.32 })],
    ['gearbox', () => gearbox({ w: 0.3, h: 0.26, d: 0.28 })],
    ['arrow', () => arrowSolid(1, 0.3, 0.02)],
  ]
  for (const [name, make, expected] of cases) {
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      const v = volume(g)
      expect(v).toBeGreaterThan(0)
      if (expected) expect(Math.abs(v - expected) / expected).toBeLessThan(0.03)
    })
  }
})
