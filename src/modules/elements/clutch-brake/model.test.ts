import { describe, expect, it } from 'vitest'
import { discOuterRadius } from '@/physics/elements'
import { DEFAULTS, bandLayout, bandResult, discResult, rad, shoeResult } from './model'
import { plateStack } from './parts'

describe('clutch & brake scene model (AEE503 Modules 8–9)', () => {
  it('Fig 14-1 pack: 5 steel + 4 bronze alternate, steel at both ends → n = 8 pairs', () => {
    const s = plateStack(5, 4, 1)
    expect(s.plates.map((p) => (p.steel ? 'S' : 'B')).join('')).toBe('SBSBSBSBS')
    expect(discResult(DEFAULTS).n).toBe(8)
  })
  it('MG16 Q5d: 16 N·m, 8 pairs, Dᵢ = 50 mm, f = 0.1, p = 350 kPa → Dₒ ≈ 70 mm; F ≈ 660 N (guide 667 N)', () => {
    const Ro = discOuterRadius(16, 350e3, 0.025, 0.1, 8, 'pressure')
    expect(Ro * 2000).toBeCloseTo(70, 0)
    const r = discResult({ ...DEFAULTS, Ro: 0.035, Ri: 0.025, p: 350e3 })
    expect(r.T).toBeCloseTo(16, 0)
    expect(r.F).toBeCloseTo(660, -1)
  })
  it('uniform wear, F = 4000 N, Rᵢ = 50, Rₒ = 100 mm → p_max 254.6, p_min 127.3, p_avg 169.8 kPa (calc)', () => {
    const p = { ...DEFAULTS, Ri: 0.05, Ro: 0.1, p: 4000 / (Math.PI * (0.1 ** 2 - 0.05 ** 2)) }
    const r = discResult(p)
    expect(r.F).toBeCloseTo(4000, 6)
    expect(r.pMax / 1000).toBeCloseTo(254.6, 1)
    expect(r.pMin / 1000).toBeCloseTo(127.3, 1)
    expect(r.pAvg / 1000).toBeCloseTo(169.8, 1)
  })
  it('Fig 15-10 shoe brake: F = 805 N clockwise, 861 N counter-clockwise, H_g = 11.8 kW', () => {
    const cw = shoeResult({ ...DEFAULTS, rpm: 500 })
    expect(Math.abs(cw.F - 805)).toBeLessThan(1)
    expect(cw.Hg / 1000).toBeCloseTo(11.8, 1)
    expect(Math.abs(shoeResult({ ...DEFAULTS, dir: 'ccw' }).F - 861)).toBeLessThan(1)
    expect(shoeResult({ ...DEFAULTS, c: 1.25 }).locks).toBe(true)
  })
  it('band brake Example 2: F₁ ≈ 1210 N, F₂ ≈ 455 N; the drawn layout wraps exactly 280°', () => {
    const r = bandResult(DEFAULTS)
    expect(r.F1).toBeCloseTo(1210, -1)
    expect(r.F2).toBeCloseTo(455, -1)
    const L = bandLayout(0.225, rad(280), 0.08)
    expect(((2 * Math.PI - (L.tr - L.tl)) * 180) / Math.PI).toBeCloseTo(280, 6)
  })
})
