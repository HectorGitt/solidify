import { describe, expect, it } from 'vitest'
import {
  allowedHours,
  bandRms,
  cabs,
  characteristicRoots,
  dampingCase,
  dampingForRatio,
  dampingRatio,
  fdpFlat,
  forcedAmplitude,
  freeResponse,
  isoBoundary,
  isolationEfficiency,
  logDecrement,
  logDecrementFromPeaks,
  magnification,
  naturalFrequency,
  positivePeaks,
  profileAt,
  ratioForTransmissibility,
  roughProfile,
  seatTransfer,
  simulateSMD,
  stepResponse,
  transmissibility,
  unbalanceForce,
  baseTransfer,
  zetaFromLogDecrement,
} from './vibration'

describe('second-order step response — AEE518 Q 2016/17, MS 2017/18, MG 2018/19: θ̈ + 10θ̇ + 16θ = 32u(t)', () => {
  const m = 1
  const c = 10
  const k = 16
  it('ω_n = 4 rad/s, ζ = 1.25 (overdamped), roots −2 and −8', () => {
    expect(naturalFrequency(k, m)).toBeCloseTo(4, 12)
    expect(dampingRatio(c, k, m)).toBeCloseTo(1.25, 12)
    expect(dampingCase(1.25)).toBe('overdamped')
    const r = characteristicRoots(m, c, k)
    expect(r.re1).toBeCloseTo(-2, 10)
    expect(r.re2).toBeCloseTo(-8, 10)
  })
  const exact = (t: number) => 2 + (2 / 3) * Math.exp(-8 * t) - (8 / 3) * Math.exp(-2 * t)
  it('closed form θ = 2 + (2/3)e^(−8t) − (8/3)e^(−2t)', () => {
    for (const t of [0, 0.1, 0.5, 1, 3]) expect(stepResponse(m, c, k, 32, t)).toBeCloseTo(exact(t), 10)
  })
  it('RK4 integration matches the marking-guide answer', () => {
    const tr = simulateSMD(m, c, k, () => 32, 0, 0, 6, 601)
    for (let i = 0; i < tr.t.length; i += 25) expect(tr.x[i]).toBeCloseTo(exact(tr.t[i]), 6)
    expect(tr.x[tr.x.length - 1]).toBeCloseTo(2, 4)
  })
})

describe('damping cases (AEE518 LN, second-order systems)', () => {
  it('classifies ζ', () => {
    expect(dampingCase(0)).toBe('undamped')
    expect(dampingCase(0.2)).toBe('underdamped')
    expect(dampingCase(1)).toBe('critical')
    expect(dampingCase(2)).toBe('overdamped')
  })
  it('step response is continuous across ζ = 1 and RK4 agrees in every case', () => {
    const m = 2
    const k = 800
    for (const z of [0, 0.1, 0.999999, 1, 1.000001, 3]) {
      const c = dampingForRatio(z, k, m)
      const tr = simulateSMD(m, c, k, () => 100, 0, 0, 1.5, 151)
      for (let i = 0; i < tr.t.length; i += 15) expect(tr.x[i]).toBeCloseTo(stepResponse(m, c, k, 100, tr.t[i]), 5)
    }
  })
  it('free response starts at x₀ with zero velocity', () => {
    expect(freeResponse(4, 12.5, 5000, 0.01, 0)).toBeCloseTo(0.01, 12)
    const h = 1e-6
    expect((freeResponse(4, 12.5, 5000, 0.01, h) - 0.01) / h).toBeCloseTo(0, 3)
  })
})

