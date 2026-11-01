import { describe, expect, it } from 'vitest'
import { bowAt, modeShape, southwell } from './Rig'

describe('buckled shapes meet their end conditions', () => {
  const h = 1e-4
  const slope = (e: Parameters<typeof modeShape>[0], u: number) => (modeShape(e, u + h) - modeShape(e, u - h)) / (2 * h)
  it('pinned both ends: no sideways shift at either end', () => {
    expect(modeShape('pinned-pinned', 0)).toBeCloseTo(0, 9)
    expect(modeShape('pinned-pinned', 1)).toBeCloseTo(0, 9)
  })
  it('fixed both ends: no shift or slope at either end', () => {
    expect(modeShape('fixed-fixed', 0)).toBeCloseTo(0, 9)
    expect(modeShape('fixed-fixed', 1)).toBeCloseTo(0, 9)
    expect(slope('fixed-fixed', h)).toBeCloseTo(0, 2)
  })
  it('fixed and pinned: fixed at the base, no shift at the top, peak of about 1', () => {
    expect(modeShape('fixed-pinned', 0)).toBeCloseTo(0, 9)
    expect(slope('fixed-pinned', h)).toBeCloseTo(0, 2)
    expect(modeShape('fixed-pinned', 1)).toBeCloseTo(0, 3)
    let peak = 0
    for (let u = 0; u <= 1; u += 0.002) peak = Math.max(peak, modeShape('fixed-pinned', u))
    expect(peak).toBeCloseTo(1, 1)
  })
  it('fixed and free: fixed at the base, free to move at the top', () => {
    expect(modeShape('fixed-free', 0)).toBeCloseTo(0, 9)
    expect(modeShape('fixed-free', 1)).toBeCloseTo(1, 9)
  })
})

describe('the bench readings', () => {
  it('Southwell gets the critical load back from readings well below it', () => {
    const Pcr = 400
    const loads = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((r) => r * Pcr)
    const bows = loads.map((P) => bowAt(2.5, P / Pcr) * 1000)
    expect(southwell(loads, bows)).toBeCloseTo(Pcr, 3)
  })
  it('the bow grows without limit as the load nears the critical load', () => {
    expect(bowAt(2, 0.9)).toBeGreaterThan(5 * bowAt(2, 0.5))
  })
})
