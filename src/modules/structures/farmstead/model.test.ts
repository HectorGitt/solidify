import { describe, expect, it } from 'vitest'
import { DEFAULTS, assess, layout } from './model'

describe('farmstead layout', () => {
  it('default layout: livestock downwind, fuel store ≥ 15 m clear, farmstead ≤ 5 % of 60 ha', () => {
    const a = assess(DEFAULTS)
    expect(a.verdict).toBe('good')
    expect(a.plumeHits).toBe(false)
    expect(a.fuelOk).toBe(true)
    expect(a.frac).toBeLessThanOrEqual(0.05)
  })
  it('wind from the north carries the livestock odour onto the dwelling', () => {
    const a = assess({ ...DEFAULTS, windFrom: 0 })
    expect(a.verdict).toBe('bad')
    expect(a.plumeHits).toBe(true)
  })
  it('zones are ordered outward from the road: dwelling, machinery, grain, livestock', () => {
    const L = layout(DEFAULTS)
    expect(L.house.n).toBeLessThan(L.shed.n)
    expect(L.shed.n).toBeLessThan(L.silo.n)
    expect(L.silo.n).toBeLessThan(L.barns[0].n)
    expect(assess({ ...DEFAULTS, fuelGap: 8 }).fuelOk).toBe(false)
  })
})
