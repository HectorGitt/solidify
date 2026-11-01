import { describe, expect, it } from 'vitest'
import { AMMONIA, R134A } from './fluidtables'
import { rankine, refrigerantSat, refrigeration, steamSat, superheated } from './plantcycles'

describe('property tables, against the published tables', () => {
  it('ammonia at 30 °C', () => {
    const s = refrigerantSat(AMMONIA, 30)
    expect(s.p).toBeCloseTo(11.67, 1)
    expect(s.hf).toBeCloseTo(323.1, 1)
    expect(s.sg).toBeCloseTo(4.984, 3)
  })
  it('steam at 40 bar and at 0.04 bar', () => {
    expect(steamSat(40).T).toBeCloseTo(250.3, 0)
    expect(steamSat(40).hg).toBeCloseTo(2801, -1)
    expect(steamSat(0.04).T).toBeCloseTo(29, 0)
    expect(steamSat(0.04).hf).toBeCloseTo(121, 0)
  })
  it('superheated steam at 40 bar, 400 °C', () => {
    const s = superheated(40, 400)
    expect(s.h).toBeLessThan(3225)
    expect(s.h).toBeGreaterThan(3205)
    expect(s.s).toBeCloseTo(6.77, 1)
  })
})

describe('refrigeration cycle', () => {
  it('worked example: ammonia, wet compression, 30 °C to −15 °C', () => {
    const c = refrigeration(AMMONIA, -15, 30, true)
    expect(c.x1).toBeCloseTo(0.889, 2)
    expect(c.effect).toBeCloseTo(957.6, -1)
    expect(c.work).toBeCloseTo(188.2, -1)
    expect(c.cop).toBeCloseTo(5.09, 0)
  })
  it('dry compression discharges superheated, above the condensing temperature', () => {
    const c = refrigeration(R134A, -10, 40)
    expect(c.T2).toBeGreaterThan(40)
    expect(c.rejected).toBeCloseTo(c.effect + c.work, 6)
  })
  it('never beats Carnot, and COP falls as the evaporator gets colder', () => {
    for (const t of [AMMONIA, R134A]) {
      const warm = refrigeration(t, 0, 35)
      const cold = refrigeration(t, -25, 35)
      expect(warm.cop).toBeLessThan(warm.carnot)
      expect(cold.cop).toBeLessThan(warm.cop)
    }
  })
})

describe('Rankine cycle', () => {
  const base = { pb: 40, pc: 0.04, T: 400, etaT: 1 }
  it('textbook plant, 40 bar 400 °C to 0.04 bar', () => {
    const r = rankine(base)
    expect(r.xIdeal).toBeCloseTo(0.79, 1)
    expect(r.pump).toBeCloseTo(4, 0)
    expect(r.efficiency).toBeGreaterThan(0.36)
    expect(r.efficiency).toBeLessThan(0.39)
  })
  it('energy balances, and it stays under Carnot', () => {
    const r = rankine({ ...base, etaT: 0.85 })
    expect(r.qIn - r.qOut).toBeCloseTo(r.net, 6)
    expect(r.efficiency).toBeLessThan(r.carnot)
  })
  it('a worse turbine leaves drier, but less efficient, exhaust', () => {
    const a = rankine(base)
    const b = rankine({ ...base, etaT: 0.8 })
    expect(b.x4).toBeGreaterThan(a.x4)
    expect(b.efficiency).toBeLessThan(a.efficiency)
  })
  it('more boiler pressure at the same temperature raises efficiency and wets the exhaust', () => {
    const lo = rankine({ ...base, pb: 20 })
    const hi = rankine({ ...base, pb: 80 })
    expect(hi.efficiency).toBeGreaterThan(lo.efficiency)
    expect(hi.xIdeal).toBeLessThan(lo.xIdeal)
  })
})