describe('log decrement — AEE518 LN example: m = 4 kg, k = 5 kN/m, amplitude falls to ¼ in 5 cycles', () => {
  it('δ = 0.277, ζ = 0.044, b = 2ζ√(mk) = 12.5 N·s/m', () => {
    const d = logDecrementFromPeaks(1, 0.25, 5)
    expect(d).toBeCloseTo(0.277, 3)
    const z = zetaFromLogDecrement(d)
    expect(z).toBeCloseTo(0.044, 3)
    expect(dampingForRatio(z, 5000, 4)).toBeCloseTo(12.5, 1)
    expect(logDecrement(z)).toBeCloseTo(d, 12)
  })
  it('peaks of the RK4 free response decay by δ per cycle', () => {
    const c = dampingForRatio(zetaFromLogDecrement(logDecrementFromPeaks(1, 0.25, 5)), 5000, 4)
    const tr = simulateSMD(4, c, 5000, () => 0, 0.02, 0, 1.0, 4001)
    const pk = positivePeaks(tr.t, tr.x)
    expect(pk.length).toBeGreaterThanOrEqual(5)
    // release point x₀ is the first peak; pk[4] is five cycles later
    expect(logDecrementFromPeaks(0.02, pk[4][1], 5)).toBeCloseTo(0.277, 2)
    // amplitude after 5 cycles ≈ x₀/4
    expect(pk[4][1] / 0.02).toBeCloseTo(0.25, 2)
  })
})

describe('vibration isolation — AEE518 LN compressor example', () => {
  // 450 kg, 1750 rpm, 10 kg reciprocating mass on a 100 mm crank, ζ = 0.15, TR = 0.2
  const w = (1750 * 2 * Math.PI) / 60
  it('ω = 183.3 rad/s', () => expect(w).toBeCloseTo(183.3, 1))
  it('r = 2.72, ω_n = 67.4 rad/s, k = 2042 kN/m', () => {
    const r = ratioForTransmissibility(0.2, 0.15)
    expect(r).toBeCloseTo(2.72, 2)
    expect(transmissibility(r, 0.15)).toBeCloseTo(0.2, 10)
    const wn = w / r
    expect(wn).toBeCloseTo(67.4, 1)
    // notes: 2042 kN/m (from rounded ω_n = 67.4)
    expect((450 * wn * wn) / 1000).toBeCloseTo(2042, -1)
  })
  it('transmitted force F_T = TR · m e ω² = 6.72 kN', () => {
    expect((0.2 * unbalanceForce(10, 0.1, w)) / 1000).toBeCloseTo(6.72, 2)
  })
  it('isolation efficiency (1 − TR)×100 = 80 %; TR = 1 at r = √2 for every ζ; TR peaks near r = 1', () => {
    expect(isolationEfficiency(0.2)).toBeCloseTo(80, 10)
    for (const z of [0, 0.1, 0.5, 1]) expect(transmissibility(Math.SQRT2, z)).toBeCloseTo(1, 10)
    expect(transmissibility(1, 0.15)).toBeCloseTo(Math.sqrt(1 + 0.09) / 0.3, 10)
  })
})

describe('hopper shaker — AEE518 Q 2016/17 & MG 2018/19 (400 kg, k = 39.5 MN/m, b = 100 N·s/m, 75 N at 50 Hz)', () => {
  const m = 400
  const k = 39.5e6
  const c = 100
  const w = 2 * Math.PI * 50
  it('ω_n = 314.2 rad/s against ω = 314.16 rad/s: r ≈ 1.000 — it runs at resonance', () => {
    expect(naturalFrequency(k, m)).toBeCloseTo(314.2, 1)
    expect(w / naturalFrequency(k, m)).toBeCloseTo(1.0, 3)
  })
  it('ζ = 4×10⁻⁴ and X ≈ 1.97 mm', () => {
    expect(dampingRatio(c, k, m)).toBeCloseTo(3.98e-4, 6)
    expect(forcedAmplitude(75, m, c, k, w) * 1000).toBeCloseTo(1.97, 2)
  })
  it('X = (F₀/k)·MF agrees', () => {
    const r = w / naturalFrequency(k, m)
    expect((75 / k) * magnification(r, dampingRatio(c, k, m))).toBeCloseTo(forcedAmplitude(75, m, c, k, w), 9)
  })
})

describe('cantilever-mounted machine — AEE518 LN equivalent systems (F = 300 sin 8t)', () => {
  it('with E = 207 GPa: k = 3EI/L³ = 8.28×10³ N/m, M_e = 94.63 kg, ω_n = 9.35 rad/s (the notes slip a factor 100)', () => {
    const I = (0.02 * 0.04 ** 3) / 12
    const k = (3 * 207e9 * I) / 2 ** 3
    expect(k).toBeCloseTo(8280, 0)
    const Me = 900 / 9.81 + 0.23 * (0.02 * 0.04 * 2 * 7850)
    expect(Me).toBeCloseTo(94.63, 1)
    expect(naturalFrequency(k, Me)).toBeCloseTo(9.35, 2)
  })
})

