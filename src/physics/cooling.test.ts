import { describe, expect, it } from 'vitest'
import { boilingPointC, capBoilingPointC, coolingFlows, coolingSteady, thermostatOpening, type CoolingParams } from './cooling'

describe('pressure cap raises the boiling point — TB Ch 7 (radiator pressure cap)', () => {
  it('water boils at 100 °C at 101.325 kPa', () => {
    expect(boilingPointC(101.325)).toBeCloseTo(100, 1)
  })
  it('a 90 kPa cap gives ≈ 119 °C (steam tables: 191.3 kPa → 118.9 °C)', () => {
    expect(capBoilingPointC(90)).toBeCloseTo(118.9, 0)
  })
})

describe('thermostat (typical wax element, beyond notes)', () => {
  it('shut below 82 °C, fully open at 95 °C, monotonic', () => {
    expect(thermostatOpening(70)).toBe(0)
    expect(thermostatOpening(95)).toBe(1)
    expect(thermostatOpening(88)).toBeGreaterThan(thermostatOpening(85))
  })
})

describe('forced circulation steady state', () => {
  const p: CoolingParams = { mode: 'forced', heat: 40e3, ambient: 30, rpm: 2000, fan: true, capKPa: 90, thermostat: true }
  it('settles inside the 60–93 °C operating range (509 Lecture 4)', () => {
    const s = coolingSteady(p)
    expect(s.Te).toBeGreaterThan(60)
    expect(s.Te).toBeLessThan(93)
  })
  it('energy balance at steady state: heat in = heat to radiator = heat to air', () => {
    const s = coolingSteady(p)
    const f = coolingFlows(s, p)
    expect(f.toRadiator / p.heat).toBeCloseTo(1, 2)
    expect(f.toAir / p.heat).toBeCloseTo(1, 2)
  })
  it('thermostat shut on a cold start: the radiator gets only the leak flow', () => {
    const f = coolingFlows({ Te: 40, Tr: 30 }, p)
    expect(f.radFlow).toBeLessThan(0.05 * (f.radFlow + f.bypassFlow))
  })
  it('without the fan the engine runs hotter', () => {
    expect(coolingSteady({ ...p, fan: false, thermostat: false }).Te).toBeGreaterThan(coolingSteady({ ...p, thermostat: false }).Te)
  })
})

describe('thermosiphon and air cooling', () => {
  it('thermosiphon flow needs a hot-leg / cold-leg temperature difference', () => {
    const p: CoolingParams = { mode: 'thermosiphon', heat: 20e3, ambient: 30, rpm: 1500, fan: true, capKPa: 0, thermostat: false }
    expect(coolingFlows({ Te: 50, Tr: 50 }, p).radFlow).toBe(0)
    expect(coolingFlows({ Te: 80, Tr: 60 }, p).radFlow).toBeGreaterThan(0)
    const s = coolingSteady(p)
    expect(coolingFlows(s, p).toAir / p.heat).toBeCloseTo(1, 2)
  })
  it('air-cooled cylinder settles where fin heat loss equals heat input', () => {
    const p: CoolingParams = { mode: 'air', heat: 15e3, ambient: 30, rpm: 2000, fan: true, capKPa: 0, thermostat: false }
    const s = coolingSteady(p)
    expect(coolingFlows(s, p).toAir / p.heat).toBeCloseTo(1, 2)
  })
})
