import { describe, expect, it } from 'vitest'
import {
  
  cumulativeOversize,
  
  
  
  
  
  
  
  stokesVelocity,
  
  
} from '@/physics/processing'
import { analyse, DEFAULTS } from './model'

describe('Separation physics & worked examples (SEP / RED / PQ)', () => {
  it('RED worked example: % retained [1.0, 2.5, 7.0, 24.0, 35.5, 22.5, 7.5, 0] gives FM = 3.12, D = 0.357 mm, UI = 1:6:3', () => {
    const masses = [2.5, 6.25, 17.5, 60.0, 88.75, 56.25, 18.75, 0]
    const p = { ...DEFAULTS, retainedMasses: masses, sampleMassG: 250 }
    const res = analyse(p)

    expect(res.pctRetained[0]).toBeCloseTo(1.0, 2)
    expect(res.pctRetained[3]).toBeCloseTo(24.0, 2)
    expect(res.fm).toBeCloseTo(3.12, 2)
    expect(res.avgSizeMm).toBeCloseTo(0.357, 3)
    expect(res.ui.ratio).toEqual([1, 6, 3])
  })

  it('PQ p1 Q3c burr mill sorghum setting 1: FM = 2.93, D = 0.337 mm, UI = 1:5:4', () => {
    const masses = [0, 6.8, 16.5, 40.1, 86.2, 91.0, 7.3, 2.1]
    const p = { ...DEFAULTS, retainedMasses: masses, sampleMassG: 250 }
    const res = analyse(p)

    expect(res.fm).toBeCloseTo(2.93, 2)
    expect(res.avgSizeMm).toBeCloseTo(0.337, 2)
    expect(res.ui.ratio).toEqual([1, 5, 4])
  })

  it('PQ p1 Q3c burr mill sorghum setting 2: FM = 2.71, D = 0.314 mm, UI = 1:4:5', () => {
    const masses = [0, 5.4, 13.5, 38.1, 70.8, 101.6, 9.2, 11.4]
    const p = { ...DEFAULTS, retainedMasses: masses, sampleMassG: 250 }
    const res = analyse(p)

    expect(res.fm).toBeCloseTo(2.71, 2)
    expect(res.avgSizeMm).toBeCloseTo(0.314, 3)
    expect(res.ui.ratio).toEqual([1, 4, 5])
  })

  it('PQ p3 Q3b screen effectiveness: IS 30 screen gives E ≈ 0.48', () => {
    const feed = [16, 59, 18, 4, 3]
    const over = [61.5, 34, 3.5, 1.0, 0]
    const under = [3.0, 58, 23.2, 7.8, 8.0]
    const [XF, XA, XB] = [feed, over, under].map((pct) => cumulativeOversize(pct, 1))

    expect(XF).toBeCloseTo(0.75, 2)
    expect(XA).toBeCloseTo(0.955, 3)
    expect(XB).toBeCloseTo(0.61, 2)

    const p = { ...DEFAULTS, XF, XA, XB }
    const res = analyse(p)

    expect(res.eff.E).toBeCloseTo(0.479, 3)
    expect(res.split.AF + res.split.BF).toBeCloseTo(1.0, 10)
  })

  it('PQ p3 Q3b screen effectiveness: IS 15 screen gives E ≈ 0.64', () => {
    const feed = [16, 59, 18, 4, 3]
    const over = [61.5, 34, 3.5, 1.0, 0]
    const under = [3.0, 58, 23.2, 7.8, 8.0]
    const [XF, XA, XB] = [feed, over, under].map((pct) => cumulativeOversize(pct, 3))

    expect(XF).toBeCloseTo(0.97, 2)
    expect(XA).toBeCloseTo(1.0, 2)
    expect(XB).toBeCloseTo(0.92, 2)

    const p = { ...DEFAULTS, XF, XA, XB }
    const res = analyse(p)

    expect(res.eff.E).toBeCloseTo(0.644, 3)
  })

  it('PQ p5 Q v: 50 µm oil globule in water rises at 1.36×10⁻⁴ m/s under gravity', () => {
    const V = stokesVelocity(50e-6, 900, 1000, 1e-3)
    expect(V).toBeCloseTo(-1.3625e-4, 7)
  })

  it('Aspirator winnower: air velocity between chaff and grain terminal velocities yields ideal separation', () => {
    const p = {
      ...DEFAULTS,
      airVelocity: 4.5,
      grainDiameterMm: 4.0,
      grainDensity: 1300,
      chaffDiameterMm: 1.8,
      chaffDensity: 240,
    }
    const res = analyse(p)

    expect(res.vtChaff).toBeLessThan(res.vtGrain)
    expect(res.vtChaff).toBeLessThan(4.5)
    expect(res.vtGrain).toBeGreaterThan(4.5)
    expect(res.aspiratorStatus).toBe('ideal')
    expect(res.chaffNetUp).toBeGreaterThan(0) // chaff rises
    expect(res.grainNetDown).toBeGreaterThan(0) // grain falls
  })

  it('Cyclone performance factor: S = V²/(gR) and resultant force F = W√(S² + 1)', () => {
    const p = { ...DEFAULTS, cycloneVelocity: 15, cycloneRadius: 0.25, cycloneParticleWeight: 2 }
    const res = analyse(p)
    const expectedS = (15 * 15) / (9.81 * 0.25)
    expect(res.cForces.S).toBeCloseTo(expectedS, 5)
    expect(res.cForces.F).toBeCloseTo(2 * Math.sqrt(expectedS * expectedS + 1), 5)
  })
})
