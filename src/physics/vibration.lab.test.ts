import { describe, expect, it } from 'vitest'
import {
  cantileverEffectiveMass,
  cantileverStiffness,
  dampingForRatio,
  firstOrderCosine,
  firstOrderCosineAt,
  firstOrderStep,
  forcedAmplitude,
  isolatorDeriv,
  naturalFrequency,
  pivotedBarCoefficients,
  polyRoots,
  ratioForTransmissibility,
  rectSecondMoment,
  rk4Step,
  routhHurwitz,
  secondOrderParams,
  simulateSMD,
  springEffectiveMass,
  springsParallel,
  springsSeries,
  stableGainRange,
  timeConstantFromReading,
  transmissibility,
  transmissibilityPhase,
  transmittedForce,
  unbalanceForce,
} from './vibration'

const LN = 'AEE518 LN'

describe(`${LN} second-order coefficients: θ̈ + 10θ̇ + 16θ = 32u(t) (Q 2016/17, MS 2017/18, MG 2018/19)`, () => {
  it('ω_n = 4, ζ = 1.25 → overdamped, no oscillation (ω_d = 0)', () => {
    const p = secondOrderParams(1, 10, 16)
    expect(p.wn).toBeCloseTo(4, 12)
    expect(p.zeta).toBeCloseTo(1.25, 12)
    expect(p.wd).toBe(0)
  })
  it('characteristic roots −2 and −8 from the polynomial solver', () => {
    const r = polyRoots([1, 10, 16])
    expect(r[0].re).toBeCloseTo(-8, 9)
    expect(r[1].re).toBeCloseTo(-2, 9)
  })
})

describe(`${LN} first-order Example 1: 3θ̇ + 2θ = 10 cos 5t, θ(0) = 30°`, () => {
  const r = firstOrderCosine(3, 2, 10, 5, Math.PI / 6)
  it('τ = 1.5 s, forced amplitude 0.6608 and phase 1.438 rad', () => {
    expect(r.tau).toBeCloseTo(1.5, 12)
    expect(r.amp).toBeCloseTo(0.6608, 4)
    expect(r.phase).toBeCloseTo(1.438, 3)
  })
  it('natural-response constant is 0.5236 − 0.0875 = 0.4361 (the notes print 0.3486 — an arithmetic slip)', () => {
    expect(r.amp * Math.cos(r.phase)).toBeCloseTo(0.0875, 3)
    expect(r.Cn).toBeCloseTo(0.436, 3)
  })
  it('RK4 integration of the ODE matches the closed form', () => {
    const f = (t: number, y: number[]) => [(10 * Math.cos(5 * t) - 2 * y[0]) / 3]
    let y = [Math.PI / 6]
    let t = 0
    const h = 0.001
    for (let i = 0; i < 3000; i++) {
      y = rk4Step(f, t, y, h)
      t += h
      if (i % 500 === 499) expect(y[0]).toBeCloseTo(firstOrderCosineAt(r, 5, t), 8)
    }
  })
  it('first forced peak at t = 1.438/5 = 0.2876 s', () => expect(r.phase / 5).toBeCloseTo(0.2876, 4))
})

describe(`${LN} Example 2 (MS 2017/18, T 2019/20): thermometer from 0 °C into boiling water reads 50 °C after 10 s`, () => {
  const tau = timeConstantFromReading(0, 100, 50, 10)
  it('τ = 10/ln 2 = 14.43 s (the notes round to 14.48–14.49 s)', () => {
    expect(tau).toBeCloseTo(10 / Math.LN2, 10)
    expect(tau).toBeCloseTo(14.43, 2)
    expect(Math.abs(tau - 14.48) / 14.48).toBeLessThan(0.005)
  })
  it('T = 100(1 − e^(−t/τ)); after 5τ ≈ 72 s it reads 99.3 °C (“≈ 100 °C”)', () => {
    expect(firstOrderStep(tau, 1, 100, 0, 10)).toBeCloseTo(50, 10)
    expect(firstOrderStep(tau, 1, 100, 0, 5 * tau)).toBeCloseTo(99.33, 2)
  })
})

