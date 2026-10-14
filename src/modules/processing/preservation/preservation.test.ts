import { describe, expect, it } from 'vitest'
import {
  coolingLoadKw,
  dValue,
  plankFreezingTime,
  timeForReduction,
  zValue,
} from '@/physics/processing'
import {
  analysePreservation,
  DEFAULTS,
  plankShapeFactors,
  respirationRateWPerKg,
} from './model'

describe('Preservation & Food Kinetics Physics (AEE 536 / N536)', () => {
  it('N536 worked example: product cooling load for 90 t/day meat chilling and freezing', () => {
    // N536 eq (1) worked example:
    // Meat at 90 t/day, 2 -> -12 °C, freezing point -1 °C, Ca = 3.2, hl = 225, Cb = 1.63 kJ/kg·K
    // m = 90 000 / 86 400 = 1.04167 kg/s
    // dTa = 2 - (-1) = 3 K
    // dTb = -1 - (-12) = 11 K
    // H = (90 000 / 86 400) * (3.2 * 3 + 225 + 1.63 * 11) = 263.05 kW ≈ 263 kW
    const m = 90000 / 86400
    const dTa = 3
    const hl = 225
    const dTb = 11
    const Ca = 3.2
    const Cb = 1.63

    const H = coolingLoadKw(m, Ca, dTa, hl, Cb, dTb)
    expect(H).toBeCloseTo(263.05, 1)
    expect(Math.round(H)).toBe(263)
  })

  it('N536 worked example: Plank freezing time for a 7 cm sphere in an air-blast tunnel', () => {
    // N536 eq (2) worked example:
    // 7 cm sphere (a = 0.07 m) in air-blast tunnel
    // Initial 10 °C, air -15 °C, Tf = -1.25 °C, rho = 1000 kg/m³, HL = 250 kJ/kg, k = 1.2 W/m·K, hc = 50 W/m²·K
    // Shape factors: P' = 1/6, R' = 1/24
    // tf = [rho * HL / (Tf - Tinf)] * [P' * a / hc + R' * a² / k]
    // = (1000 * 250 000 / 13.75) * (0.07 / (6 * 50) + 0.07² / (24 * 1.2))
    // = 7.335 * 10³ s ≈ 2.04 h
    const rho = 1000
    const HL = 250e3 // J/kg
    const Tf = -1.25
    const Tinf = -15
    const a = 0.07
    const hc = 50
    const k = 1.2
    const { P, R } = plankShapeFactors('sphere')

    expect(P).toBeCloseTo(1 / 6, 6)
    expect(R).toBeCloseTo(1 / 24, 6)

    const tf = plankFreezingTime(rho, HL, Tf, Tinf, P, a, hc, R, k)
    expect(tf).toBeCloseTo(7335.85, 0)
    expect(tf / 3600).toBeCloseTo(2.04, 2)
  })

  it('N536 microbial death kinetics: D-value, 12D botulinum process, and z-value', () => {
    // D = 2.303 / k
    const k = 10.9667 // min⁻¹
    const D = dValue(k)
    expect(D).toBeCloseTo(0.21, 2)

    // Clostridium botulinum: 12-log reduction (12D cook)
    // t = D * log10(Ni / N) = 0.21 * 12 = 2.52 min
    const tSteril = timeForReduction(0.21, 1e12, 1)
    expect(tSteril).toBeCloseTo(2.52, 2)

    // z-value: degrees for TDT curve to traverse one log cycle
    // z = (T2 - T1) / log10(D1 / D2)
    // At T1 = 121.1 °C, D1 = 0.21 min; At T2 = 111.1 °C, D2 = 2.10 min
    const z = zValue(111.1, 2.1, 121.1, 0.21)
    expect(z).toBeCloseTo(10.0, 1)
  })

  it('N536 Table 3.1: respiration heat for oranges and tomatoes', () => {
    // 1 tonne oranges at 16 °C gives 1000 * (3850–5405) / 86400 ≈ 45–63 W
    const rateOranges = respirationRateWPerKg('oranges', 15.6)
    const powerOranges = 1000 * rateOranges
    expect(powerOranges).toBeGreaterThanOrEqual(44)
    expect(powerOranges).toBeLessThanOrEqual(64)

    // 500 kg ripe tomatoes at ~4.4–5 °C gives ~7.8 W (1350 J/kg/day)
    const rateTomatoes = respirationRateWPerKg('tomatoes', 4.4)
    const powerTomatoes = 500 * rateTomatoes
    expect(powerTomatoes).toBeCloseTo((500 * 1350) / 86400, 1)
    expect(powerTomatoes).toBeCloseTo(7.81, 1)
  })

  it('model analysePreservation computes full energy and time metrics', () => {
    // Defaults has meat chilling/freezing parameters (263 kW)
    const resMeat = analysePreservation(DEFAULTS)
    expect(resMeat.productLoadKw).toBeCloseTo(263.05, 1)
    expect(resMeat.sterilisationTimeMin).toBeCloseTo(2.52, 2)
    expect(resMeat.F0Min).toBeCloseTo(2.52, 2)

    // With N536 sphere freezing parameters (Tf = -1.25 °C, HL = 250 kJ/kg)
    const resSphere = analysePreservation({ ...DEFAULTS, freezingPointC: -1.25, latentHeatKj: 250 })
    expect(resSphere.plankHours).toBeCloseTo(2.04, 2)
  })

  it('Packaged Plank freezing time correctly accounts for packaging barrier resistance', () => {
    const resUnpackaged = analysePreservation({ ...DEFAULTS, packageThicknessMm: 0 })
    const resPackaged = analysePreservation({ ...DEFAULTS, packageThicknessMm: 1.5, kPackage: 0.15 })
    // Adding packaging increases thermal resistance, thus increasing freezing time
    expect(resPackaged.plankSeconds).toBeGreaterThan(resUnpackaged.plankSeconds)
  })
})
