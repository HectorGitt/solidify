import { describe, expect, it } from 'vitest'
import { capacityHa } from '@/physics/costs'
import { DEFAULTS, ISU_DISK, ISU_TRACTOR, buildPlan, costsOf, distAt, pointAt, type PathPoint } from './model'

describe('lands plan for the field-capacity scene', () => {
  const plan = buildPlan(DEFAULTS)
  it('passes alternate sides of the centre line and widen by w_e', () => {
    expect(plan.zs.slice(0, 4).map((z) => z / plan.we)).toEqual([0.5, -0.5, 1.5, -1.5])
    expect(plan.B).toBeCloseTo(plan.n * plan.we, 9)
  })
  it('the path is continuous through every headland turn', () => {
    const a: PathPoint = { x: 0, z: 0, dx: 0, dz: 0, r: 0, steer: 0 }
    const b: PathPoint = { ...a }
    for (let s = 0; s < plan.length; s += 0.25) {
      pointAt(plan, s, a)
      pointAt(plan, s + 0.25, b)
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.26)
    }
  })
  it('distance is monotonic in time and reaches the full length', () => {
    let prev = -1
    for (let t = 0; t <= plan.total; t += plan.total / 500) {
      const s = distAt(plan, t)
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = s
    }
    expect(distAt(plan, plan.total)).toBeCloseTo(plan.length, 6)
  })
  it('field efficiency lies between 0 and 1 and C_e = W·S·FE/10', () => {
    expect(plan.eff.FE).toBeGreaterThan(0.4)
    expect(plan.eff.FE).toBeLessThan(1)
    expect(plan.eff.Ce).toBeCloseTo(capacityHa(DEFAULTS.W, DEFAULTS.S, plan.eff.FE), 9)
  })
})

describe('scene cost model reproduces ISU PM 710 (AEE501 MGMT p6–8)', () => {
  it('tractor $46.56/h, disk $19.59/h, together $66.15/h', () => {
    const c = costsOf({ ...DEFAULTS, ...ISU_TRACTOR, ...ISU_DISK })
    expect(c.tractor.totalHour).toBeCloseTo(46.56, 2)
    expect(c.implement.totalHour).toBeCloseTo(19.59, 2)
    expect(c.combined).toBeCloseTo(66.15, 2)
  })
})
