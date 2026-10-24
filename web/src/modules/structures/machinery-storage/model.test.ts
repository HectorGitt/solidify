import { describe, expect, it } from 'vitest'
import { MACHINES } from '@/physics/structures'
import { DEFAULTS, design } from './model'

describe('machinery storage design (AEE505 LN p21–27)', () => {
  it('workshop door clears the tractor by the set clearance', () => {
    const D = design(DEFAULTS)
    expect(D.door.w).toBeCloseTo(MACHINES.tractor.w + 1.2, 6)
    expect(D.doorClear).toBeCloseTo(0.6, 6)
    expect(D.height).toBeGreaterThanOrEqual(D.door.h)
  })
  it('bays tile the shed from the workshop to the building end', () => {
    const D = design(DEFAULTS)
    expect(D.bays[D.bays.length - 1].x1).toBeCloseTo(D.length / 2, 6)
  })
  it('400 L diesel needs a separate store ≥ 15 m away; 10 m fails', () => {
    expect(design(DEFAULTS).hazard.required).toBe(true)
    expect(design(DEFAULTS).fuelOk).toBe(true)
    expect(design({ ...DEFAULTS, fuelGap: 10 }).fuelOk).toBe(false)
  })
  it('lifting span 2.5 m → timber beam; 4 m → truss or hoist', () => {
    expect(design({ ...DEFAULTS, liftSpan: 2.5 }).lift).toBe('timber beam')
    expect(design(DEFAULTS).lift).toBe('truss or portable hoist')
  })
})
