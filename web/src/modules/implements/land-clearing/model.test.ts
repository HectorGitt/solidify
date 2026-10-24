import { describe, expect, it } from 'vitest'
import { DEFAULTS, costing, recommend, survey } from './model'

describe('AEE502 2018/19 marking guide Q2c — clearing 40 ha (≈ 100 acres)', () => {
  const c = costing(DEFAULTS)
  it('40 ha rounds to the guide’s 100 acres', () => expect(c.acres).toBe(100))
  it('at the guide’s 100 acres: manual ₦1.5 M, dozer ₦1.0 M in 7 days, bale loader ₦1.0 M in 20 days', () => {
    const g = costing(DEFAULTS, 100)
    expect(g.manual.cost).toBeCloseTo(1_500_000, 3)
    expect(g.dozer.cost).toBeCloseTo(1_000_000, 3)
    expect(g.dozer.daysWhole).toBe(7)
    expect(g.loader.days).toBeCloseTo(20, 9)
    expect(g.guideManual.days).toBeCloseTo(25, 9)
    expect(g.cheapest.id).toBe('Dozer')
  })
})

describe('AGRICULTURAL MACHINERIES §11 / BUSH p3 — method choice', () => {
  it('strip count of 180 stems → 1800 stems/ha; chain suits 30 cm regrowth', () => {
    const s = survey(180, 30)
    expect(s.density).toBeCloseTo(1800, 9)
    expect(s.chain.ok).toBe(true)
  })
  it('regrowth → chaining; virgin forest (75 cm) → shear; tiny plot → hand', () => {
    expect(recommend('regrowth', 40).method).toBe('chain')
    expect(recommend('forest', 40).method).toBe('shear')
    expect(recommend('regrowth', 1).method).toBe('hand')
  })
})
