import { describe, expect, it } from 'vitest'
import {
  AIR,
  airStandardCycle,
  alphaFromHeat,
  alphaFromPmax,
  cycleLoop,
  deltaFromCutoffFraction,
  deltaFromHeat,
  dualFromHeatSplit,
  dualFromPmaxEqualHeat,
  makeGas,
  stateAtCrank,
} from './thermo'

const pct = (x: number) => x * 100

describe('Otto cycle — AEE509 Misc. Exercises Ex 9 (p9)', () => {
  // 105 kPa, 295 K at state 1; 8902 kPa, 2500 K at state 3
  const r = 10
  const T2 = 295 * Math.pow(r, 0.4)
  const alpha = 2500 / T2

  it('ASE = 60.2 % and T2 = 741 K', () => {
    const c = airStandardCycle({ kind: 'otto', r, P1: 105, T1: 295, alpha, delta: 1 })
    expect(pct(c.eta)).toBeCloseTo(60.2, 1)
    expect(c.s2.T).toBeCloseTo(741, 0)
    expect(c.Pmax).toBeCloseTo(8902, -2)
    expect(c.etaFormula).toBeCloseTo(c.eta, 3) // cp/cv of the exam constants is 1.3997, not exactly k
  })

  it('reproduces the notes’ mep of 1135.7 kPa only when Cv = 0.778 (a slip for 0.718)', () => {
    const slip = { ...AIR, cv: 0.778, cp: 0.778 + AIR.R }
    const c = airStandardCycle({ kind: 'otto', r, P1: 105, T1: 295, alpha, delta: 1, gas: slip })
    expect(c.qIn).toBeCloseTo(1368.5, 0)
    expect(c.mep).toBeCloseTo(1135.7, -1) // notes round V1−V2 to 0.806−0.0806
    // with the correct Cv the mep is lower
    const ok = airStandardCycle({ kind: 'otto', r, P1: 105, T1: 295, alpha, delta: 1 })
    expect(ok.mep).toBeCloseTo(1048, -1)
  })
})

describe('Otto cycle with k = 1.3 — Misc. Ex 10 (p9)', () => {
  const gas = makeGas(1.3, 0.946) // R = 0.2838
  it('T3, P3, P4, T4, η = 48.27 %, mep = 1402 kPa', () => {
    const r = 9
    const alpha = alphaFromHeat(2346.96, r, 320, gas)
    const c = airStandardCycle({ kind: 'otto', r, P1: 100, T1: 320, alpha, delta: 1, gas })
    expect(gas.R).toBeCloseTo(0.2838, 4)
    expect(c.s2.P).toBeCloseTo(1739.8, 0)
    expect(c.s2.T).toBeCloseTo(618.62, 1)
    expect(c.s3.T).toBeCloseTo(3099.55, 0)
    expect(c.Pmax).toBeCloseTo(8717.14, -1)
    expect(c.s5.P).toBeCloseTo(501.0, 0)
    expect(c.s5.T).toBeCloseTo(1603.34, 0)
    expect(pct(c.eta)).toBeCloseTo(48.27, 1)
    expect(c.mep).toBeCloseTo(1402.1, -1)
  })
})

