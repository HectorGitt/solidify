import { describe, expect, it } from 'vitest'
import { engineTorque, maxEnginePower } from './dynamometer'
import { airDensityRatio, armPower, capacityRatio, correctedPower, correctionFactor, STD_NOTES, torquePower, waterFlowFor } from './testing'

describe('AEE502 TESTS eq 3–5: P = 2πlFn/60 000 = 2πnT/60 000 kW', () => {
  it('Prony brake: arm 1 m, scale 142 N at 2250 rpm gives the same power as T = F·l', () => {
    expect(armPower(1, 142, 2250)).toBeCloseTo(torquePower(142, 2250), 12)
    expect(armPower(0.5, 284, 2250)).toBeCloseTo(33.46, 2)
  })
  it('“Farmland” engine (MECH Fig 2.2): maximum power ≈ 33.5 kW at 2250 rpm, 142 N·m (notes quote 33.6 kW)', () => {
    const m = maxEnginePower()
    expect(m.n).toBeCloseTo(2250, 0)
    expect(m.T).toBeCloseTo(142, 6)
    expect(m.P).toBeCloseTo(33.46, 2)
    expect(Math.abs(m.P - 33.6) / 33.6).toBeLessThan(0.005)
    expect(engineTorque(1300)).toBe(173)
  })
})

describe('Tractor power-measurement p11–12: atmospheric correction', () => {
  it('fa = 1 at standard conditions (99 kPa, 298 K)', () => {
    expect(correctionFactor(STD_NOTES.BP, STD_NOTES.T)).toBeCloseTo(1, 12)
    expect(airDensityRatio(99, 298)).toBeCloseTo(1, 12)
  })
  it('thin, hot air: 94 kPa at 35 °C raises observed power', () => {
    const fa = correctionFactor(94, 308.15, 0.7)
    expect(fa).toBeCloseTo((99 / 94) * (308.15 / 298) ** 0.7, 12)
    expect(fa).toBeGreaterThan(1)
    expect(correctedPower(30, fa)).toBeCloseTo(30 * fa, 12)
    // with friction power kept: Pbs = fa·Pbo + Pf(fa − 1)
    expect(correctedPower(30, fa, 5)).toBeCloseTo(30 * fa + 5 * (fa - 1), 12)
  })
})

describe('TESTS p6: hydraulic capacity ∝ N³D⁵', () => {
  it('doubling speed ×8, doubling diameter ×32', () => {
    expect(capacityRatio(2, 1, 1, 1)).toBe(8)
    expect(capacityRatio(1, 1, 2, 1)).toBe(32)
  })
  it('energy balance: 33.5 kW with a 30 K rise needs ≈ 0.27 kg/s of water', () => expect(waterFlowFor(33.5, 30)).toBeCloseTo(0.267, 3))
})
