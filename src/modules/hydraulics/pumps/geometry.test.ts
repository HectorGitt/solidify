import { describe, expect, it } from 'vitest'
import { theoreticalFlow } from '@/physics/hydraulics'
import { buildStatic } from './geometry'
import { DEFAULTS, displacement } from './model'

describe('pumps scene', () => {
  it('geometry builds', () => {
    const g = buildStatic()
    for (const [k, v] of Object.entries(g)) expect(v.attributes.position.count, k).toBeGreaterThan(0)
  })
  it('the drawn gear pump at 2000 rpm with ηv 0.97 delivers ≈ 27 L/min (AEE510 HY p2: 45 kW tractor)', () => {
    expect(theoreticalFlow(displacement(DEFAULTS), 2000) * 0.97).toBeCloseTo(27, 0)
  })
})
