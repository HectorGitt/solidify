import { describe, expect, it } from 'vitest'
import {
  averageSizeMm,
  beltCapacityM3h,
  bondEnergy,
  bucketElevatorPower,
  centrifugeVelocity,
  chainConveyorPower,
  cumulativeOversize,
  cycloneForces,
  finenessModulus,
  flowCrossings,
  kickEnergy,
  percentRetained,
  pneumaticDesign,
  rittingerEnergy,
  routeLength,
  scalePower,
  screenEffectiveness,
  screwCapacityM3h,
  screwPower,
  screwVolumePerRev,
  stokesVelocity,
  terminalVelocity,
  troughSection,
  uniformityIndex,
  coolingLoadKw,
  plankFreezingTime
} from './processing'

describe('size reduction laws — RED / Fellows Ch 4', () => {
  it('Fellows sample 4.1: 6 → 0.0012 mm on 7457 W; 0.0008 mm needs ≈ 11.2 kW by Rittinger (motor not adequate)', () => {
    expect(scalePower('rittinger', 7457, 6, 0.0012, 0.0008) / 1000).toBeCloseTo(11.19, 1)
  })
  it('PQ p6 Q3c: ½ hp, 4.22 → 0.4 mm; 0.004 mm needs ≈ 1.10 kW (Kick) and ≈ 41.2 kW (Rittinger)', () => {
    expect(scalePower('kick', 372.85, 4.22, 0.4, 0.004)).toBeCloseTo(1101.6, 0)
    expect(scalePower('rittinger', 372.85, 4.22, 0.4, 0.004) / 1000).toBeCloseTo(41.15, 1)
  })
  it('PQ p1 Q5b: 6.5 kW at setting 1 (D = 0.337 mm) → setting 2 (D = 0.314 mm): Rittinger ≈ 7.0 kW, Bond ≈ 6.8 kW', () => {
    expect(scalePower('rittinger', 6.5, 4.3, 0.337, 0.314)).toBeCloseTo(7.02, 1)
    expect(scalePower('bond', 6.5, 4.3, 0.337, 0.314)).toBeCloseTo(6.82, 1)
  })
  it('law forms: Kick ∝ ln(L1/L2), Rittinger ∝ (1/L2 − 1/L1), Bond uses √(100/d)', () => {
    expect(kickEnergy(1, Math.E, 1)).toBeCloseTo(1, 12)
    expect(rittingerEnergy(2, 4, 1)).toBeCloseTo(1.5, 12)
    expect(bondEnergy(1, 100, 25)).toBeCloseTo(1, 12)
  })
})

describe('fineness modulus, average size and uniformity index — RED', () => {
  const red = [1.0, 2.5, 7.0, 24.0, 35.5, 22.5, 7.5, 0]
  it('RED worked example: Σ = 312.0 → FM = 3.12; D = 0.135·1.366^3.12 ≈ 0.357 mm', () => {
    expect(finenessModulus(red)).toBeCloseTo(3.12, 6)
    expect(averageSizeMm(3.12)).toBeCloseTo(0.357, 3)
  })
  it('RED worked example: coarse 10.5, medium 59.5, fine 30.0 → UI 1:6:3', () => {
    const u = uniformityIndex(red)
    expect(u.coarse).toBeCloseTo(10.5, 9)
    expect(u.medium).toBeCloseTo(59.5, 9)
    expect(u.fine).toBeCloseTo(30, 9)
    expect(u.ratio).toEqual([1, 6, 3])
  })
  it('PQ p1 Q3c burr mill setting 1 (250 g): FM 2.93, D 0.337 mm, UI 1:5:4', () => {
    const pct = percentRetained([0, 6.8, 16.5, 40.1, 86.2, 91.0, 7.3, 2.1])
    expect(pct[1]).toBeCloseTo(2.72, 2)
    expect(finenessModulus(pct)).toBeCloseTo(2.93, 2)
    expect(averageSizeMm(2.93)).toBeCloseTo(0.337, 3) // with FM rounded to 2 d.p. as worked
    expect(uniformityIndex(pct).ratio).toEqual([1, 5, 4])
  })
  it('PQ p1 Q3c burr mill setting 2 (250 g): FM 2.71, D 0.314 mm, UI 1:4:5', () => {
    const pct = percentRetained([0, 5.4, 13.5, 38.1, 70.8, 101.6, 9.2, 11.4])
    expect(finenessModulus(pct)).toBeCloseTo(2.71, 2)
    expect(averageSizeMm(2.71)).toBeCloseTo(0.314, 3)
    expect(uniformityIndex(pct).ratio).toEqual([1, 4, 5])
  })
})

