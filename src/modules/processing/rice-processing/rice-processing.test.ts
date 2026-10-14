import { describe, expect, it } from 'vitest'
import { DEFAULTS, analyseRiceProcessing, dryTo, grainType, kernelClass } from './model'

describe('rice processing (RICE 101.pdf p9–12)', () => {
  it('p12 grain types by L/W: long > 3, medium 2.0–2.9, short < 2', () => {
    expect(grainType(3.2)).toBe('long')
    expect(grainType(2.5)).toBe('medium')
    expect(grainType(2.0)).toBe('medium')
    expect(grainType(1.8)).toBe('short')
  })
  it('p12 kernel classes: head ≥ ¾ length, second heads ½–¾, brewers ≈ ¼', () => {
    expect(kernelClass(0.8)).toBe('head')
    expect(kernelClass(0.75)).toBe('head')
    expect(kernelClass(0.6)).toBe('second')
    expect(kernelClass(0.3)).toBe('screenings')
    expect(kernelClass(0.2)).toBe('brewers')
  })
  it('p9: paddy dried to ≈ 12 % MC — 1000 kg at 20 % gives 909.1 kg', () => {
    const d = dryTo(1000, 0.2, 0.12)
    expect(d.out).toBeCloseTo(909.09, 1)
    expect(d.water).toBeCloseTo(90.91, 1)
  })
  it('mill mass balance closes and head rice is about 55 % of paddy for long grain', () => {
    const a = analyseRiceProcessing(DEFAULTS)
    expect(a.impuritiesOut + a.huskOut + a.branOut + a.headRice + a.totalBrokens).toBeCloseTo(a.paddyIn, 6)
    expect(a.secondHeads + a.screenings + a.brewers).toBeCloseTo(a.totalBrokens, 6)
    expect(a.headRiceYieldPct).toBeGreaterThan(50)
    expect(a.headRiceYieldPct).toBeLessThan(65)
  })
  it('p11: parboiling hardens the kernel and raises head-rice yield', () => {
    const raw = analyseRiceProcessing(DEFAULTS)
    const pb = analyseRiceProcessing({ ...DEFAULTS, route: 'parboiled' })
    expect(pb.isGelatinized).toBe(true)
    expect(pb.headRiceYieldPct).toBeGreaterThan(raw.headRiceYieldPct)
  })
})