describe(`${LN} equivalent systems`, () => {
  it('parallel k₁ + k₂, series k₁k₂/(k₁ + k₂)', () => {
    expect(springsParallel(2000, 3000)).toBe(5000)
    expect(springsSeries(2000, 3000)).toBeCloseTo(1200, 9)
    expect(springsSeries(4000, 4000, 4000)).toBeCloseTo(4000 / 3, 9)
  })
  it('helical spring mass: M_e = M + M_s/3', () => expect(springEffectiveMass(10, 3)).toBeCloseTo(11, 12))
  it('cantilever example as printed (E = 2.07×10¹³): k_e = 8.28×10⁵ N/m, ω_n = 93.5 rad/s', () => {
    const I = rectSecondMoment(0.02, 0.04)
    expect(I).toBeCloseTo(1.067e-7, 10)
    const Me = cantileverEffectiveMass(900 / 9.81, 0.02 * 0.04 * 2 * 7850)
    expect(Me).toBeCloseTo(94.63, 1)
    const kNotes = cantileverStiffness(2.07e13, I, 2)
    expect(kNotes / 1e5).toBeCloseTo(8.28, 2)
    expect(naturalFrequency(kNotes, Me)).toBeCloseTo(93.5, 0)
  })
  it('cantilever corrected (errata cantilever-E, E = 207 GPa): k_e = 8.28×10³ N/m, ω_n = 9.35 rad/s, r = 0.86 at 8 rad/s', () => {
    const I = rectSecondMoment(0.02, 0.04)
    const k = cantileverStiffness(207e9, I, 2)
    const Me = cantileverEffectiveMass(900 / 9.81, 0.02 * 0.04 * 2 * 7850)
    expect(k).toBeCloseTo(8280, -1)
    const wn = naturalFrequency(k, Me)
    expect(wn).toBeCloseTo(9.35, 2)
    expect(8 / wn).toBeCloseTo(0.856, 2)
    // undamped steady amplitude of F = 300 sin 8t
    expect(forcedAmplitude(300, Me, 0, k, 8)).toBeCloseTo(0.135, 3)
  })
})

describe('pivoted bar — AEE518 MG 2018/19: ML²θ̈ + a²bθ̇ + kc²θ = 0', () => {
  const p = { M: 2, L: 0.6, a: 0.3, b: 40, c: 0.45, k: 2000 }
  const s = pivotedBarCoefficients(p)
  it('ω_n = √(kc²/ML²) and ζ = a²b / 2√(kc²·ML²)', () => {
    expect(s.wn).toBeCloseTo(Math.sqrt((p.k * p.c ** 2) / (p.M * p.L ** 2)), 12)
    expect(s.zeta).toBeCloseTo((p.a ** 2 * p.b) / (2 * Math.sqrt(p.k * p.c ** 2 * p.M * p.L ** 2)), 12)
    expect(s.wd).toBeCloseTo(s.wn * Math.sqrt(1 - s.zeta ** 2), 12)
  })
  it('RK4 free response decays at e^(−ζω_n t)', () => {
    const tr = simulateSMD(s.a2, s.a1, s.a0, () => 0, 0.05, 0, 2, 2001)
    const T = (2 * Math.PI) / s.wd
    const i1 = Math.round((T / 2) * 1000)
    // half a damped period later the angle is −x₀e^(−ζω_n T/2) (exactly, for free decay from rest it is very close)
    expect(Math.abs(tr.x[i1]) / 0.05).toBeCloseTo(Math.exp((-s.zeta * s.wn * T) / 2), 2)
  })
})

describe(`${LN} vibration isolation, checked by RK4 time integration`, () => {
  it('compressor (450 kg, 1750 rpm, 10 kg × 100 mm, ζ = 0.15): steady transmitted force ≈ 0.2 × 33.6 kN = 6.72 kN', () => {
    const M = 450
    const w = (1750 * 2 * Math.PI) / 60
    const r = ratioForTransmissibility(0.2, 0.15)
    const k = M * (w / r) ** 2
    const c = dampingForRatio(0.15, k, M)
    const F0 = unbalanceForce(10, 0.1, w)
    expect(F0 / 1000).toBeCloseTo(33.6, 1)
    const f = isolatorDeriv(M, c, k, (t) => F0 * Math.sin(w * t), () => 0, () => 0)
    let y = [0, 0]
    let t = 0
    const h = (2 * Math.PI) / w / 200
    let peak = 0
    while (t < 2.0) {
      y = rk4Step(f, t, y, h)
      t += h
      if (t > 1.6) peak = Math.max(peak, Math.abs(transmittedForce(c, k, y[0], y[1])))
    }
    expect(peak / 1000).toBeCloseTo(6.72, 1)
  })
  it('base excitation: |X/Y| from RK4 equals TR(r, ζ) and lags by the transmissibility phase', () => {
    const M = 100
    const k = 1e4
    const z = 0.25
    const c = dampingForRatio(z, k, M)
    const wn = naturalFrequency(k, M)
    for (const r of [0.6, 1, 2.5]) {
      const w = r * wn
      const Y = 0.01
      const f = isolatorDeriv(M, c, k, () => 0, (t) => Y * Math.sin(w * t), (t) => Y * w * Math.cos(w * t))
      let y = [0, 0]
      let t = 0
      const h = (2 * Math.PI) / w / 400
      let peak = 0
      while (t < 12) {
        y = rk4Step(f, t, y, h)
        t += h
        if (t > 9) peak = Math.max(peak, Math.abs(y[0]))
      }
      expect(peak / Y).toBeCloseTo(transmissibility(r, z), 3)
    }
    expect(transmissibilityPhase(1e-6, 0.2)).toBeCloseTo(0, 6)
    expect(transmissibilityPhase(1, 0)).toBeCloseTo(0, 9)
  })
  it('hopper shaker at resonance builds up with time constant 1/(ζω_n) = 8 s toward X ≈ 1.97 mm', () => {
    const M = 400
    const k = 39.5e6
    const c = 100
    const wn = naturalFrequency(k, M)
    const zeta = c / (2 * Math.sqrt(k * M))
    expect(1 / (zeta * wn)).toBeCloseTo(8, 1)
    const w = 2 * Math.PI * 50
    const f = isolatorDeriv(M, c, k, (t) => 75 * Math.sin(w * t), () => 0, () => 0)
    let y = [0, 0]
    let t = 0
    const h = (2 * Math.PI) / w / 60
    let peak = 0
    while (t < 8) {
      y = rk4Step(f, t, y, h)
      t += h
      if (t > 7.9) peak = Math.max(peak, Math.abs(y[0]))
    }
    // after one time constant the envelope is well on its way to the steady 1.97 mm
    expect(peak * 1000).toBeGreaterThan(1.2)
    expect(peak * 1000).toBeLessThan(forcedAmplitude(75, M, c, k, w) * 1000)
  })
})

