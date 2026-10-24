import { describe, expect, it } from 'vitest'
import { DEFAULTS, MOWER, baler, mower } from './model'

const AM = 'AGRICULTURAL MACHINERIES'

describe(`${AM} §16.2.2 mower in the scene`, () => {
  it('lead on the 5 ft (1.524 m) bar at 6 mm/m ≈ 9.1 mm', () => {
    expect(mower({ ...DEFAULTS, leadPerM: 6 }).lead * 1000).toBeCloseTo(9.144, 3)
  })
  it('stroke ≈ 2r = 76 mm (slightly more with the pitman offset); crank 918 rpm from a 540 PTO', () => {
    const m = mower(DEFAULTS)
    expect(m.S * 1000).toBeGreaterThan(76.1)
    expect(m.S * 1000).toBeLessThan(78)
    expect(m.N).toBeCloseTo(918, 6)
  })
  it('in register at zero offset; 14 km/h advances more than a section per stroke', () => {
    const m = mower({ ...DEFAULTS, regOffset: 0 })
    expect(Math.abs(m.reg.inner)).toBeLessThan(1e-9)
    expect(mower({ ...DEFAULTS, speed: 14 }).adv).toBeGreaterThan(MOWER.pitch)
  })
})

describe(`${AM} §16.2.3 baler in the scene`, () => {
  it('the notes’ bale at 160 kg/m³ weighs about 23 kg', () => {
    expect(baler(DEFAULTS).mass).toBeCloseTo(160 * 0.35 * 0.45 * 0.9, 9)
  })
  it('strokes per bale × slice = bale length; heavier windrow → thicker slices', () => {
    const b = baler(DEFAULTS)
    expect(b.strokes * b.slice).toBeCloseTo(0.9, 9)
    expect(baler({ ...DEFAULTS, windrow: 6 }).slice).toBeCloseTo(2 * b.slice, 9)
  })
})
