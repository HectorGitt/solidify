import { describe, expect, it } from 'vitest'
import { camLift } from '@/physics/machinedynamics'
import { DEFAULTS, MM, camShape, segmentsOf, type CamInputs } from './Rig'

/** the cam's outline, turned clockwise by θ */
function outline(p: CamInputs, theta: number) {
  const pts = camShape(p).getPoints(1)
  const c = Math.cos(-theta)
  const s = Math.sin(-theta)
  return pts.map((q) => [q.x * c - q.y * s, q.x * s + q.y * c])
}

describe('the follower stays on the cam, all the way round', () => {
  it('a knife edge touches the profile', () => {
    const p: CamInputs = { ...DEFAULTS }
    for (let d = 5; d < 360; d += 25) {
      const t = (d * Math.PI) / 180
      const tip = [0, (p.base + camLift(segmentsOf(p), t)) * MM]
      const gap = Math.min(...outline(p, t).map((q) => Math.hypot(q[0] - tip[0], q[1] - tip[1])))
      expect(gap / MM).toBeLessThan(0.8)
    }
  })
  it('a roller is tangent to the profile, neither clear of it nor cutting in', () => {
    const p: CamInputs = { ...DEFAULTS, follower: 'roller', rise: 'shm' }
    for (let d = 5; d < 360; d += 25) {
      const t = (d * Math.PI) / 180
      const centre = [0, (p.base + p.roller + camLift(segmentsOf(p), t)) * MM]
      const gap = Math.min(...outline(p, t).map((q) => Math.hypot(q[0] - centre[0], q[1] - centre[1])))
      expect(gap / MM).toBeCloseTo(p.roller, 0)
    }
  })
})