describe(`${LN} stability — Routh's criterion and the s-plane`, () => {
  it('D³ + 4D² + 8D + 12 is stable (R₁ = 8, R₂ = 20)', () => {
    const r = routhHurwitz([1, 4, 8, 12])
    expect(r.sameSign).toBe(true)
    expect(r.R[0]).toBeCloseTo(8, 9)
    expect(r.R[1]).toBeCloseTo(20, 9)
    expect(r.stable).toBe(true)
    expect(polyRoots([1, 4, 8, 12]).every((z) => z.re < 0)).toBe(true)
  })
  it('2D³ + 4D² + 4D + 12 is unstable (R₂ = 4·4 − 2·12 = −8)', () => {
    const r = routhHurwitz([2, 4, 4, 12])
    expect(r.R[1]).toBeCloseTo(-8, 9)
    expect(r.stable).toBe(false)
    expect(polyRoots([2, 4, 4, 12]).some((z) => z.re > 0)).toBe(true)
  })
  it('7D⁴ + 3D³ + 8D² + 5D + 9 is unstable: R₁ = 5, R₂ = 13, R₃ = −136 (the notes print −126: 5(24 − 35) is −55, not −45)', () => {
    const r = routhHurwitz([7, 3, 8, 5, 9])
    expect(r.R[0]).toBeCloseTo(5, 9)
    expect(r.R[1]).toBeCloseTo(13, 9)
    expect(r.R[2]).toBeCloseTo(-136, 9)
    expect(r.stable).toBe(false)
    expect(polyRoots([7, 3, 8, 5, 9]).some((z) => z.re > 0)).toBe(true)
  })
  it('D⁴ + 6D³ + 11D² + 6D + K is stable for 0 < K < 10 (R₃ = 360 − 36K)', () => {
    expect(routhHurwitz([1, 6, 11, 6, 5]).R[2]).toBeCloseTo(360 - 36 * 5, 9)
    const range = stableGainRange([1, 6, 11, 6], -5, 20, 2500)!
    expect(range.from).toBeGreaterThan(0)
    expect(range.from).toBeLessThan(0.02)
    expect(range.to).toBeCloseTo(10, 1)
    expect(routhHurwitz([1, 6, 11, 6, 9.9]).stable).toBe(true)
    expect(routhHurwitz([1, 6, 11, 6, 10.1]).stable).toBe(false)
    expect(polyRoots([1, 6, 11, 6, 10.1]).some((z) => z.re > 0)).toBe(true)
  })
  it('poles and zeros: (s² + 9s + 20)/(s³ + 6s² + 11s + 6) and 10(s + 2.5)/(s² + 2s + 5)', () => {
    expect(polyRoots([1, 9, 20]).map((z) => z.re)).toEqual([expect.closeTo(-5, 9), expect.closeTo(-4, 9)])
    expect(polyRoots([1, 6, 11, 6]).map((z) => z.re)).toEqual([expect.closeTo(-3, 9), expect.closeTo(-2, 9), expect.closeTo(-1, 9)])
    const p = polyRoots([1, 2, 5])
    expect(p[0].re).toBeCloseTo(-1, 9)
    expect(Math.abs(p[0].im)).toBeCloseTo(2, 9)
  })
})
