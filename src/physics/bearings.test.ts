import { describe, expect, it } from 'vitest'
import {
  ROTATION_FACTOR,
  afbmaStatic,
  ballSpin,
  cageSpeed,
  equivalentLoad,
  lifeHours,
  loadForLife,
  medianOverL10,
  ratingLife,
  staticEquivalentLoad,
  stribeckBall,
  stribeckRoller,
  survival,
} from './bearings'

describe('static capacity — AEE503 Module 7', () => {
  it('Stribeck, 208 bearing, 9 balls × 12 mm, K = 60.8×10⁶ → C₀ = 15 760 N (M7 Example 1, MG15 Q4c)', () => {
    expect(stribeckBall(60.8e6, 9, 0.012)).toBeCloseTo(15759.4, 0)
  })
  it('AFBMA, f₀ = 12.26×10⁶, i = 1, Z = 9, D = 12 mm, α = 0 → C₀ = 15 890 N (M7 Example 1c, MG16 Q4e, MG19)', () => {
    expect(afbmaStatic(12.26e6, 1, 9, 0.012, 0)).toBeCloseTo(15889, 0)
  })
  it('double row, 11 balls × 10 mm per row (Z = 22) → C₀ = 26 800 N (MG17 Q6c)', () => {
    expect(stribeckBall(60.8e6, 22, 0.01)).toBeCloseTo(26752, 0)
    expect(Math.round(stribeckBall(60.8e6, 22, 0.01) / 100) * 100).toBe(26800)
  })
  it('roller form C₀ = KZDL/5', () => {
    expect(stribeckRoller(1e7, 10, 0.01, 0.01)).toBeCloseTo(2000, 9)
  })
  it('P₀ = 0.6(13.2) + 0.5(4.4) = 10.1 kN < F_r → use 13.2 kN (M7 Example 2)', () => {
    const r = staticEquivalentLoad(0.6, 0.5, 13.2e3, 4.4e3)
    expect(r.raw).toBeCloseTo(10120, 6)
    expect(r.P0).toBeCloseTo(13200, 6)
    expect(r.governedByFr).toBe(true)
  })
})

describe('dynamic capacity and life — AEE503 Module 7', () => {
  it('L = (C/P)³ million revolutions: doubling C gives 8× the life', () => {
    expect(ratingLife(2000, 1000)).toBeCloseTo(8, 12)
    expect(ratingLife(30000, 3000)).toBeCloseTo(1000, 9)
  })
  it('P = XVF_r + YF_a with V = 1.2 for a stationary inner ring', () => {
    expect(equivalentLoad(0.56, ROTATION_FACTOR.outer, 1000, 1.5, 200)).toBeCloseTo(0.56 * 1.2 * 1000 + 300, 9)
  })
  it('hours at constant speed; inverse load for a target life', () => {
    expect(lifeHours(60, 1000)).toBeCloseTo(1000, 9)
    expect(ratingLife(30000, loadForLife(30000, 500))).toBeCloseTo(500, 9)
  })
  it('L10 definition: 90 % of the group survive to L10 (survival model beyond notes)', () => {
    expect(survival(1, 1)).toBeCloseTo(0.9, 12)
    expect(survival(medianOverL10(1.5), 1, 1.5)).toBeCloseTo(0.5, 12)
  })
  it('ball-set kinematics (beyond notes): cage turns at a bit under half shaft speed', () => {
    const wc = cageSpeed(100, 0.012, 0.06)
    expect(wc).toBeCloseTo(40, 9)
    expect(ballSpin(100, 0.012, 0.06)).toBeCloseTo(240, 9)
  })
})
