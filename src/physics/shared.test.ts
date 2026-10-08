import { describe, expect, it } from 'vitest'
import {
  axialForceUniformPressure,
  clutchTorque,
  frictionPairs,
  frictionRadiusUniformPressure,
  frictionRadiusUniformWear,
  pressureUniformWear,
} from './clutch'
import { cylinder, pump, ramSizing } from './hydraulics'

describe('clutch capacity — AEE503 Module 8', () => {
  it('10 driving + 9 driven plates give 18 friction surfaces (AEE510 TOP p7)', () => {
    expect(frictionPairs(10, 9)).toBe(18)
  })
  it('9-disc clutch: Di 50 mm, Do 70 mm, f 0.1, p 350 kPa → F ≈ 660 N, T ≈ 16 N·m', () => {
    const F = axialForceUniformPressure(350e3, 0.035, 0.025)
    expect(F).toBeCloseTo(659.7, 0)
    const T = clutchTorque(F, 0.1, frictionRadiusUniformWear(0.035, 0.025), frictionPairs(5, 4))
    expect(T).toBeCloseTo(16, 0)
  })
  it('plate clutch F = 4000 N, Ri 50, Ro 100 mm: p_max 254.6, p_min 127.3, p_avg 169.8 kPa', () => {
    expect(pressureUniformWear(4000, 0.05, 0.1, 0.05) / 1000).toBeCloseTo(254.6, 1)
    expect(pressureUniformWear(4000, 0.1, 0.1, 0.05) / 1000).toBeCloseTo(127.3, 1)
    expect(4000 / (Math.PI * (0.1 ** 2 - 0.05 ** 2)) / 1000).toBeCloseTo(169.8, 1)
  })
  it('uniform-pressure friction radius exceeds the uniform-wear one', () => {
    expect(frictionRadiusUniformPressure(0.1, 0.05)).toBeGreaterThan(frictionRadiusUniformWear(0.1, 0.05))
  })
})

describe('hydraulics — AEE502 marking guides', () => {
  it('pump at 1800 rpm, 18 MPa, ηv 0.8, ηT 0.9 → TT 429.7, TA 477.5 N·m, Ph 64.8, Ps 90, heat 25.2 kW', () => {
    const D = (2 * Math.PI * 429.7) / 18 // cm³/rev implied by the guide's TT
    const r = pump(D, 1800, 18, 0.8, 0.9)
    expect(r.TT).toBeCloseTo(429.7, 1)
    expect(r.TA).toBeCloseTo(477.5, 0) // guide rounds 477.44
    expect(r.Ph).toBeCloseTo(64.8, 1)
    expect(r.Ps).toBeCloseTo(90, 1)
    expect(r.heatLoss).toBeCloseTo(25.2, 1)
  })
  it('cylinder 76.2 mm bore, 25 mm rod, 17.2 MPa, 68.13 L/min', () => {
    const c = cylinder(0.0762, 0.025, 17.2e6, 68.13)
    expect(c.forceExtend / 1000).toBeCloseTo(78.4, 1)
    expect(c.forceRetract / 1000).toBeCloseTo(70.0, 1)
    expect(c.speedExtend).toBeCloseTo(0.249, 3)
    expect(c.speedRetract).toBeCloseTo(0.279, 3)
    expect(c.returnFlowRetract).toBeCloseTo(76.3, 1)
  })
  it('ram sizing (Culpin p11): 200 mm × Ø50, 20 kN in 2 s → 0.393 L, 0.197 L/s, 102 bar', () => {
    const r = ramSizing(0.2, 0.05, 20e3, 2)
    expect(r.volumeL).toBeCloseTo(0.393, 3)
    expect(r.flowLps).toBeCloseTo(0.196, 2)
    expect(r.pressureBar).toBeCloseTo(102, 0)
  })
})
