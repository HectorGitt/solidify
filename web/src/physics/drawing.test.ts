import { describe, expect, it } from 'vitest'
import { apparentLength, curvePoint, development, meets, trueLength } from './drawing'

describe('true length', () => {
  it('is longer than any of the three projections', () => {
    const t = trueLength(60, 30, 40)
    expect(t.length).toBeCloseTo(Math.sqrt(6100), 6)
    for (const v of [t.plan, t.front, t.end]) expect(t.length).toBeGreaterThan(v)
  })
  it('appears only on a plane parallel to the plan view', () => {
    const t = trueLength(60, 30, 40)
    expect(apparentLength(60, 30, 40, t.bearing)).toBeCloseTo(t.length, 6)
    expect(apparentLength(60, 30, 40, 0)).toBeCloseTo(t.front, 6)
    for (const a of [0, 20, 60, 90]) expect(apparentLength(60, 30, 40, a)).toBeLessThanOrEqual(t.length + 1e-9)
  })
  it('the height and plan view make a right-angled triangle', () => {
    const t = trueLength(60, 30, 40)
    expect(Math.hypot(t.plan, 30)).toBeCloseTo(t.length, 6)
    expect(Math.tan((t.toHorizontal * Math.PI) / 180)).toBeCloseTo(30 / t.plan, 6)
  })
})

describe('interpenetration', () => {
  it('every point lies on both cylinders', () => {
    const j = { R: 50, r: 30, angle: 60, offset: 10 }
    for (let i = 0; i < 12; i++) {
      const phi = (i / 12) * 2 * Math.PI
      const p = curvePoint(j, phi)
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(50, 6)
      // distance from the branch axis
      const th = (60 * Math.PI) / 180
      const across = p.x * Math.cos(th) - p.y * Math.sin(th)
      expect(Math.hypot(across, p.z - 10)).toBeCloseTo(30, 6)
    }
  })
  it('equal cylinders at right angles meet in straight lines on the elevation', () => {
    const j = { R: 40, r: 40, angle: 90, offset: 0 }
    for (let i = 0; i < 12; i++) {
      const p = curvePoint(j, (i / 12) * 2 * Math.PI)
      expect(Math.abs(p.y)).toBeCloseTo(p.x, 6)
    }
  })
  it('a branch too large or too far off-centre does not fully meet', () => {
    expect(meets({ R: 40, r: 30, angle: 90, offset: 5 })).toBe(true)
    expect(meets({ R: 40, r: 30, angle: 90, offset: 15 })).toBe(false)
  })
  it('the flat pattern closes, and spans the circumference', () => {
    const d = development({ R: 50, r: 30, angle: 90, offset: 0 }, 120)
    expect(d.L[0]).toBeCloseTo(d.L[d.L.length - 1], 6)
    expect(d.s[d.s.length - 1]).toBeCloseTo(2 * Math.PI * 30, 6)
  })
})