describe('tractor seat — AEE510 Human Engineering eq 14–17, Fig 10.10', () => {
  it('eq 14 equals |X/Y| of a base-excited single DOF', () => {
    const m = 100
    const k = 10000
    for (const z of [0.15, 0.25, 0.5]) {
      const c = dampingForRatio(z, k, m)
      for (const r of [0.5, 1, 1.414, 2, 3]) {
        const w = r * naturalFrequency(k, m)
        expect(cabs(baseTransfer(m, c, k, w))).toBeCloseTo(transmissibility(r, z), 10)
      }
    }
  })
  it('Fig 10.10 peaks: ζ = 0.15 → ≈ 3.6, ζ = 0.25 → ≈ 2.4, ζ = 0.5 → ≈ 1.5, ζ = 1 → ≈ 1.15', () => {
    const peak = (z: number) => {
      let best = 0
      for (let r = 0.3; r < 2; r += 0.0005) best = Math.max(best, transmissibility(r, z))
      return best
    }
    expect(peak(0.15)).toBeCloseTo(3.6, 0)
    expect(peak(0.25)).toBeCloseTo(2.4, 0)
    expect(peak(0.5)).toBeCloseTo(1.5, 0)
    expect(peak(1)).toBeCloseTo(1.15, 1)
  })
  it('two-DOF model reduces to eq 14 when the cushion is rigid', () => {
    const p = { m1: 75, k1: 1e12, c1: 0, m2: 25, k2: 6000, c2: 600 }
    const M = p.m1 + p.m2
    const wn = naturalFrequency(p.k2, M)
    const z = dampingRatio(p.c2, p.k2, M)
    for (const r of [0.5, 1, 2]) {
      const t = seatTransfer(p, r * wn)
      expect(cabs(t.man)).toBeCloseTo(transmissibility(r, z), 4)
      expect(cabs(t.seat)).toBeCloseTo(transmissibility(r, z), 4)
    }
  })
  it('transfer tends to 1 at low frequency', () => {
    const t = seatTransfer({ m1: 60, k1: 60000, c1: 900, m2: 25, k2: 8000, c2: 700 }, 0.01)
    expect(cabs(t.man)).toBeCloseTo(1, 4)
  })
})

describe('ISO 2631 boundaries — AEE510 HE Fig 10.6', () => {
  it('8 h FDP is 0.315 m/s² flat from 4 to 8 Hz, 0.63 at 1 Hz and 3.15 at 80 Hz', () => {
    expect(isoBoundary(5, 8)).toBeCloseTo(0.315, 6)
    expect(isoBoundary(1, 8)).toBeCloseTo(0.63, 6)
    expect(isoBoundary(80, 8)).toBeCloseTo(3.15, 6)
  })
  it('the 1 h and 24 h curves sit at 1.06 and 0.14 m/s²', () => {
    expect(fdpFlat(1)).toBeCloseTo(1.06, 6)
    expect(fdpFlat(24)).toBeCloseTo(0.14, 6)
  })
  it('allowed exposure inverts the boundary', () => {
    expect(allowedHours(0.315, 6)).toBeCloseTo(8, 6)
    expect(allowedHours(isoBoundary(2, 3), 2)).toBeCloseTo(3, 6)
  })
  it('band RMS sums components in quadrature', () => {
    const b = bandRms([
      { f: 4.1, rms: 0.3 },
      { f: 3.9, rms: 0.4 },
    ])
    expect(b[6]).toBeCloseTo(0.5, 10) // 4 Hz band
  })
})

describe('rough-ground profile', () => {
  it('repeats exactly every period and has the expected RMS', () => {
    const p = roughProfile(1024e-6)
    expect(profileAt(p, 3.3).h).toBeCloseTo(profileAt(p, 3.3 + 64).h, 9)
    const rms = Math.sqrt(p.reduce((s, c) => s + (c.amp * c.amp) / 2, 0))
    expect(rms).toBeGreaterThan(0.005)
    expect(rms).toBeLessThan(0.2)
  })
})
