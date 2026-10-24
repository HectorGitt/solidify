import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PITCH } from '@/physics/elements'
import { DEFAULTS, pitchRadius, rollerPositions, select, sprocketAngle, twoSprocketLoop } from './model'

describe('chain loop kinematics', () => {
  const p = PITCH['3/4']
  const cl = twoSprocketLoop(17, 57, p, 40)
  it('snaps to a whole, even number of links', () => {
    expect(cl.links % 2).toBe(0)
    expect(cl.M / p).toBeCloseTo(cl.links, 3)
  })
  it('rollers on the small sprocket sit in its tooth seats as it turns', () => {
    for (const m0 of [0, 0.004, 0.011]) {
      const pos = rollerPositions(cl, m0, [])
      const th = sprocketAngle(cl, 0, 17, m0)
      const R = pitchRadius(17, p)
      const c = new THREE.Vector3(cl.centres[0][0], cl.centres[0][1], 0)
      let checked = 0
      for (const r of pos) {
        if (Math.abs(r.distanceTo(c) - R) > 1e-4) continue
        const a = Math.atan2(r.y - c.y, r.x - c.x) - th
        const k = (a / ((2 * Math.PI) / 17)) % 1
        expect(Math.min(Math.abs(k), 1 - Math.abs(k))).toBeLessThan(0.02)
        checked++
      }
      expect(checked).toBeGreaterThan(5)
    }
  })
})

describe('chain selection presets (AEE503 Module 3)', () => {
  it('2 kW, 200 → 60 rpm: 2.6 kW design, duplex 4.25 kW (MG17)', () => {
    const s = select(DEFAULTS)
    expect(s.design).toBeCloseTo(2.6, 9)
    expect(s.duplex).toBeCloseTo(4.25, 9)
    expect(s.strands).toBe(2)
    expect(s.out).toBeCloseTo(59.6, 1)
  })
  it('11 kW, 970 → 330 rpm: 14.3 kW, duplex 19.89 kW (MG19)', () => {
    const s = select({ ...DEFAULTS, rated: 11, rpm: 970, outRpm: 330, z1: 19, z2: 57, simplex: 11.7 })
    expect(s.design).toBeCloseTo(14.3, 9)
    expect(s.duplex).toBeCloseTo(19.89, 2)
    expect(s.strands).toBe(2)
  })
})
