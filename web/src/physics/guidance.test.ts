import { describe, expect, it } from 'vitest'
import { FIX, coverageStats, crossTrack, gaussMarkov, makeCoverage, makePlan, nearest, paint, purePursuit, rng, stepVehicle, type Vehicle } from './guidance'

describe('error models', () => {
  it('rng is deterministic and gaussian-ish', () => {
    const a = rng(7)
    const b = rng(7)
    expect(a.next()).toBe(b.next())
    const r = rng(1)
    let s = 0
    let s2 = 0
    const N = 20000
    for (let i = 0; i < N; i++) {
      const g = r.gauss()
      s += g
      s2 += g * g
    }
    expect(Math.abs(s / N)).toBeLessThan(0.03)
    expect(Math.sqrt(s2 / N)).toBeCloseTo(1, 1)
  })

  it('Gauss–Markov keeps the stationary standard deviation σ', () => {
    const r = rng(3)
    let e = 0
    let s2 = 0
    const N = 200000
    for (let i = 0; i < N; i++) {
      e = gaussMarkov(e, 0.1, 0.5, 5, r.gauss())
      s2 += e * e
    }
    expect(Math.sqrt(s2 / N)).toBeCloseTo(0.5, 1)
  })

  it('RTK is two orders of magnitude tighter than standalone', () => {
    expect(FIX.gps.sigma / FIX.rtk.sigma).toBeGreaterThan(50)
  })
})

describe('plan', () => {
  const plan = makePlan(100, 6, 4)
  it('passes are W apart and alternate direction', () => {
    expect(plan.passes.map((p) => p.z)).toEqual([-9, -3, 3, 9])
    expect(plan.passes.map((p) => p.dir)).toEqual([1, -1, 1, -1])
  })
  it('path is continuous (no jumps bigger than the point spacing)', () => {
    for (let i = 1; i < plan.pts.length; i++) {
      const a = plan.pts[i - 1]
      const b = plan.pts[i]
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(plan.ds * 1.5)
    }
  })
  it('cross-track sign: + is right of travel', () => {
    const i = plan.pts.findIndex((p) => p.pass === 0)
    // heading +X, right is +Z
    expect(crossTrack(plan, i, plan.pts[i].x, plan.pts[i].z + 0.2)).toBeCloseTo(0.2, 9)
  })
})

describe('pure pursuit on the bicycle model', () => {
  it('pulls onto the line from 1 m off and holds it within 2 cm', () => {
    const plan = makePlan(200, 6, 1)
    const v: Vehicle = { x: plan.pts[0].x, z: plan.pts[0].z + 1, h: 0, steer: 0 }
    let i = 0
    let worst = 0
    for (let t = 0; t < 60; t += 0.02) {
      i = nearest(plan, v.x, v.z, i)
      const c = purePursuit(plan, i, v.x, v.z, v.h, 4, 2.5, 0.6)
      stepVehicle(v, c.steer, 3, 0.02, 2.5, 0.15, 0.8)
      if (t > 25) worst = Math.max(worst, Math.abs(crossTrack(plan, i, v.x, v.z)))
    }
    expect(worst).toBeLessThan(0.02)
  })

  it('turns right for positive steer', () => {
    const v: Vehicle = { x: 0, z: 0, h: 0, steer: 0.3 }
    stepVehicle(v, 0.3, 2, 1, 2.5, 0.01, 10)
    expect(v.h).toBeLessThan(0)
    stepVehicle(v, 0.3, 2, 1, 2.5, 0.01, 10)
    expect(v.z).toBeGreaterThan(0)
  })
})

describe('coverage', () => {
  it('perfect spacing leaves no overlap and no gap', () => {
    const c = makeCoverage(-10, 10, -10, 10)
    for (const [k, z] of [[0, -3], [1, 3]] as const) for (let x = -9; x <= 9; x += 0.2) paint(c, x, z, 0, 6, k)
    const s = coverageStats(c, -6, 6, -8, 8)
    expect(s.overlap).toBeLessThan(0.01)
    expect(s.gap).toBeLessThan(0.01)
  })

  it('passes 0.6 m too close overlap by 0.6/12', () => {
    const c = makeCoverage(-10, 10, -10, 10)
    for (const [k, z] of [[0, -3], [1, 2.4]] as const) for (let x = -9; x <= 9; x += 0.2) paint(c, x, z, 0, 6, k)
    const s = coverageStats(c, -6, 5.4, -8, 8)
    expect(s.overlap).toBeCloseTo(0.6 / 11.4, 1)
  })

  it('the same pass never double-counts', () => {
    const c = makeCoverage(-10, 10, -10, 10)
    for (let r = 0; r < 3; r++) for (let x = -9; x <= 9; x += 0.2) paint(c, x, 0, 0, 6, 0)
    expect(coverageStats(c, -3, 3, -8, 8).overlap).toBe(0)
  })
})
