import { describe, expect, it } from 'vitest'
import { armPower, dynoTorque, engineTorque, hydraulicCapacity, operatingPoint, scaleForce, torquePower, type DynoSpec } from './dynamometer'

describe('AEE502 TESTS eq 3–5', () => {
  it('2πlFn/60 000 with l = 0.8 m, F = 200 N, n = 1500 rpm → 25.13 kW; eq 4 with T = F·l agrees', () => {
    expect(armPower(0.8, 200, 1500)).toBeCloseTo(25.133, 3)
    expect(torquePower(160, 1500)).toBeCloseTo(armPower(0.8, 200, 1500), 12)
    expect(scaleForce(160, 0.8)).toBe(200)
  })
  it('hydraulic capacity ∝ N³D⁵ (p6)', () => {
    expect(hydraulicCapacity(10, 1000, 0.3, 2000, 0.3)).toBeCloseTo(80, 9)
    expect(hydraulicCapacity(10, 1000, 0.3, 1000, 0.6)).toBeCloseTo(320, 9)
  })
})

describe('“Farmland” engine (MECH Fig 2.2) on the dynamometer', () => {
  it('table values and high idle', () => {
    expect(engineTorque(2250)).toBe(142)
    expect(engineTorque(2390)).toBe(0)
    expect(engineTorque(2337.5)).toBeCloseTo(100, 9)
  })
  it('no load → runs at high idle 2390 rpm', () => {
    const p = operatingPoint(() => 0)
    expect(p.n).toBeCloseTo(2390, 6)
    expect(p.P).toBeCloseTo(0, 9)
  })
  it('a hydraulic brake loaded to 142 N·m at 2250 rpm holds the engine at maximum power (33.46 kW) and is stable', () => {
    const spec: DynoSpec = { kind: 'hydraulic', arm: 0.5, Tmax: 142, nRef: 2250 }
    const p = operatingPoint((n) => dynoTorque(spec, 1, n))
    expect(p.n).toBeCloseTo(2250, 0)
    expect(p.P).toBeCloseTo(33.46, 1)
    expect(p.stable).toBe(true)
  })
  it('a Prony brake (flat torque) in the lugging region is unstable — “speed control may be difficult”', () => {
    const spec: DynoSpec = { kind: 'prony', arm: 1, Tmax: 172, nRef: 1500 }
    const p = operatingPoint((n) => dynoTorque(spec, 1, n))
    expect(p.stalled).toBe(false)
    expect(p.n).toBeGreaterThan(1300)
    expect(p.n).toBeLessThan(1730)
    // the rising part of the curve below 1300 rpm gives no stable crossing for a flat brake
    const q = operatingPoint(() => 180)
    expect(q.stalled).toBe(true)
  })
  it('on the governor run-out a Prony brake is stable', () => {
    const p = operatingPoint(() => 100)
    expect(p.n).toBeCloseTo(2337.5, 0)
    expect(p.stable).toBe(true)
  })
})
