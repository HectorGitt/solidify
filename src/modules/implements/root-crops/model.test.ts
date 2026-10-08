import { describe, expect, it } from 'vitest'
import { DEFAULTS, digger, siftedFraction } from './model'

const AM = 'AGRICULTURAL MACHINERIES §20'

describe(`${AM} root-crop diggers in the scene`, () => {
  it('cassava digger-elevator recovers about 85 %: 20 t/ha → 17 t/ha', () => {
    const d = digger({ ...DEFAULTS, machine: 'cassava', depth: 0.25, ratio: 1.5, yield: 20 })
    expect(d.rec).toBeCloseTo(0.85, 9)
    expect(d.recovered).toBeCloseTo(17, 9)
  })
  it('manual lifter: 400 N → 1500 N is an advantage of 3.75', () => {
    expect(digger({ ...DEFAULTS, effort: 400, lift: 1500 }).lever).toBeCloseTo(3.75, 9)
  })
  it('elevator must run faster than the ground: sifting rises with the ratio', () => {
    expect(siftedFraction(0.8, true)).toBeLessThan(siftedFraction(1.5, true))
    expect(siftedFraction(1.5, false)).toBeLessThan(siftedFraction(1.5, true))
    expect(digger({ ...DEFAULTS, ratio: 0.8 }).rec).toBeLessThan(digger(DEFAULTS).rec)
  })
  it('soil lifted = W·d·S × 1000 m³/h', () => {
    expect(digger({ ...DEFAULTS, depth: 0.25, speed: 3 }).soil).toBeCloseTo(1.1 * 0.25 * 3 * 1000, 6)
  })
})
