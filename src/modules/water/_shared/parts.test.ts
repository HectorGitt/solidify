import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { dripEmitter, pipeRun, sprinklerHead, storageTank, wellCasing, wellScreen } from '@/parts/lib/water'

function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const ng = g.index ? g.toNonIndexed() : g
  const pos = ng.getAttribute('position')
  const key = (i: number) =>
    `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
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

describe('water parts from the library are closed and outward-facing', () => {
  const cases: [string, () => THREE.BufferGeometry][] = [
    ['pipe run', () => pipeRun({ a: [0, 0, 0], b: [5, 0, 0], outer: 0.07, inner: 0.06 })],
    ['well casing', () => wellCasing({ r: 0.35, length: 10 })],
    ['well screen', () => wellScreen({ r: 0.35, length: 4 })],
    ['storage tank', () => storageTank({ r: 1.15, h: 2.1, ring: false })],
    ['sprinkler head body', () => sprinklerHead()],
    ['drip emitter', () => dripEmitter()],
  ]
  for (const [name, make] of cases) {
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      expect(volume(g)).toBeGreaterThan(0)
    })
  }
})
