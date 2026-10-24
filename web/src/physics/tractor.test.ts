import { describe, expect, it } from 'vitest'
import {
  FARMLAND,
  dynamicLoads,
  hitchLoads,
  instabilityPsi,
  simpleTransfer,
  staticFront,
  staticRear,
  tippingDrawbarHeight,
} from './chassis'
import {
  FARMLAND_D,
  FARMLAND_GEARS,
  gearTrainEfficiency,
  idealGearCurve,
  idealPull,
  maxPower,
  overallEfficiency,
  powerEnvelopeSpeed,
  theoreticalSpeed,
  tractiveEfficiency,
} from './tractor'
import { BRIXIUS, axleTransfer, brixius, frictionPull, regressionTraction, slipForNTR } from './traction'

describe('tractor speed and pull — MECH p4 Fig 2.2 (Farmland tractor)', () => {
  it('gear 3 (q = 139.5): 4.07 km/h at 2390 rpm and no load', () => {
    expect(theoreticalSpeed(FARMLAND_D, 2390 / 60, FARMLAND_GEARS[3]) * 3.6).toBeCloseTo(4.07, 2)
  })
  it('gear 3: 38.31 kN at the 173 N·m torque peak, 2.21 km/h at 1300 rpm', () => {
    expect(idealPull(173, FARMLAND_GEARS[3], FARMLAND_D) / 1000).toBeCloseTo(38.31, 1)
    expect(theoreticalSpeed(FARMLAND_D, 1300 / 60, FARMLAND_GEARS[3]) * 3.6).toBeCloseTo(2.21, 2)
  })
  it('gear 7 (q = 47.3): 11.99 km/h at no load', () => {
    expect(idealGearCurve(FARMLAND_GEARS[7])[7].speedKmh).toBeCloseTo(11.99, 1)
  })
  it('maximum engine power ≈ 33.6 kW', () => {
    expect(maxPower()).toBeCloseTo(33.6, 0)
  })
  it('stepless envelope: 10 kN → 12.06 km/h, 40 kN → 3.02 km/h (33.5 kW)', () => {
    expect(powerEnvelopeSpeed(10, 33.5)).toBeCloseTo(12.06, 1)
    expect(powerEnvelopeSpeed(40, 33.5)).toBeCloseTo(3.02, 1)
  })
})

describe('efficiencies — MECH p8–9', () => {
  it('5 gear pairs at 98% ≈ 90%', () => expect(gearTrainEfficiency(5)).toBeCloseTo(0.904, 3))
  it('overall 0.3 × 0.90 × 0.75 ≈ 20%', () => expect(overallEfficiency(0.3, 0.9, 0.75)).toBeCloseTo(0.2025, 4))
  it('eq 2.10: P = 10 kN, R = 1 kN, i = 0.1 → ηt = 0.818', () => expect(tractiveEfficiency(10, 1, 0.1)).toBeCloseTo(0.818, 3))
})

describe('chassis — Macmillan Ch. 6', () => {
  it('Farmland static loads ≈ 8.0 kN front, 19.9 kN rear (App. II)', () => {
    expect(staticFront(FARMLAND) / 1000).toBeCloseTo(8.03, 1)
    expect(staticRear(FARMLAND) / 1000).toBeCloseTo(19.9, 1)
  })
  it('level pull transfers P·y′/x from front to rear', () => {
    const d = dynamicLoads(FARMLAND, 10000)
    expect(d.transfer).toBeCloseTo((10000 * 0.45) / 1.88, 6)
    expect(d.Vf + d.Vr).toBeCloseTo(FARMLAND.W, 6)
  })
  it('eq 6.35 worked case, tan α = 0.3: ψ′ = 0.72 (h = 0.7) and 0.67 (h = 0.8) with tan αs ≈ 0.595', () => {
    expect(instabilityPsi(0.3, 0.595, 0.7)).toBeCloseTo(0.72, 2)
    expect(instabilityPsi(0.3, 0.595, 0.8)).toBeCloseTo(0.67, 2)
  })
  it('Problem 6.16: tipping drawbar height ≈ 0.85 m (A 0.076 m², c 2 kPa, φ 32°)', () => {
    expect(tippingDrawbarHeight(FARMLAND.W, FARMLAND.xr, 0.076, 2000, (32 * Math.PI) / 180)).toBeCloseTo(0.85, 1)
  })
  it('eq 6.17: a mounted implement adds rear weight only when tan θ > z/(x + x′ + b)', () => {
    const s = { S: 5000, b: 0.8, z: 0.3, a: 2, theta: 0 }
    const lim = Math.atan(0.3 / (1.88 + 0.6 + 0.8))
    expect(hitchLoads(FARMLAND, { ...s, theta: lim - 0.01 }, 'mounted').gainRear).toBeLessThan(0)
    expect(hitchLoads(FARMLAND, { ...s, theta: lim + 0.01 }, 'mounted').gainRear).toBeGreaterThan(0)
  })
})

describe('exam weight transfer — AEE510 2022/23 Q2c, Q3c', () => {
  it('ΔW = 12 × 580/2083 = 3.34 kN; front 5.66, rear 22.84 kN', () => {
    const dW = simpleTransfer(12, 0.58, 2.083)
    expect(dW).toBeCloseTo(3.34, 2)
    const t = axleTransfer(19.5, 9, 12, 0.58, 2.083)
    expect(t.front).toBeCloseTo(5.66, 2)
    expect(t.rear).toBeCloseTo(22.84, 2)
  })
  it('pull = 0.85 × 25 kN = 21.25 kN', () => expect(frictionPull(0.85, 25)).toBeCloseTo(21.25, 2))
})

describe('traction — Lecture27 (Zoz & Grisso)', () => {
  it('Fig 17 regression at 10% slip: NTR = 0.664(1 − e^−0.98) ≈ 0.415', () => {
    expect(regressionTraction(0.1).NTR).toBeCloseTo(0.415, 3)
  })
  it('Brixius: GTR > NTR, TE peaks between 5% and 20% slip', () => {
    let best = { s: 0, TE: 0 }
    for (let s = 0.01; s < 0.5; s += 0.005) {
      const r = brixius(40, s)
      expect(r.GTR).toBeGreaterThan(r.NTR)
      if (r.TE > best.TE) best = { s, TE: r.TE }
    }
    expect(best.s).toBeGreaterThan(0.05)
    expect(best.s).toBeLessThan(0.2)
  })
  it('slipForNTR inverts brixius', () => {
    const s = slipForNTR(40, 0.4, BRIXIUS.radial)
    expect(brixius(40, s, BRIXIUS.radial).NTR).toBeCloseTo(0.4, 6)
  })
})
