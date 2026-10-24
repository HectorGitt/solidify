import { describe, expect, it } from 'vitest'
import { DEFAULTS, MASS_BALANCE_1000KG, calculateMillPerformance, pombClosure } from './model'

describe('palm oil mill (IMG-POMB mass balance, PQ p5 Q v)', () => {
  it('IMG-POMB per 1000 kg FFB: OER 22.5 %, KER 6.7 %, fruit/bunch 66.6 %', () => {
    const c = pombClosure()
    expect(c.oer).toBeCloseTo(22.5, 6)
    expect(c.ker).toBeCloseTo(6.7, 6)
    expect(c.fruitToBunch).toBeCloseTo(66.6, 6)
  })
  it('IMG-POMB does not close as printed: 100 kg steriliser loss and 59 kg dilution water are implied', () => {
    const c = pombClosure()
    expect(c.sterLoss).toBe(100)
    expect(c.fromFruit).toBe(725)
    expect(c.dilution).toBe(59)
  })
  it('default mill reproduces the chart: 225 kg CPO and 180 kg sludge per 1000 kg FFB', () => {
    const r = calculateMillPerformance(DEFAULTS)
    expect(r.cpoKg).toBeCloseTo(MASS_BALANCE_1000KG.cpo, 6)
    expect(r.sludgeKg).toBeCloseTo(MASS_BALANCE_1000KG.sludge, 6)
    expect(r.oer).toBeCloseTo(22.5, 6)
  })
  it('mass is conserved for any throughput', () => {
    const r = calculateMillPerformance({ ...DEFAULTS, ffbInput: 30000, conePressure: 35, centrifugeRpm: 3500 })
    const out = r.efbKg + r.condensateKg + r.cpoKg + r.sludgeKg + r.fibreKg + r.shellKg + r.kernelsKg
    expect(out).toBeCloseTo(30000 + r.dilutionKg, 6)
  })
  it('PQ p5 Q v: 50 µm oil globule, 900/1000 kg/m³, µ = 10⁻³ Pa·s rises at 1.36×10⁻⁴ m/s', () => {
    const r = calculateMillPerformance(DEFAULTS)
    expect(r.vStokesGravityPq).toBeCloseTo(1.3625e-4, 8)
  })
})
