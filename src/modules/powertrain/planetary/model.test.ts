import { beforeEach, describe, expect, it } from 'vitest'
import { buildStatic } from './geometry'
import { DEFAULTS, PG, RC, makeGraph, meshResiduals, offMultiple, overallRatio, simpleTorques, stepGraph, usePlanetary, type PlanetaryParams } from './model'

const run = (p: Partial<PlanetaryParams>, steps = 200, dt = 0.004) => {
  usePlanetary.setState({ ...DEFAULTS, lock: [], ...p })
  const g = makeGraph()
  const p1 = { theta: 0, omega: 0 }
  const p2 = { theta: 0, omega: 0 }
  let worst = 0
  for (let k = 0; k < steps; k++) {
    stepGraph(g, dt, p1, p2)
    for (let i = 0; i < PG.n; i++) {
      const r = meshResiduals(i, g.get('sun').theta, g.get('carrier').theta, g.get('ring').theta, p1.theta)
      worst = Math.max(worst, offMultiple(r.sunPlanet), offMultiple(r.planetRing))
    }
  }
  const rpm = (id: string) => (g.get(id).omega * 60) / (2 * Math.PI)
  return { g, rpm, worst }
}

describe('planetary scene — PT p5–6, TOP Fig A2.4', () => {
  beforeEach(() => usePlanetary.getState().reset())

  it('ring held: carrier turns the same way as the sun, slower (30/108); teeth stay interlocked', () => {
    const r = run({ input: 'sun', output: 'carrier', held: 'ring', rpm: 300 })
    expect(r.rpm('carrier')).toBeCloseTo((300 * 30) / 108, 6)
    expect(r.worst).toBeLessThan(1e-6)
  })
  it('lock any two members → the whole set turns as one, 1 : 1', () => {
    for (const lock of [['sun', 'carrier'], ['sun', 'ring'], ['carrier', 'ring']] as PlanetaryParams['lock'][]) {
      const r = run({ input: 'sun', output: 'carrier', held: 'none', lock, rpm: 200 }, 20)
      expect(r.rpm('carrier')).toBeCloseTo(200, 6)
      expect(r.rpm('ring')).toBeCloseTo(200, 6)
    }
  })
  it('carrier held → ring reversed at −z_s/z_r; Culpin overdrive ×3.6', () => {
    expect(run({ input: 'sun', output: 'ring', held: 'carrier', rpm: 260 }).rpm('ring')).toBeCloseTo((-260 * 30) / 78, 6)
    const c = run({ input: 'carrier', output: 'sun', held: 'ring', rpm: 100 })
    expect(c.rpm('sun')).toBeCloseTo(360, 6)
    expect(c.worst).toBeLessThan(1e-6)
  })
  it('compound: ratios multiply (underdrive × reverse)', () => {
    const p = { ...DEFAULTS, lock: [], compound: true, mode1: 'under' as const, mode2: 'reverse' as const, rpm: 300 }
    const r = run(p)
    expect(r.rpm('ring2')).toBeCloseTo(300 * (30 / 108) * (-30 / 78), 6)
    expect(overallRatio(p)).toBeCloseTo((30 / 108) * (-30 / 78), 9)
  })
  it('torque balance: sun in 100 N·m, ring held → 360 N·m out, 260 N·m on the brake', () => {
    const t = simpleTorques({ ...DEFAULTS, lock: [], torque: 100 })
    expect(t.out).toBeCloseTo(360, 9)
    expect(t.held).toBeCloseTo(260, 9)
  })
  it('the input can never be braked, and brake and lock are exclusive', () => {
    const s = usePlanetary.getState()
    s.set({ held: 'sun' })
    expect(usePlanetary.getState().held).toBe('none')
    s.set({ lock: ['sun', 'ring'] })
    expect(usePlanetary.getState().held).toBe('none')
    s.set({ held: 'ring' })
    expect(usePlanetary.getState().lock).toEqual([])
  })
  it('four planets clear each other and the geometry builds', () => {
    const g = buildStatic()
    expect(2 * RC * Math.sin(Math.PI / PG.n)).toBeGreaterThan(2 * g.planetTip)
    expect(g.ring.gear.attributes.position.count).toBeGreaterThan(0)
  })
})
