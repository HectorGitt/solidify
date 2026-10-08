import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { crossedBeltLength, crossedBeltWrap, openBeltLength, openBeltWrap } from '@/physics/elements'
import { beltLoop, crossedLoop, flatSection, meshPhase, openLoop, signedVolume, sweepLoop, vSection } from './loop'

/** Count edges not shared by exactly two triangles (0 = watertight). */
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

const maxKink = (loop: ReturnType<typeof beltLoop>) => {
  let k = 0
  for (const g of loop.segs) {
    for (const s of [g.s0, g.s1]) {
      const a = loop.tangentAt(s - 1e-7)
      const b = loop.tangentAt(s + 1e-7)
      a.z = 0
      b.z = 0
      k = Math.max(k, a.angleTo(b))
    }
  }
  return k
}

describe('belt loop geometry — AEE503 Module 4 wrap angles', () => {
  it('open belt: wraps and exact length match sin β = (R − r)/C, α = 180° ∓ 2β; spans are tangent', () => {
    const L = openLoop([0, 0], 0.125, [1.25, 0], 0.25)
    const w = openBeltWrap(0.25, 0.125, 1.25)
    expect(L.wraps[0]).toBeCloseTo(w.small, 9)
    expect(L.wraps[1]).toBeCloseTo(w.large, 9)
    expect(L.length).toBeCloseTo(openBeltLength(0.25, 0.125, 1.25), 9)
    expect(maxKink(L)).toBeLessThan(1e-5)
  })
  it('crossed belt 250/500 mm, C = 1.25 m: 214.9° on both pulleys, exact length; spans tangent', () => {
    const L = crossedLoop([0, 0], 0.125, [1.25, 0], 0.25)
    const w = crossedBeltWrap(0.25, 0.125, 1.25)
    expect((L.wraps[0] * 180) / Math.PI).toBeCloseTo(214.9, 1)
    expect(L.wraps[1]).toBeCloseTo(w.wrap, 9)
    expect(L.length).toBeCloseTo(crossedBeltLength(0.25, 0.125, 1.25), 9)
    expect(maxKink(L)).toBeLessThan(1e-5)
  })
  it('a back-side idler on the slack span increases both wraps', () => {
    const plain = openLoop([0, 0], 0.1, [1, 0], 0.25)
    const idler = beltLoop([
      { c: [0, 0], r: 0.1, s: 1 },
      { c: [0.35, -0.04], r: 0.05, s: -1 },
      { c: [1, 0], r: 0.25, s: 1 },
    ])
    expect(idler.wraps[0]).toBeGreaterThan(plain.wraps[0])
    expect(idler.wraps[2]).toBeGreaterThan(plain.wraps[1])
    expect(maxKink(idler)).toBeLessThan(1e-5)
  })
  it('swept flat and V belts are closed and outward-facing', () => {
    const L = openLoop([0, 0], 0.125, [1.25, 0], 0.25)
    const flat = sweepLoop(L, flatSection(0.09, 0.006), 200)
    expect(openEdges(flat)).toBe(0)
    expect(signedVolume(flat)).toBeGreaterThan(0)
    const v = sweepLoop(L, vSection(0.013, 0.008, (40 * Math.PI) / 180, 0.003), 200)
    expect(openEdges(v)).toBe(0)
    expect(signedVolume(v)).toBeGreaterThan(0)
    const crossed = sweepLoop(crossedLoop([0, 0], 0.125, [1.25, 0], 0.25, 0.06), flatSection(0.09, 0.006), 200)
    expect(openEdges(crossed)).toBe(0)
    expect(signedVolume(crossed)).toBeGreaterThan(0)
  })
  it('gear mesh phase reproduces the four-stroke cam-gear rule', () => {
    expect(meshPhase(0.3, 22, 44)).toBeCloseTo(1.5 * 0.3 + Math.PI - Math.PI / 44, 12)
  })
})
