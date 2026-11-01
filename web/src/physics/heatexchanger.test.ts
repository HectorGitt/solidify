import { describe, expect, it } from 'vitest'
import { along, areaFor, lmtd, rate, type Exchanger } from './heatexchanger'

describe('heat exchanger sizing, from the tutorial answers', () => {
  it('hot oil at 2500 W/K, 360 to 300 °C, cold 30 to 200 °C, U = 800', () => {
    const Q = 2500 * 60
    expect(areaFor('parallel', Q, 800, 360, 300, 30, 200)).toBeCloseTo(0.973, 2)
    expect(areaFor('counter', Q, 800, 360, 300, 30, 200)).toBeCloseTo(0.892, 3)
  })
  it('oil cooler, 190.5 kW, U = 738', () => {
    expect(areaFor('parallel', 190500, 738, 65.5, 54.4, 26.7, 37.8)).toBeCloseTo(9.85, 1)
    expect(areaFor('counter', 190500, 738, 65.5, 54.4, 26.7, 37.8)).toBeCloseTo(9.3, 1)
  })
  it('a parallel design that cannot work: the hot stream would leave colder than the cold one', () => {
    const Cc = (10 / 60) * 2930
    const Ch = (5 / 60) * 4180
    const Q = Cc * (55 - 27)
    const Tho = 85 - Q / Ch
    expect(Tho).toBeLessThan(55)
    expect(areaFor('parallel', Q, 500, 85, Tho, 27, 55)).toBeNull()
    expect(areaFor('counter', Q, 500, 85, Tho, 27, 55)).toBeGreaterThan(0)
  })
  it('equal end differences need no logarithm', () => {
    expect(lmtd(27.7, 27.7)).toBeCloseTo(27.7, 6)
  })
})

describe('an exchanger already built', () => {
  const x: Exchanger = { flow: 'counter', Thi: 360, Tci: 30, Ch: 2500, Cc: (2500 * 60) / 170, U: 800, A: 0.892 }
  it('gives back the outlets it was sized for', () => {
    const r = rate(x)
    expect(r.Tho).toBeCloseTo(300, 0)
    expect(r.Tco).toBeCloseTo(200, 0)
  })
  it('its duty agrees between the log-mean and the energy balance', () => {
    for (const flow of ['parallel', 'counter'] as const) {
      const r = rate({ ...x, flow })
      expect(x.U * x.A * r.lmtd).toBeCloseTo(r.Q, 0)
    }
  })
  it('the profiles meet the inlets and outlets at the ends', () => {
    for (const flow of ['parallel', 'counter'] as const) {
      const e = { ...x, flow }
      const r = rate(e)
      expect(along(e, 0).Th).toBeCloseTo(360, 6)
      expect(along({ ...e }, 0.999999).Th).toBeCloseTo(r.Tho, 2)
      expect(along(e, flow === 'parallel' ? 0 : 0.999999).Tc).toBeCloseTo(30, 2)
      expect(along(e, flow === 'parallel' ? 0.999999 : 0).Tc).toBeCloseTo(r.Tco, 2)
    }
  })
  it('balanced counter flow keeps a constant difference', () => {
    const e = { ...x, Cc: x.Ch }
    expect(along(e, 0).Th - along(e, 0).Tc).toBeCloseTo(along(e, 0.5).Th - along(e, 0.5).Tc, 6)
  })
  it('counter flow transfers more than parallel from the same exchanger', () => {
    expect(rate(x).Q).toBeGreaterThan(rate({ ...x, flow: 'parallel' }).Q)
  })
})
