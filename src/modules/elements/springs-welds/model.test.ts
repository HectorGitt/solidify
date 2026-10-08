import { describe, expect, it } from 'vitest'
import { signedVolume } from '../_shared/loop'
import { DEFAULTS, helicalResult, leafResult, weldResult } from './model'
import { barBead, bracketWelds } from './parts'

describe('springs & welds scene reproduces the AEE503 answers', () => {
  it('MG21 spring: k = 20 N/mm, Wahl K = 1.184, stress within 350 MPa with d = 6 mm', () => {
    const r = helicalResult(DEFAULTS)
    expect(r.k / 1000).toBeCloseTo(20, 0)
    expect(r.y * 1000).toBeCloseTo(25, 0)
    expect(r.Kw).toBeCloseTo(1.184, 3)
    expect(r.tau / 1e6).toBeLessThan(350)
  })
  it('MG17 leaf: 277 MN/m² full leaf, 195 MN/m² pre-stressed, y = 75 mm', () => {
    const r = leafResult(DEFAULTS)
    expect(r.se / 1e6).toBeCloseTo(277, -1)
    expect(r.s / 1e6).toBeCloseTo(195, -1)
    expect(r.y * 1000).toBeCloseTo(75, -1)
  })
  it('Ø50 bar → w = 15.4 mm; bracket → w = 9.2 mm (M11 Example 1)', () => {
    expect(weldResult(DEFAULTS).w * 1000).toBeCloseTo(15.4, 1)
    expect(weldResult({ ...DEFAULTS, weld: 'bracket', V: 35e3, arm: 0.57 }).w * 1000).toBeCloseTo(9.2, 1)
  })
  it('weld beads are solids with positive volume', () => {
    expect(signedVolume(barBead(0.025, 0.015, 0))).toBeGreaterThan(0)
    for (const g of bracketWelds(0.12, 0.12, 0.01)) expect(signedVolume(g)).toBeGreaterThan(0)
  })
})
