import { describe, expect, it } from 'vitest'
import { DEFAULTS, broadcaster, manure } from './model'

const AM = 'AGRICULTURAL MACHINERIES'

describe(`${AM} §14.4.1 broadcaster in the scene`, () => {
  it('default settings spread inside the notes’ 6–9 m width', () => {
    const b = broadcaster(DEFAULTS)
    expect(b.width).toBeGreaterThan(6)
    expect(b.width).toBeLessThan(10)
  })
  it('doubling the forward speed halves the rate', () => {
    const a = broadcaster({ ...DEFAULTS, speed: 6 })
    const b = broadcaster({ ...DEFAULTS, speed: 12 })
    expect(b.rate / a.rate).toBeCloseTo(0.5, 9)
  })
  it('a slower disc narrows the spread', () => {
    expect(broadcaster({ ...DEFAULTS, discRpm: 250 }).width).toBeLessThan(broadcaster(DEFAULTS).width)
  })
})

describe(`${AM} §14.3.1 manure spreader in the scene`, () => {
  it('ground-driven apron: rate independent of forward speed', () => {
    const a = manure({ ...DEFAULTS, machine: 'manure', drive: 'ground', speed: 4 })
    const b = manure({ ...DEFAULTS, machine: 'manure', drive: 'ground', speed: 10 })
    expect(b.tHa).toBeCloseTo(a.tHa, 9)
  })
  it('PTO-driven apron: rate ∝ 1/speed', () => {
    const a = manure({ ...DEFAULTS, machine: 'manure', drive: 'pto', speed: 4 })
    const b = manure({ ...DEFAULTS, machine: 'manure', drive: 'pto', speed: 8 })
    expect(b.tHa / a.tHa).toBeCloseTo(0.5, 9)
  })
  it('teeth per stroke scale the rate; beater runs 6.5 × wheel speed', () => {
    const a = manure({ ...DEFAULTS, teeth: 2 })
    const b = manure({ ...DEFAULTS, teeth: 4 })
    expect(b.tHa / a.tHa).toBeCloseTo(2, 9)
    expect(a.beater / a.nW).toBeCloseTo(6.5, 9)
    expect(a.tHa).toBeGreaterThan(5)
    expect(a.tHa).toBeLessThan(60)
  })
})
