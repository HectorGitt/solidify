import { describe, expect, it } from 'vitest'
import { buildStatic } from './geometry'
import { BALL, TURNS, kinematics } from './model'

describe('steering boxes (Tractor Steering Fig 46: drop arm about ±30°)', () => {
  it('both boxes reach ±30° at full lock', () => {
    const k = kinematics(TURNS * 2 * Math.PI)
    expect((k.ball.phi * 180) / Math.PI).toBeCloseTo(30, 9)
    expect((k.peg.phi * 180) / Math.PI).toBeCloseTo(30, 9)
    expect(k.ball.x).toBeCloseTo(BALL.arm * Math.tan(Math.PI / 6), 9)
  })
  // CSG-heavy: give it room when the whole suite runs in parallel
  it('geometry builds', () => {
    const g = buildStatic()
    for (const [name, geo] of Object.entries(g)) expect(geo.attributes.position.count, name).toBeGreaterThan(0)
  }, 120_000)
})
