import { describe, expect, it } from 'vitest'
import { DEFAULTS, analyse, arcFactor, catalogue, deg, rad, type BeltParams } from './model'

const P = (p: Partial<BeltParams>): BeltParams => ({ ...DEFAULTS, ...p })

describe('belts scene model reproduces the AEE503 answers', () => {
  it('crossed belt 7.5 kW (MG15 Q2c): α = 214.9°, b ≈ 92 mm', () => {
    const a = analyse(P({}))
    expect(deg(a.alpha[0])).toBeCloseTo(214.9, 1)
    expect(a.width!.b * 1000).toBeCloseTo(92, 0)
  })
  it('compressor drive (MG16 Q2b): small pulley governs, P = 43.6 kW', () => {
    const a = analyse(P({ layout: 'idler', d: 0.3, D: 1.5, C: 2.2, rpm: 900, f1: 0.3, f2: 0.25, b: 0.25, t: 0.01, s1: 2e6, limit: 'stress', task: 'power', wraps: [rad(220), rad(270)], idlerPush: 0.35 }))
    expect(a.gov).toBe(0)
    expect(Math.abs(a.Pbelt / 1000 - 43.6)).toBeLessThan(0.1)
    expect(a.loop.wraps.length).toBe(3)
  })
  it('multiple V-belts (MG19 Q3a): 9.34 kW per belt → 3 belts (errata v-belts)', () => {
    const a = analyse(P({ layout: 'open', kind: 'v', d: 0.25, D: 0.8, C: 0.80405, rpm: 1150, f1: 0.2, f2: 0.2, groove: rad(36), mV: 0.523, T1max: 900, task: 'power', P: 26000 }))
    expect(deg(a.alpha[0])).toBeCloseTo(140, 1)
    expect(a.Pbelt / 1000).toBeCloseTo(9.34, 2)
    expect(a.belts!.n).toBe(3)
  })
  it('Fenner fan A section: L = 3632.5 mm, Table 5 arc factor 0.93 → 3.13 kW → 3 belts (M2 Example 1)', () => {
    const c = catalogue(P({ d: 0.25, D: 0.75, C: 1.0, catRated: 7.5, catSF: 1.2, catBasic: 2.7, catInc: 0.18, catFL: 1.17, catFarc: NaN }))
    expect(c.L).toBeCloseTo(3632.5, 6)
    expect(arcFactor(0.5)).toBeCloseTo(0.93, 9)
    expect(c.per).toBeCloseTo(3.13, 2)
    expect(c.n.n).toBe(3)
  })
  it('digester (MG17): guide arc factor 0.80 → 1.10 kW → 3 belts; Table 5 gives 0.87 → still 3', () => {
    const p = P({ d: 0.085, D: 0.425, C: 0.4164, catRated: 3, catSF: 1.1, catBasic: 1.21, catInc: 0.18, catFL: 0.99, catFarc: 0.8 })
    const c = catalogue(p)
    expect(c.L).toBeCloseTo(1702.9, 1)
    expect(c.per).toBeCloseTo(1.1, 2)
    expect(c.n.n).toBe(3)
    expect(c.FarcTable).toBeCloseTo(0.867, 2)
    expect(catalogue({ ...p, catFarc: NaN }).n.n).toBe(3)
  })
})
