import { describe, expect, it } from 'vitest'
import { buildDynoGeometry } from './geometry'
import { PTO_RATIO, loadForSpeed, solve, type DynoKind } from './model'

const KINDS: DynoKind[] = ['prony', 'hydraulic', 'eddy', 'dc', 'pto']

describe('dynamometer running point on the Farmland engine curve (MECH Fig 2.2)', () => {
  it('no load → high idle 2390 rpm, zero torque', () => {
    for (const kind of KINDS) {
      const s = solve({ kind, load: 0, arm: 0.5 })
      expect(s.n).toBeCloseTo(2390, 0)
      expect(s.T).toBeCloseTo(0, 6)
    }
  })
  it('the load that holds 2244 rpm gives ≈ 33.5 kW and the scale satisfies P = 2πlFn/60 000', () => {
    for (const kind of KINDS) {
      const s = solve({ kind, load: loadForSpeed(kind, 2244), arm: 0.6 })
      expect(s.n).toBeCloseTo(2244, -1)
      expect(s.P).toBeGreaterThan(33.3)
      expect((2 * Math.PI * 0.6 * s.F * s.nDyno) / 60000).toBeCloseTo(s.Pdyno, 9)
    }
  })
  it('PTO: 540 rpm at 2000 engine rpm and PTO power = 0.85 × engine power', () => {
    const s = solve({ kind: 'pto', load: loadForSpeed('pto', 2000), arm: 0.6 })
    expect(s.nDyno).toBeCloseTo(2000 / PTO_RATIO, -1)
    expect(s.Pdyno / s.P).toBeCloseTo(0.85, 9)
  })
  it('a Prony brake above the peak torque stalls the engine; a hydraulic brake finds a stable point', () => {
    expect(solve({ kind: 'prony', load: 0.9, arm: 1 }).stalled).toBe(true)
    const h = solve({ kind: 'hydraulic', load: 0.6, arm: 0.5 })
    expect(h.stalled).toBe(false)
    expect(h.stable).toBe(true)
  })
})

describe('test-bed geometry', () => {
  it('builds every rig', () => {
    const g = buildDynoGeometry()
    expect(g.hydraulic.casing.getAttribute('position').count).toBeGreaterThan(100)
    expect(g.cart.absorber.getAttribute('position').count).toBeGreaterThan(100)
  })
})
