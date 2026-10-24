import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  boxShell,
  centrifugalFan,
  cyclone,
  dustBin,
  eccentricCrank,
  feedRoller,
  hopper,
  leafSpring,
  pitmanRod,
  rotaryValve,
  screenBox,
  screenDeck,
  shakerBase,
  shakerLid,
  testSieve,
  vortexFinder,
} from '@/parts/lib/processing'

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

describe('separation procedural geometry generators are closed and outward-facing', () => {
  const generators: [string, () => THREE.BufferGeometry][] = [
    ['sieve rim', () => testSieve({ r: 0.12, h: 0.04, lip: 0.003 }).rim],
    ['sieve pan', () => testSieve({ r: 0.12, h: 0.04 }).pan],
    ['sieve mesh', () => testSieve({ r: 0.12, h: 0.04 }).mesh],
    ['shaker base', () => shakerBase({ rBase: 0.18, rTop: 0.14, h: 0.22 })],
    ['shaker lid', () => shakerLid({ r: 0.12 })],
    ['hopper', () => hopper({ top: 0.4, bottom: 0.1, h: 0.25 })],
    ['boxShell', () => boxShell({ w: 0.3, d: 0.25, h: 0.5, t: 0.015 })],
    ['screen box', () => screenBox({ len: 0.8, width: 0.4, height: 0.2, wall: 0.015 })],
    ['screen deck', () => screenDeck({ len: 0.75, width: 0.38 })],
    ['leaf spring', () => leafSpring({ len: 0.25, width: 0.05 })],
    ['eccentric crank', () => eccentricCrank({ r: 0.08, t: 0.025, pinOffset: 0.012 })],
    ['pitman rod', () => pitmanRod({ len: 0.3 })],
    ['fan housing', () => centrifugalFan({ r: 0.18, width: 0.12 }).housing],
    ['fan impeller', () => centrifugalFan({ r: 0.18, width: 0.12 }).impeller],
    ['feed roller', () => feedRoller({ r: 0.04, length: 0.35 })],
    ['cyclone body', () => cyclone({ rBarrel: 0.25, rApex: 0.08, hBarrel: 0.35, hCone: 0.5 }).body],
    ['cyclone roof', () => cyclone({ rBarrel: 0.25, rApex: 0.08, hBarrel: 0.35, hCone: 0.5 }).roof],
    ['vortex finder', () => vortexFinder({ r: 0.1, length: 0.3 })],
    ['airlock casing', () => rotaryValve({ r: 0.07, width: 0.12 }).casing],
    ['airlock rotor', () => rotaryValve({ r: 0.07, width: 0.12 }).rotor],
    ['dust bin', () => dustBin({ r: 0.14, h: 0.28 })],
  ]

  for (const [name, make] of generators) {
    it(name, () => {
      const g = make()
      expect(openEdges(g)).toBe(0)
      const v = volume(g)
      expect(v).toBeGreaterThan(0)
    })
  }
})
