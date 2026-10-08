import { describe, expect, it } from 'vitest'
import { rpmToRad } from '@/physics/gearing'
import { RATIO, REDUCTION } from './dims'
import { CAPACITY, DEFAULTS, SURFACES, idealOverlap, planShift } from './model'

describe('powershift unit — PT p4–6', () => {
  it('direct clutch gives 1 : 1; underdrive is slower, same direction; reverse turns the output backwards', () => {
    expect(RATIO.H).toBe(1)
    expect(RATIO.L).toBeGreaterThan(0)
    expect(RATIO.L).toBeLessThan(1)
    expect(RATIO.R).toBeLessThan(0)
  })
  it('4 disks + 4 plates + backing plate → 8 friction surfaces (n = n₁ + n₂ − 1, AEE503 M8)', () => {
    expect(SURFACES).toBe(8)
  })
  it('each clutch can carry the default engine torque with margin', () => {
    expect(CAPACITY).toBeGreaterThan(1.5 * DEFAULTS.torque)
  })
  it('with the ideal overlap a Low → High shift keeps power flowing and the engine ends at the new speed', () => {
    const wOut = rpmToRad(DEFAULTS.engineRpm) / REDUCTION.L
    const p = { ...DEFAULTS, overlap: idealOverlap(DEFAULTS.fill, DEFAULTS.torque) }
    const tr = planShift('L', 'H', wOut, p)
    expect(Math.min(...tr.Tout)).toBeGreaterThan(0.5 * DEFAULTS.torque)
    expect(tr.wIn[tr.wIn.length - 1]).toBeCloseTo(wOut, 3)
  })
  it('releasing the off-going clutch too early leaves a torque hole', () => {
    const wOut = rpmToRad(DEFAULTS.engineRpm) / REDUCTION.L
    const tr = planShift('L', 'H', wOut, { ...DEFAULTS, overlap: -0.15 })
    expect(Math.min(...tr.Tout)).toBeLessThan(0.3 * DEFAULTS.torque)
  })
})
