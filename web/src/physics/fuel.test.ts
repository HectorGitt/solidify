import { describe, expect, it } from 'vitest'
import { sfc } from './engine'
import {
  CALORIFIC_VALUES,
  deliveryPerStroke,
  heatingValue,
  helixEffectiveStroke,
  injectorOpeningPressure,
  injectorSpringForce,
  jetFuelFlow,
  kgcm2ToPa,
  mixtureStrength,
  orificeDepression,
  plungerState,
  powerFromAir,
  pumpFuelRate,
  specificAirConsumption,
  thermalEfficiency,
  fuelRateForPower,
  type HelixElement,
} from './fuel'

describe('engine fuel and air — AEE509 Misc. Exercises', () => {
  it('Ex 1 (p5): 2500 kW, ηth 0.30, HV 40 000 kJ/kg → ṁf 12.5 kg/min, ṁa 187.5 kg/min, sfc 0.3, sac 4.5 kg/kWh', () => {
    const mf = fuelRateForPower(2500e3, 40e6, 0.3) * 60
    expect(mf).toBeCloseTo(12.5, 6)
    expect(mf * 15).toBeCloseTo(187.5, 6)
    const s = sfc(mf * 60, 2500)
    expect(s).toBeCloseTo(0.3, 6)
    expect(specificAirConsumption(s, 15)).toBeCloseTo(4.5, 6)
  })
  it('Ex 3 (p5): ηth 0.25, ṁa 195 kg/min, F/A = 0.9 × stoichiometric → A/F 16.67, ṁf 11.7 kg/min, BP 1950 kW', () => {
    const fa = 0.9 / 15
    expect(1 / fa).toBeCloseTo(16.67, 2)
    expect(195 * fa).toBeCloseTo(11.7, 6)
    expect(powerFromAir(0.25, 40e6, 195 / 60, fa) / 1000).toBeCloseTo(1950, 3)
    expect(mixtureStrength(1 / fa)).toBe('lean')
  })
  it('Ex 4 (p5): ṁa 11.153 kg/min, A/F 15, ηbth 0.3, HV 45 MJ/kg → BP ≈ 167.3 kW', () => {
    expect(powerFromAir(0.3, 45e6, 11.153 / 60, 1 / 15) / 1000).toBeCloseTo(167.29, 1)
  })
  it('Ex 5 (p6): IP 5.506 kW on 2.4 L/h of petrol (760 kg/m³, 44 MJ/kg) → ηith 24.7 %', () => {
    const mf = (2.4e-3 * 760) / 3600
    expect(mf * 3600).toBeCloseTo(1.824, 3)
    expect(thermalEfficiency(5.506e3, mf, 44e6)).toBeCloseTo(0.247, 3)
  })
  it('Ex 7 (p6): BP 75.408 kW on 20 kg/h, HV 44 MJ/kg → ηbth 30.85 %', () => {
    expect(thermalEfficiency(75.408e3, 20 / 3600, 44e6)).toBeCloseTo(0.3085, 4)
  })
  it('mixture strength bands: 1 : 15 correct (TB §4.4.3), SI band 12–18 (Misc p3)', () => {
    expect(mixtureStrength(15)).toBe('correct')
    expect(mixtureStrength(13)).toBe('rich')
    expect(mixtureStrength(8)).toBe('very rich')
    expect(mixtureStrength(20)).toBe('very lean')
  })
})

describe('fuel data and pressures — Supplementary notes, TB p25', () => {
  it('calorific values: HSD 10 550 kcal/kg ≈ 44.17 MJ/kg; petrol 11 100 kcal/kg ≈ 46.47 MJ/kg', () => {
    expect(heatingValue('hsd') / 1e6).toBeCloseTo(44.17, 2)
    expect(heatingValue('petrol') / 1e6).toBeCloseTo(46.47, 2)
    expect(CALORIFIC_VALUES.ldo.kcal).toBe(10300)
  })
  it('injection pump pressure 120–300 kg/cm² ≈ 11.8–29.4 MPa; injector ≈ 140 kg/cm² ≈ 13.7 MPa', () => {
    expect(kgcm2ToPa(120) / 1e6).toBeCloseTo(11.77, 2)
    expect(kgcm2ToPa(300) / 1e6).toBeCloseTo(29.42, 2)
    expect(kgcm2ToPa(140) / 1e6).toBeCloseTo(13.73, 2)
  })
  it('injector spring load and opening pressure are inverse (beyond notes)', () => {
    const F = injectorSpringForce(kgcm2ToPa(140), 0.004, 0.0018)
    expect(injectorOpeningPressure(F, 0.004, 0.0018)).toBeCloseTo(kgcm2ToPa(140), 3)
    expect(F).toBeGreaterThan(100)
  })
})

describe('helix-metered injection pump element (TB §4.6)', () => {
  const el: HelixElement = { plungerD: 0.008, sleeveR: 0.009, helixLead: 0.0113, maxRotation: 1.111, preStroke: 0.002, camLift: 0.008 }
  it('rack at stop (vertical slot over the spill port) delivers nothing', () => {
    expect(helixEffectiveStroke(0, el)).toBe(0)
    expect(deliveryPerStroke(0, el)).toBe(0)
  })
  it('delivery rises in proportion to rack travel, up to the helix run-out', () => {
    const q4 = deliveryPerStroke(0.004, el)
    const q8 = deliveryPerStroke(0.008, el)
    const q10 = deliveryPerStroke(0.01, el)
    expect(q8 / q4).toBeCloseTo(2, 6)
    expect(deliveryPerStroke(0.02, el)).toBeCloseTo(deliveryPerStroke(0.01, el), 9)
    // ≈ 100 mm³ at full rack for an 8 mm plunger
    expect(q10 * 1e9).toBeGreaterThan(90)
    expect(q10 * 1e9).toBeLessThan(110)
  })
  it('a 4-cylinder pump at 1500 rpm: fuel rate = q ρ n N/2', () => {
    const q = 60e-9
    expect(pumpFuelRate(q, 1500, 4, 835) * 3600).toBeCloseTo(60e-9 * 835 * 4 * 750 * 60, 6)
  })
  it('delivery only while lift is between port closing and helix spill', () => {
    const rack = 0.008
    const eff = helixEffectiveStroke(rack, el)
    const angleAt = (lift: number) => Math.acos(1 - (2 * lift) / el.camLift)
    expect(plungerState(angleAt(el.preStroke - 1e-4), rack, el).delivering).toBe(false)
    expect(plungerState(angleAt(el.preStroke + eff / 2), rack, el).delivering).toBe(true)
    expect(plungerState(angleAt(el.preStroke + eff + 1e-4), rack, el).delivering).toBe(false)
    expect(plungerState(2 * Math.PI - angleAt(el.preStroke + eff / 2), rack, el).delivering).toBe(false)
  })
})

describe('carburettor flow (beyond notes)', () => {
  it('venturi depression scales with the square of the air flow', () => {
    const a = orificeDepression(0.02, 4.5e-4, 0.95, 1.16)
    expect(orificeDepression(0.04, 4.5e-4, 0.95, 1.16) / a).toBeCloseTo(4, 6)
  })
  it('no fuel leaves the jet until the depression lifts it to the jet tip', () => {
    expect(jetFuelFlow(30, 1e-6, 0.7, 740, 0.005)).toBe(0)
    expect(jetFuelFlow(2000, 1e-6, 0.7, 740, 0.005)).toBeGreaterThan(0)
  })
})
