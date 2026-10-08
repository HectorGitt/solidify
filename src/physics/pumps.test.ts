import { describe, expect, it } from 'vitest'
import { pump, theoreticalFlow } from './hydraulics'
import { gearPumpDisplacementExact, gearPumpRipple, gearRadii, vanePumpDisplacementExact, vanePumpDisplacementNumeric } from './pumps'

describe('gear pump displacement from geometry (standard texts — beyond the notes)', () => {
  const g = { module: 0.003, teeth: 12, width: 0.02 }
  it('V = 2πb(ra² − r² − pb²/12) = 2πbm²(z + 1 − π²cos²α/12)', () => {
    const a = (20 * Math.PI) / 180
    const closed = 2 * Math.PI * 0.02 * 0.003 ** 2 * (12 + 1 - (Math.PI ** 2 * Math.cos(a) ** 2) / 12) * 1e6
    expect(gearPumpDisplacementExact(g)).toBeCloseTo(closed, 9)
    expect(gearPumpDisplacementExact(g)).toBeCloseTo(13.88, 2)
  })
  it('approaches the rule of thumb 2πm²zb for many teeth', () => {
    const big = { module: 0.002, teeth: 60, width: 0.03 }
    const thumb = 2 * Math.PI * 0.002 ** 2 * 60 * 0.03 * 1e6
    expect(gearPumpDisplacementExact(big) / thumb).toBeCloseTo(1.0045, 3)
  })
  it('the instantaneous-delivery ripple averages to 1 over a tooth period', () => {
    let s = 0
    const n = 2000
    for (let i = 0; i < n; i++) s += gearPumpRipple(g, ((i + 0.5) / n) * ((2 * Math.PI) / 12))
    expect(s / n).toBeCloseTo(1, 4)
    expect(gearRadii(g).centre).toBeCloseTo(0.036, 9)
  })
  it('the drawn tractor pump (m 3, z 12, b 20 mm) at 2000 rpm gives ≈ 27.8 L/min (notes: 27 L/min for a 45 kW tractor, HY p2)', () => {
    expect(theoreticalFlow(gearPumpDisplacementExact(g), 2000)).toBeCloseTo(27.8, 1)
  })
})

describe('vane pump displacement from geometry (standard texts — beyond the notes)', () => {
  const v = { ringR: 0.04, rotorR: 0.034, ecc: 0.004, width: 0.03, vanes: 8 }
  it('closed form 4πReL agrees with numerical n(Vmax − Vmin) as the vanes get many', () => {
    const exact = vanePumpDisplacementExact(v)
    expect(exact).toBeCloseTo(4 * Math.PI * 0.04 * 0.004 * 0.03 * 1e6, 9)
    expect(vanePumpDisplacementNumeric({ ...v, vanes: 64 }) / exact).toBeCloseTo(1, 3)
    // with 8 vanes the chamber-volume difference is still within 3 %
    expect(Math.abs(vanePumpDisplacementNumeric(v) / exact - 1)).toBeLessThan(0.03)
  })
  it('vane thickness reduces delivery by 2e·n·t·L', () => {
    const thin = vanePumpDisplacementExact(v)
    const thick = vanePumpDisplacementExact({ ...v, vaneT: 0.003 })
    expect(thin - thick).toBeCloseTo(2 * 0.004 * 8 * 0.003 * 0.03 * 1e6, 9)
  })
  it('zero eccentricity → zero delivery (variable-displacement principle)', () => {
    expect(vanePumpDisplacementExact({ ...v, ecc: 0 })).toBe(0)
  })
})

describe('pump calculator — AEE502 2016/17 marking guide Q(c)', () => {
  it('D = 150 cm³/rev, 1800 rpm, 18 MPa, ηv 0.8, ηT 0.9 → QT 270, QA 216 L/min, TT 429.7, TA 477.5 N·m, Ph 64.8, Ps 90, heat 25.2 kW', () => {
    const r = pump(150, 1800, 18, 0.8, 0.9)
    expect(r.QT).toBeCloseTo(270, 6)
    expect(r.QA).toBeCloseTo(216, 6)
    expect(r.TT).toBeCloseTo(429.7, 1)
    expect(r.TA).toBeCloseTo(477.5, 0)
    expect(r.Ph).toBeCloseTo(64.8, 6)
    expect(r.Ps).toBeCloseTo(90, 6)
    expect(r.heatLoss).toBeCloseTo(25.2, 6)
  })
})
