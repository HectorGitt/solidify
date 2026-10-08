import { describe, expect, it } from 'vitest'
import {
  bandRatio,
  bandTensions,
  differentialBandForce,
  differentialSelfLocking,
  dissipationCoefficient,
  doubleShoeTorque,
  heatGenerated,
  internalShoeMf,
  internalShoeMn,
  longShoeTorque,
  selfLockingArm,
  shoeLeverForce,
  shoeNormalForce,
} from './brakes'

const rad = (d: number) => (d * Math.PI) / 180

describe('single shoe brake, Fig 15-10 — AEE503 Module 9 Example 1 (also MG15 Q5c, MG17, MG19 Q6b)', () => {
  const R = 0.36
  const a = 0.36
  const b = 0.9
  const c = 0.04
  const f = 0.3
  const N = shoeNormalForce(225, f, R)
  it('N = 2083 N, friction fN = 625 N', () => {
    expect(N).toBeCloseTo(2083, 0)
    expect(f * N).toBeCloseTo(625, 0)
  })
  it('clockwise (friction aids): F = 805 N; counter-clockwise: F = 861 N', () => {
    // exact 805.6 N and 861.1 N; the notes truncate
    expect(Math.abs(shoeLeverForce(N, f, a, b, c, 'aiding') - 805)).toBeLessThan(1)
    expect(Math.abs(shoeLeverForce(N, f, a, b, c, 'opposing') - 861)).toBeLessThan(1)
  })
  it('self-locking when c ≥ a/f = 1.2 m', () => {
    expect(selfLockingArm(a, f)).toBeCloseTo(1.2, 12)
    expect(shoeLeverForce(N, f, a, b, 1.2, 'aiding')).toBeCloseTo(0, 9)
  })
  it('H_g = fNV = 11.8 kW at 500 rpm', () => {
    const V = (2 * Math.PI * 500 * R) / 60
    expect(heatGenerated(f, N, V) / 1000).toBeCloseTo(11.8, 1)
  })
})

describe('band brake — AEE503 Module 9 Example 2', () => {
  it('280° wrap, 450 mm drum, 170 N·m, f = 0.2 → F₁ = 1210 N, F₂ = 455 N', () => {
    const r = bandTensions(170, 0.225, 0.2, rad(280))
    expect(r.k).toBeCloseTo(2.66, 2) // the slide rounds the exponent to 0.98 → 2.665
    expect(r.F1).toBeCloseTo(1210, -1)
    expect(r.F2).toBeCloseTo(455, -1) // exact 455.8 N
  })
  it('differential band: F = (F₂b − F₁a)/c; self-locking when b ≤ a·e^(fα)', () => {
    const k = bandRatio(0.2, rad(280))
    expect(differentialBandForce(k * 100, 100, 0.05, 0.05 * k, 0.5)).toBeCloseTo(0, 9)
    expect(differentialSelfLocking(0.05, 0.05 * k, 0.2, rad(280))).toBe(true)
    expect(differentialSelfLocking(0.05, 0.05 * k + 0.001, 0.2, rad(280))).toBe(false)
  })
})

describe('other shoe brakes — AEE503 Module 9', () => {
  it('long pivoted shoe tends to the short-shoe torque as θ → 0', () => {
    expect(longShoeTorque(0.3, 1000, 0.2, 1e-4)).toBeCloseTo(0.3 * 1000 * 0.2, 6)
    // for a long shoe the friction acts at h > R
    expect(longShoeTorque(0.3, 1000, 0.2, rad(120))).toBeGreaterThan(60)
  })
  it('double shoe T = f(N_L + N_R)R', () => {
    expect(doubleShoeTorque(0.3, 1000, 800, 0.2)).toBeCloseTo(108, 12)
  })
  it('internal shoe M_f and M_n closed forms match numerical integration of the slide integrals', () => {
    const f = 0.32
    const pm = 1e6
    const w = 0.04
    const r = 0.15
    const a = 0.12
    const th1 = rad(10)
    const th2 = rad(120)
    const n = 20000
    let If = 0
    let In = 0
    for (let i = 0; i < n; i++) {
      const t = th1 + ((i + 0.5) * (th2 - th1)) / n
      If += Math.sin(t) * (r - a * Math.cos(t))
      In += Math.sin(t) ** 2
    }
    const h = (th2 - th1) / n
    const sm = Math.sin(Math.PI / 2)
    expect(internalShoeMf(f, pm, w, r, a, th1, th2)).toBeCloseTo(((f * pm * w * r) / sm) * If * h, 3)
    expect(internalShoeMn(pm, w, r, a, th1, th2)).toBeCloseTo(((pm * w * r * a) / sm) * In * h, 3)
  })
  it('heat-transfer coefficient 29.5 → 44 W/m²K between Δt = 40 and 200 °C', () => {
    expect(dissipationCoefficient(40)).toBeCloseTo(29.5, 12)
    expect(dissipationCoefficient(200)).toBeCloseTo(44, 12)
  })
})