describe('screen effectiveness — SEP eqs 3–9, PQ p3 Q3b', () => {
  const feed = [16, 59, 18, 4, 3]
  const over = [61.5, 34, 3.5, 1.0, 0]
  const under = [3.0, 58, 23.2, 7.8, 8.0]
  it('IS 30: X_F = 0.75, X_A = 0.955, X_B = 0.61 → E ≈ 0.48', () => {
    const [XF, XA, XB] = [feed, over, under].map((p) => cumulativeOversize(p, 1))
    expect([XF, XA, XB]).toEqual([0.75, 0.955, 0.61])
    const e = screenEffectiveness(XF, XA, XB)
    expect(e.E).toBeCloseTo(0.479, 3)
    expect(e.EA * e.EB).toBeCloseTo(e.E, 12)
  })
  it('IS 15: X_F = 0.97, X_A = 1.00, X_B = 0.92 → E ≈ 0.64', () => {
    const [XF, XA, XB] = [feed, over, under].map((p) => cumulativeOversize(p, 3))
    expect(screenEffectiveness(XF, XA, XB).E).toBeCloseTo(0.644, 3)
  })
})

describe('particle aerodynamics and cyclones — SEP', () => {
  it('PQ p5 Q v: 50 µm oil globule (900 in 1000 kg/m³, µ = 10⁻³) rises at 1.36×10⁻⁴ m/s under gravity', () => {
    expect(stokesVelocity(50e-6, 900, 1000, 1e-3)).toBeCloseTo(-1.3625e-4, 7)
  })
  it('centrifuge eq 18 = Stokes × rω²/g', () => {
    const r = 0.1
    const N = 50
    const ratio = (r * (2 * Math.PI * N) ** 2) / 9.81
    expect(centrifugeVelocity(50e-6, r, N, 900, 1000, 1e-3)).toBeCloseTo(stokesVelocity(50e-6, 900, 1000, 1e-3) * ratio, 9)
  })
  it('terminal velocity iteration reduces to Stokes for fine dust', () => {
    expect(terminalVelocity(10e-6, 1500)).toBeCloseTo(stokesVelocity(10e-6, 1500, 1.2, 1.81e-5), 5)
  })
  it('cyclone S = V²/(gR); F = W√(S² + 1)', () => {
    const c = cycloneForces(15, 0.25, 2)
    expect(c.S).toBeCloseTo(225 / (9.81 * 0.25), 9)
    expect(c.F).toBeCloseTo(2 * Math.sqrt(c.S ** 2 + 1), 9)
  })
})

describe('conveyors — HAND Note 3 (no worked examples; formula checks)', () => {
  it('H1 capacity = A·v·3600 m³/h', () => expect(beltCapacityM3h(0.02, 2.5)).toBeCloseTo(180, 9))
  it('trough: flat belt (0° trough, no surcharge) carries nothing', () => expect(troughSection(0.5, 0.05, 0, 0).area).toBeCloseTo(0, 12))
  it('H5 chain P = 2VLWcf + W(LFc + H)V', () => expect(chainConveyorPower(0.5, 10, 100, 0.3, 200, 0.5, 2).total).toBeCloseTo(2 * 0.5 * 10 * 100 * 0.3 + 200 * (10 * 0.5 + 2) * 0.5, 9))
  it('H6 screw volume per rev π(D² − d²)p/4 and capacity at n rpm', () => {
    expect(screwVolumePerRev(0.2, 0.05, 0.2)).toBeCloseTo((Math.PI * (0.04 - 0.0025) * 0.2) / 4, 12)
    expect(screwCapacityM3h(0.2, 0.05, 0.2, 60, 0.4)).toBeCloseTo(screwVolumePerRev(0.2, 0.05, 0.2) * 3600 * 0.4, 9)
    expect(screwPower(0.2, 0.05, 0.2, 750, 60, 5, 0.4).P).toBeCloseTo(screwVolumePerRev(0.2, 0.05, 0.2) * 750 * 9.81 * 5 * 0.4, 9)
  })
  it('H8 bucket P = QH + 10 %; H9 pipe area and fan power', () => {
    expect(bucketElevatorPower(10, 20).total).toBeCloseTo(10 * 9.81 * 20 * 1.1, 9)
    const p = pneumaticDesign(0.5, 25, 3000, 0.5)
    expect(p.A).toBeCloseTo(0.02, 12)
    expect(p.P).toBeCloseTo(3000, 9)
  })
})

describe('layout metrics — HAND Note 4', () => {
  it('route length and crossings', () => {
    expect(routeLength([[0, 0], [3, 4], [3, 10]])).toBeCloseTo(11, 12)
    expect(flowCrossings([[[0, 0], [2, 2]], [[0, 2], [2, 0]]])).toBe(1)
    expect(flowCrossings([[[0, 0], [4, 0], [4, 2], [0, 2]]])).toBe(0)
  })
})

describe('preservation & food kinetics — N536', () => {
  it('N536 worked example: product cooling load', () => {
    const m = 90000 / 86400
    const load = coolingLoadKw(m, 3.2, 3, 225, 1.63, 11)
    expect(load).toBeCloseTo(263, 0)
  })
  it('N536 worked example: Plank freezing time', () => {
    // 7 cm sphere
    const tf = plankFreezingTime(1000, 250000, -1.25, -15, 1/6, 0.07, 50, 1/24, 1.2)
    expect(tf).toBeCloseTo(7335, -1)
  })
})
