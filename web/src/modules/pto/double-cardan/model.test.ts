import { describe, expect, it } from 'vitest'
import { doubleHooke, rad } from '@/physics/joints'
import { effectiveSpec, frames, makeGraph, outBodyAngle, pins, DEFAULTS, type Arrangement } from './model'

const cases: { d1: number; d2: number; ph: number; tw: number; arr: Arrangement }[] = [
  { d1: 20, d2: 20, ph: 0, tw: 0, arr: 'W' },
  { d1: 20, d2: 15, ph: 0, tw: 0, arr: 'Z' },
  { d1: 25, d2: 25, ph: 90, tw: 0, arr: 'Z' },
  { d1: 20, d2: 20, ph: 0, tw: 35, arr: 'W' },
  { d1: 30, d2: 10, ph: 40, tw: 70, arr: 'Z' },
]

describe('double-cardan rig — DriveGraph angles keep both crosses square (3D geometry = kinematics)', () => {
  for (const c of cases) {
    it(`δ ${c.d1}°/${c.d2}°, yoke phase ${c.ph}°, plane twist ${c.tw}°, ${c.arr}`, () => {
      const spec = effectiveSpec({ ...DEFAULTS, delta1: c.d1, delta2: c.d2, equal: false, phase: c.ph, twist: c.tw, arrangement: c.arr })
      const f = frames(spec)
      const g = makeGraph(() => spec)
      g.drive('in', 10)
      for (let i = 0; i < 400; i++) {
        g.step(0.0021)
        const a = { theta: g.get('in').theta, thetaC: g.get('mid').theta, thetaOut2: outBodyAngle(g.get('out').theta, spec) }
        const p = pins(f, a, spec.phase)
        expect(p.u0.dot(p.u1)).toBeCloseTo(0, 9)
        expect(p.u2.dot(p.u3)).toBeCloseTo(0, 9)
        expect(p.u3.dot(f.a2)).toBeCloseTo(0, 9)
      }
      expect(g.get('out').omega / 10).toBeCloseTo(doubleHooke(spec, g.get('in').theta).ratio, 9)
    })
  }
  it('equal angles, yokes in line, one plane: output angle equals input angle', () => {
    const spec = effectiveSpec(DEFAULTS)
    const g = makeGraph(() => spec)
    g.drive('in', 7)
    for (let i = 0; i < 300; i++) g.step(0.003)
    expect(g.get('out').theta).toBeCloseTo(g.get('in').theta, 9)
    expect(rad(20)).toBeCloseTo(spec.delta1, 12)
  })
})
