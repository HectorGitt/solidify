import { describe, expect, it } from 'vitest'
import challenges from './challenges'
import { DEFAULTS, build, engineSpeedFor, fullTorque, test, traction, useConfig, verdicts, RATED_RPM, HIGH_IDLE } from './model'

const run = (p: Partial<typeof DEFAULTS>) => test({ ...DEFAULTS, ...p })

describe('built tractor', () => {
  it('bigger engines make heavier, larger machines', () => {
    expect(build({ ...DEFAULTS, engine: 'large' }).mass).toBeGreaterThan(build(DEFAULTS).mass)
    expect(build({ ...DEFAULTS, engine: 'small' }).s).toBeCloseTo(1, 9)
  })
  it('front ballast moves the centre of gravity forward', () => {
    expect(build({ ...DEFAULTS, front: 800 }).chassis.xr).toBeGreaterThan(build(DEFAULTS).chassis.xr)
  })
  it('engine speed: governor line above rated, lugs down the curve, stalls past peak torque', () => {
    const b = build(DEFAULTS)
    expect(engineSpeedFor(b, 0)).toBeCloseTo(HIGH_IDLE, 6)
    expect(engineSpeedFor(b, fullTorque(b, RATED_RPM))).toBeCloseTo(RATED_RPM, 6)
    expect(engineSpeedFor(b, fullTorque(b, 1600))).toBeLessThan(RATED_RPM)
    expect(engineSpeedFor(b, fullTorque(b, 1300) * 1.5)).toBeNaN()
  })
})

describe('traction', () => {
  it('soft soil needs more slip than firm', () => {
    const b = build(DEFAULTS)
    expect(traction(b, { ...DEFAULTS, soil: 'soft' }, 18e3).slip).toBeGreaterThan(traction(b, { ...DEFAULTS, soil: 'firm' }, 18e3).slip)
  })
  it('front-wheel assist and radial tyres both cut slip', () => {
    const b = build(DEFAULTS)
    const base = traction(b, DEFAULTS, 18e3).slip
    expect(traction(b, { ...DEFAULTS, drive: 'mfwd' }, 18e3).slip).toBeLessThan(base)
    expect(traction(b, { ...DEFAULTS, tyre: 'radial' }, 18e3).slip).toBeLessThan(base)
  })
  it('too much pull spins the wheels', () => {
    expect(traction(build(DEFAULTS), DEFAULTS, 60e3).spin).toBe(true)
  })
})

describe('the test run', () => {
  it('drawbar power = pull × speed, never more than the engine power', () => {
    for (const trans of ['gear8', 'ps16', 'cvt'] as const) {
      const r = run({ trans })
      expect(r.ok).toBe(true)
      expect(r.Pdb).toBeCloseTo((DEFAULTS.pull * r.speed) / 3.6, 6)
      expect(r.Pdb).toBeLessThan(r.Peng)
    }
  })
  it('a stepped gearbox never goes faster than asked; a CVT matches the target', () => {
    expect(run({ trans: 'gear8' }).speed).toBeLessThanOrEqual(DEFAULTS.target * 1.02)
    expect(run({ trans: 'cvt' }).speed).toBeCloseTo(DEFAULTS.target, 1)
  })
  it('heavy rear ballast lowers slip but overloads the soil and lightens the steering', () => {
    const base = run({})
    const heavy = run({ rear: 2000 })
    expect(heavy.slip).toBeLessThan(base.slip)
    expect(heavy.pressure).toBeGreaterThan(110)
    expect(heavy.frontShare).toBeLessThan(base.frontShare)
  })
  it('the small tractor cannot pull a 4-furrow plough', () => {
    expect(run({ engine: 'small' }).ok).toBe(false)
  })
  it('a well-matched build passes every check', () => {
    const p = { ...DEFAULTS, drive: 'mfwd' as const, tyre: 'radial' as const, trans: 'ps16' as const, front: 250 }
    expect(verdicts(p, test(p)).every((v) => v.pass)).toBe(true)
  })
})

describe('challenge', () => {
  it('starts unsolved and has a known solution', () => {
    const c = challenges[0]
    useConfig.setState({ ...DEFAULTS, ...c.setup })
    expect(c.criteria.every((k) => k.check().pass)).toBe(false)
    useConfig.setState({ drive: 'mfwd', tyre: 'radial', front: 250 })
    expect(c.criteria.every((k) => k.check().pass)).toBe(true)
  })
})
