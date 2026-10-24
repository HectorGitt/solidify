import { describe, expect, it } from 'vitest'
import { frictionPairs, frictionRadiusUniformPressure, pressureUniformWear } from './clutch'
import {
  capstanRatio,
  clutchForceForTorque,
  coneFaceWidth,
  coneMeanRadius,
  crossedBeltWrap,
  discOuterRadius,
  ropePulleyDiameter,
  ropeWinch,
  shoeNormalForce,
  spurForces,
  stribeckBall,
  wahlFactor,
} from './elements'

describe('elements barrel re-exports every topic', () => {
  it('belts, gears, bearings, brakes, springs are reachable from @/physics/elements', () => {
    expect((crossedBeltWrap(0.25, 0.125, 1.25).wrap * 180) / Math.PI).toBeCloseTo(214.9, 1)
    expect(spurForces(200, 0.05, (20 * Math.PI) / 180).Ft).toBeCloseTo(4000, 9)
    expect(stribeckBall(60.8e6, 9, 0.012)).toBeCloseTo(15759.4, 0)
    expect(shoeNormalForce(225, 0.3, 0.36)).toBeCloseTo(2083, 0)
    expect(wahlFactor(8)).toBeCloseTo(1.184, 3)
  })
})

describe('rope winch / capstan — AEE503 Module 6 (Q2017/18, E2018/19, E2021/22)', () => {
  it('4 turns, f = 0.1 → α = 8π, e^(fα) = 12.35', () => {
    expect(capstanRatio(0.1, 4)).toBeCloseTo(12.35, 2)
  })
  it('330 N pull, Ø275 mm drum, 0.36 m/s → T₁ ≈ 4.08 kN, P ≈ 1.35 kW', () => {
    const w = ropeWinch(330, 0.1, 4, 0.275, 0.36)
    expect(w.T1 / 1000).toBeCloseTo(4.08, 1) // 4.074 kN exact; the guide multiplies by the rounded 12.35
    expect(w.P / 1000).toBeCloseTo(1.35, 2)
    expect(w.rpm).toBeCloseTo(25, 0)
  })
  it('pulley about 40d, not less than 36d', () => {
    const p = ropePulleyDiameter(0.02)
    expect(p.recommended).toBeCloseTo(0.8, 12)
    expect(p.minimum).toBeCloseTo(0.72, 12)
  })
})

describe('clutch design — AEE503 Module 8 (MG16) with ./clutch', () => {
  it('9 discs (5 steel + 4 bronze) → 8 friction pairs', () => {
    expect(frictionPairs(5, 4)).toBe(8)
  })
  it('16 N·m, D_i = 50 mm, f = 0.1, p = 350 kPa, n = 8 → D_o ≈ 70 mm and F = 667 N (uniform wear)', () => {
    const Ro = discOuterRadius(16, 350e3, 0.025, 0.1, 8, 'wear')
    expect(Math.abs(2 * Ro * 1000 - 70)).toBeLessThan(0.5)
    expect(clutchForceForTorque(16, 0.1, 0.035, 0.025, 8, 'wear')).toBeCloseTo(666.7, 1)
  })
  it('the uniform-pressure radius is larger, so a new clutch needs slightly less outer radius', () => {
    expect(frictionRadiusUniformPressure(0.035, 0.025)).toBeGreaterThan(0.03)
    expect(discOuterRadius(16, 350e3, 0.025, 0.1, 8, 'pressure')).toBeLessThan(discOuterRadius(16, 350e3, 0.025, 0.1, 8, 'wear'))
  })
  it('plate, F = 4000 N, R_i = 50, R_o = 100 mm → p_max 254.6, p_min 127.3, p_avg 169.8 kPa (calc)', () => {
    expect(pressureUniformWear(4000, 0.05, 0.1, 0.05) / 1e3).toBeCloseTo(254.6, 1)
    expect(pressureUniformWear(4000, 0.1, 0.1, 0.05) / 1e3).toBeCloseTo(127.3, 1)
    expect(4000 / (Math.PI * (0.1 ** 2 - 0.05 ** 2)) / 1e3).toBeCloseTo(169.8, 1)
  })
  it('cone clutch mean radius is ½(R_o + R_i), not ½(R_o − R_i) (errata cone-clutch); face width (R_o − R_i)/sin α', () => {
    expect(coneMeanRadius(0.15, 0.1)).toBeCloseTo(0.125, 12)
    expect(coneFaceWidth(0.15, 0.1, Math.PI / 6)).toBeCloseTo(0.1, 12)
  })
})
