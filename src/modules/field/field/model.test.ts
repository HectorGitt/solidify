import { describe, expect, it } from 'vitest'
import { DEFAULTS, IMPLEMENTS, LANE_X, lanePlan, operating, pointAt } from './model'

describe('field: implement drafts and operating points', () => {
  it('AEE502 §12: three 35 cm bottoms at 20 cm in clay (2 N/cm²) → 4.2 kN', () => {
    expect(IMPLEMENTS.plough.draft(0.2, 2)).toBeCloseTo(4200, 6)
    expect(IMPLEMENTS.plough.draft(0.2, 1)).toBeCloseTo(2100, 6)
  })
  it('MECH eqs 2.4–2.7: pull in work gives slip, lower speed and drawbar power P·V', () => {
    const w = operating({ ...DEFAULTS, unitDraft: 5 }, true)
    const r = operating({ ...DEFAULTS, unitDraft: 5 }, false)
    expect(w.pt.slip).toBeGreaterThan(r.pt.slip)
    expect(w.pt.V).toBeLessThan(r.pt.V)
    expect(w.pt.Pd).toBeCloseTo(w.P * w.pt.V, 6)
  })
  it('heavy load in 7th gear lugs or stalls the engine; 3rd gear holds it', () => {
    const p7 = operating({ ...DEFAULTS, unitDraft: 5, depth: 0.2, gear: 7 }, true).pt
    const p3 = operating({ ...DEFAULTS, unitDraft: 5, depth: 0.2, gear: 3 }, true).pt
    expect(p7.stalled || p7.rpm < p3.rpm).toBe(true)
    expect(p3.stalled).toBe(false)
  })
})

describe('field: racetrack lane plan', () => {
  it('covers the strip, alternates direction and joins lanes with half-circles', () => {
    const plan = lanePlan(IMPLEMENTS.plough.W)
    expect(new Set(plan.order).size).toBe(plan.n)
    const a = pointAt(plan, 0)
    expect(a.x).toBeCloseTo(-LANE_X, 9)
    expect(a.h).toBeCloseTo(0, 9)
    // end of the first lane = start of the first turn; end of the turn = start of lane 2, heading −X
    const L = plan.segs[0].len
    const t = plan.segs[1].len
    const b = pointAt(plan, L + t - 1e-6)
    expect(b.x).toBeCloseTo(LANE_X, 3)
    expect(b.z).toBeCloseTo(plan.zs[plan.order[1]], 3)
    expect(Math.abs(Math.cos(b.h) + 1)).toBeLessThan(1e-3)
  })
})