describe('Diesel cycle — Misc. Ex 12', () => {
  it('r = 20, 100 kPa, 300 K, 2000 kJ/kg → δ = 3, η = 60.6 %, mep ≈ 1480 kPa', () => {
    const r = 20
    const delta = deltaFromHeat(2000, r, 300)
    const c = airStandardCycle({ kind: 'diesel', r, P1: 100, T1: 300, alpha: 1, delta })
    expect(c.s2.T).toBeCloseTo(994, 0)
    expect(c.s2.P).toBeCloseTo(6629, -1)
    expect(delta).toBeCloseTo(3.0, 2)
    expect(pct(c.eta)).toBeCloseTo(60.6, 1)
    expect(c.mep).toBeCloseTo(1482, -1)
    expect(c.etaFormula).toBeCloseTo(c.eta, 3) // cp/cv of the exam constants is 1.3997, not exactly k
  })

  it('cut-off at 10 % of stroke with r = 16 gives δ = 2.5 (Ex 13)', () => {
    expect(deltaFromCutoffFraction(0.1, 16)).toBeCloseTo(2.5, 9)
  })

  it('Diesel η is below Otto η at the same r — the factor (δ^k−1)/(k(δ−1)) is > 1 (corrects Thermo p5)', () => {
    const r = 16
    for (const delta of [1.5, 2, 2.5, 3]) {
      const k = 1.4
      expect((Math.pow(delta, k) - 1) / (k * (delta - 1))).toBeGreaterThan(1)
      const d = airStandardCycle({ kind: 'diesel', r, P1: 100, T1: 300, alpha: 1, delta })
      const o = airStandardCycle({ kind: 'otto', r, P1: 100, T1: 300, alpha: 2, delta: 1 })
      expect(d.eta).toBeLessThan(o.eta)
    }
  })
})

describe('Dual cycle', () => {
  it('recurring exam data: r = 16, 1 bar, 50 °C, Pmax = 70 bar, Qv = Qp', () => {
    const r = 16
    const { alpha, delta } = dualFromPmaxEqualHeat(7000, r, 100, 323)
    const c = airStandardCycle({ kind: 'dual', r, P1: 100, T1: 323, alpha, delta })
    expect(c.s2.T).toBeCloseTo(979.1, 0)
    expect(c.s2.P).toBeCloseTo(4850, -1)
    expect(c.Pmax).toBeCloseTo(7000, 6)
    expect(c.qInV).toBeCloseTo(c.qInP, 6)
    expect(c.etaFormula).toBeCloseTo(c.eta, 3) // cp/cv of the exam constants is 1.3997, not exactly k
    expect(pct(c.eta)).toBeGreaterThan(60)
    expect(pct(c.eta)).toBeLessThan(70)
  })

  it('heat split converter conserves heat', () => {
    const { alpha, delta } = dualFromHeatSplit(2800, 0.6, 16, 300)
    const c = airStandardCycle({ kind: 'dual', r: 16, P1: 100, T1: 300, alpha, delta })
    expect(c.qIn).toBeCloseTo(2800, 6)
    expect(c.qInV / c.qInP).toBeCloseTo(1.5, 6)
  })

  it('dual is MORE efficient than diesel at the same r and δ (corrects Misc p10)', () => {
    const r = 16
    const delta = 2
    const dual = airStandardCycle({ kind: 'dual', r, P1: 100, T1: 300, alpha: 1.5, delta })
    const diesel = airStandardCycle({ kind: 'diesel', r, P1: 100, T1: 300, alpha: 1, delta })
    expect(dual.eta).toBeGreaterThan(diesel.eta)
  })

  it('alphaFromPmax inverts P2·α', () => {
    expect(alphaFromPmax(100 * Math.pow(10, 1.4) * 3, 10, 100)).toBeCloseTo(3, 9)
  })
})

describe('path through the cycle', () => {
  const c = airStandardCycle({ kind: 'diesel', r: 18, P1: 100, T1: 300, alpha: 1, delta: 2 })

  it('loop closes and passes through cardinal states', () => {
    const loop = cycleLoop(c)
    const first = loop[0]
    const last = loop[loop.length - 1]
    expect(first.P).toBeCloseTo(last.P, 6)
    expect(first.v).toBeCloseTo(last.v, 9)
    expect(Math.max(...loop.map((p) => p.P))).toBeCloseTo(c.Pmax, 6)
  })

  it('crank-angle state: compression end = state 2, constant pressure after TDC', () => {
    const s2 = stateAtCrank(c, 359.999, 1 / 18)
    expect(s2.P).toBeCloseTo(c.s2.P, 0)
    const sTDC = stateAtCrank(c, 360.5, 1 / 18 + 1e-4)
    expect(sTDC.P).toBeCloseTo(c.s4.P, 6)
    expect(sTDC.stroke).toBe('power')
    expect(stateAtCrank(c, 600, 0.5).stroke).toBe('exhaust')
  })
})
