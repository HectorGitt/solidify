import { describe, expect, it } from 'vitest'
import { modeShape } from './Rig'

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
