import { describe, expect, it } from 'vitest'
import {
  AXLE_PER_PTO,
  BALLAST_K_SI,
  BALLAST_NUMBERS,
  BRIXIUS,
  PTO_PER_FLYWHEEL,
  ballastNumber,
  brixius,
  gtrFromWeight,
  peakTractiveEfficiency,
  reactionOffset,
  regressionTraction,
  speedForWeightPerPower,
  tractiveEfficiencyRatios,
  weightPerPower,
} from '@/physics/traction'
import { FARMLAND_GEARS } from '@/physics/tractor'
import { D, DEFAULTS, solve } from './model'

describe('Lecture27 ballast numbers (eqs 24–29, Table 5)', () => {
  it('eq 27: 383/0.54 = 709 kg/kW·km/h; eq 26: 375/0.54 = 694 lb/hp·mph', () => {
    expect(ballastNumber(0.54)).toBeCloseTo(709, 0)
    expect(ballastNumber(0.54, 375)).toBeCloseTo(694, 0)
  })
  it('Table 5: axle 709 → PTO 709 × 0.96 = 680 → flywheel 680 × 0.85 = 578 ≈ 580', () => {
    expect(BALLAST_NUMBERS.axle * AXLE_PER_PTO).toBeCloseTo(BALLAST_NUMBERS.pto, -1)
    expect(BALLAST_NUMBERS.pto * PTO_PER_FLYWHEEL).toBeCloseTo(BALLAST_NUMBERS.flywheel, -1)
  })
  it('p43 example with 670: 670/5 mph = 134 lb/PTO hp, 670/130 = 5.15 mph (errata: notes print 125 and 4.8, which are 625/5 and 625/130)', () => {
    expect(weightPerPower(670, 5)).toBeCloseTo(134, 6)
    expect(speedForWeightPerPower(670, 130)).toBeCloseTo(5.15, 2)
    expect(weightPerPower(625, 5)).toBeCloseTo(125, 6)
    expect(speedForWeightPerPower(625, 130)).toBeCloseTo(4.8, 1)
  })
  it('p43: 77 kg/axle kW at 9.8 km/h is GTR ≈ 0.51, "close to the 0.54 GTR"', () => {
    expect(gtrFromWeight(77, 9.8, 1)).toBeCloseTo(BALLAST_K_SI / (77 * 9.8), 9)
    expect(gtrFromWeight(77, 9.8, 1)).toBeCloseTo(0.51, 2)
  })
})

describe('Lecture27 traction ratios', () => {
  it('eq 1: eh = slr·MR/Wd', () => {
    expect(reactionOffset(0.6, 1000, 10000)).toBeCloseTo(0.06, 12)
  })
  it('eq 6 = eq 2.10 form: TE = (NTR/GTR)(1 − TRR)', () => {
    expect(tractiveEfficiencyRatios(0.4, 0.5, 0.1)).toBeCloseTo(0.72, 12)
  })
  it('Fig 17 regression at 10 % slip: MRR = 0.090 + 0.001(10) = 0.100', () => {
    expect(regressionTraction(0.1).MRR).toBeCloseTo(0.1, 12)
  })
  it('Brixius TE peaks near NTR 0.4 for tyres (L27 p14)', () => {
    for (const k of [BRIXIUS.bias, BRIXIUS.radial]) {
      const p = peakTractiveEfficiency(40, k)
      expect(p.NTR).toBeGreaterThan(0.25)
      expect(p.NTR).toBeLessThan(0.5)
    }
  })
  it('Brixius MRR falls as the mobility number rises (firmer soil)', () => {
    expect(brixius(80, 0.1).MRR).toBeLessThan(brixius(20, 0.1).MRR)
  })
})

describe('traction lab solve (MECH Ch 2 + Brixius)', () => {
  it('ideal analysis: no slip, no R, ηt = 1; gear 3 at 38.3 kN runs near the torque peak (2.21 km/h)', () => {
    const s = solve({ ...DEFAULTS, ideal: true, gear: '3', pull: 38.3 })
    expect(s.i).toBe(0)
    expect(s.R).toBe(0)
    expect(s.op.etaT).toBeCloseTo(1, 12)
    expect(s.op.V0 * 3.6).toBeCloseTo(2.21, 1)
  })
  it('manual mode reproduces MECH eq 2.10: P 10, R 1 kN, i 0.1 → ηt 0.818', () => {
    const s = solve({ ...DEFAULTS, slipMode: 'manual', pull: 10, rolling: 1, slip: 0.1 })
    expect(s.op.etaT).toBeCloseTo(0.818, 3)
  })
  it('Brixius mode: the solved slip delivers exactly the needed NTR', () => {
    const s = solve({ ...DEFAULTS, pull: 12 })
    expect(s.spin).toBe(false)
    expect(s.br.NTR).toBeCloseTo(s.NTR, 6)
    expect(s.op.V).toBeCloseTo(s.op.V0 * (1 - s.i), 9)
  })
  it('V0 = πD·Ne/q (eq 2.1) at the solved engine speed', () => {
    const s = solve({ ...DEFAULTS, gear: '5', pull: 8 })
    expect(s.op.V0).toBeCloseTo((Math.PI * D * (s.op.rpm / 60)) / FARMLAND_GEARS[5], 9)
  })
  it('soft soil: 14 kN spins the wheels, 600 kg ballast cures it (tour presets)', () => {
    expect(solve({ ...DEFAULTS, soil: 'soft', pull: 14 }).spin).toBe(true)
    const b = solve({ ...DEFAULTS, soil: 'soft', pull: 14, ballast: 600 })
    expect(b.spin).toBe(false)
    expect(b.i).toBeLessThan(0.35)
  })
  it('more ballast → less slip for the same pull (MECH p7)', () => {
    const a = solve({ ...DEFAULTS, pull: 12 })
    const b = solve({ ...DEFAULTS, pull: 12, ballast: 800 })
    expect(b.i).toBeLessThan(a.i)
    expect(b.Vr - a.Vr).toBeCloseTo(800 * 9.81, 3)
  })
})
