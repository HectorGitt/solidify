import { describe, expect, it } from 'vitest'
import { coolingFlows, coolingSteady } from '@/physics/engineSystems'
import { DEFAULTS, SPEC, inputs, type CoolParams } from './model'

const steady = (p: Partial<CoolParams>) => {
  const inp = inputs({ ...DEFAULTS, ...p })
  const s = coolingSteady(SPEC, inp)
  return { s, f: coolingFlows(SPEC, inp, s) }
}

describe('cooling scene presets behave as their notes say', () => {
  it('default forced system settles in the L4 working range 60–93 °C', () => {
    const { s } = steady({})
    expect(s.Te).toBeGreaterThan(60)
    expect(s.Te).toBeLessThan(93)
  })
  it('thermostat stuck shut → boils at the cap pressure', () => {
    expect(steady({ thermostat: 'stuck-shut' }).f.boiling).toBe(true)
  })
  it('thermostat stuck open at light load on a cool day → runs cold (below 80 °C)', () => {
    expect(steady({ thermostat: 'stuck-open', load: 0.25, ambientC: 18 }).s.Te).toBeLessThan(80)
  })
  it('slack belt and scaled radiator overheat (> 93 °C)', () => {
    expect(steady({ beltSlip: 0.6, load: 1, ambientC: 38 }).s.Te).toBeGreaterThan(93)
    expect(steady({ scale: 0.8, load: 1, ambientC: 38 }).s.Te).toBeGreaterThan(93)
  })
  it('cap off → boils at 100 °C', () => {
    const r = steady({ capKPa: 0, scale: 0.5, load: 1, ambientC: 40 })
    expect(r.f.boilC).toBeCloseTo(100, 0)
    expect(r.f.boiling).toBe(true)
  })
  it('thermosiphon preset reaches a steady state with a larger radiator ΔT than forced', () => {
    const ts = steady({ mode: 'thermosiphon', load: 0.5, rpm: 1600 })
    const fc = steady({ load: 0.5, rpm: 1600 })
    expect(ts.f.toAir / ts.f.heat).toBeCloseTo(1, 1)
    expect(ts.s.Te - ts.f.Tbottom).toBeGreaterThan(fc.s.Te - fc.f.Tbottom)
  })
})
