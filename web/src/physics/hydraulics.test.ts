import { describe, expect, it } from 'vitest'
import {
  KGCM2_TO_MPA,
  axialPistonDisplacement,
  cylinder,
  gearPumpDisplacement,
  hydraulicPower,
  liftCapacity,
  liftRamPressure,
  motor,
  motorEfficiencies,
  pump,
  pumpEfficiencies,
  ramSizing,
  reliefSplit,
  strokeTime,
  theoreticalFlow,
  vanePumpDisplacement,
} from './hydraulics'

/** Displacement implied by the 2017/18 guide's TT = 429.7 N·m at 18 MPa (≈ 150 cm³/rev). */
const D_GUIDE = (2 * Math.PI * 429.7) / 18

describe('pump efficiencies from measurements — AEE502 2017/18 marking guide', () => {
  it('1800 rpm, 18 MPa: measured QA = 0.8·QT and TA = 477.5 N·m give ηv 0.8, ηT 0.9, ηo 0.72, Ps 90 kW', () => {
    const QT = theoreticalFlow(D_GUIDE, 1800)
    const e = pumpEfficiencies(D_GUIDE, 1800, 0.8 * QT, 18, 477.44)
    expect(e.etaV).toBeCloseTo(0.8, 3)
    expect(e.etaT).toBeCloseTo(0.9, 3)
    expect(e.etaO).toBeCloseTo(0.72, 3)
    expect(e.Ph).toBeCloseTo(64.8, 1)
    expect(e.Ps).toBeCloseTo(90, 1)
  })
  it('agrees with pump() for the same data (Ps − Ph = 25.2 kW heat)', () => {
    const p = pump(D_GUIDE, 1800, 18, 0.8, 0.9)
    const e = pumpEfficiencies(D_GUIDE, 1800, p.QA, 18, p.TA)
    expect(e.Ps - e.Ph).toBeCloseTo(25.2, 1)
    expect(e.Ps).toBeCloseTo(p.Ps, 6)
  })
})

describe('motor is the reverse of a pump — AEE502 guide "pump vs motor" table', () => {
  it('motor needs more flow than theoretical and gives less torque', () => {
    const m = motor(D_GUIDE, 270, 18, 0.9, 0.85)
    const e = motorEfficiencies(D_GUIDE, m.N, 270, 18, m.TA)
    expect(e.etaV).toBeCloseTo(0.9, 6)
    expect(e.etaT).toBeCloseTo(0.85, 6)
    expect(e.QT).toBeLessThan(270)
    expect(m.TA).toBeLessThan(e.TT)
    // output shaft power = ηo × hydraulic input
    expect(e.Ps).toBeCloseTo(e.Ph * 0.9 * 0.85, 6)
  })
})

describe('tractor lift-circuit numbers — AEE510 Tractor Hydraulic System p2–3', () => {
  it('relief at 150 kg/cm² ≈ 14.7 MPa (the notes round to 2000 psi; exact is 2134 psi)', () => {
    expect(150 * KGCM2_TO_MPA).toBeCloseTo(14.71, 2)
    expect((150 * KGCM2_TO_MPA * 1e6) / 6894.757).toBeCloseTo(2134, -1)
  })
  it('27 L/min at 150 kg/cm² carries Ph = Q·p/60 ≈ 6.6 kW', () => {
    expect(hydraulicPower(27, 150 * KGCM2_TO_MPA)).toBeCloseTo(6.62, 2)
  })
  it('relief valve: below the setting all flow goes to the ram; at the setting all of it returns to tank', () => {
    expect(reliefSplit(27, 10, 14.7)).toEqual({ pressure: 10, toLoad: 27, toTank: 0 })
    expect(reliefSplit(27, 20, 14.7)).toEqual({ pressure: 14.7, toLoad: 0, toTank: 27 })
  })
})

describe('ram sizing — Culpin App. 2 p11 (AEE510 Transmission of Power)', () => {
  it('200 mm × Ø50 ram lifting 20 kN in 2 s: 0.393 L, 102 bar, stroke time 2 s at 11.8 L/min', () => {
    const r = ramSizing(0.2, 0.05, 20e3, 2)
    const A = (Math.PI / 4) * 0.05 ** 2
    expect(strokeTime(A, 0.2, r.flowLps * 60)).toBeCloseTo(2, 6)
    expect(liftRamPressure(20e3, 1, 1, 0.05).pressurePa / 1e5).toBeCloseTo(101.9, 1)
  })
  it('same ram at the 275 bar relief setting can hold ≈ 54 kN direct-acting', () => {
    expect(liftCapacity(275e5, 0.05, 1, 1) / 1000).toBeCloseTo(54.0, 1)
  })
  it('lever rule: a 3:1 lift arm triples the ram force', () => {
    const r = liftRamPressure(10e3, 0.6, 0.2, 0.08)
    expect(r.ramForce).toBeCloseTo(30e3, 6)
    expect(liftCapacity(r.pressurePa, 0.08, 0.6, 0.2)).toBeCloseTo(10e3, 3)
  })
})

describe('double-acting cylinder — AEE502 2016/17 marking guide', () => {
  it('76.2 mm bore, 25 mm rod: retract is faster and weaker; return flow 76.3 L/min', () => {
    const c = cylinder(0.0762, 0.025, 17.2e6, 68.13)
    expect(c.speedRetract).toBeGreaterThan(c.speedExtend)
    expect(c.forceRetract).toBeLessThan(c.forceExtend)
    expect(c.returnFlowRetract).toBeCloseTo(76.3, 1)
  })
})

describe('displacement formulas (standard texts, beyond the notes)', () => {
  it('gear pump Do 2 in, Di 1.4 in, b 1 in → 1.602 in³ = 26.25 cm³/rev (Esposito, Fluid Power)', () => {
    const inch = 0.0254
    expect(gearPumpDisplacement(2 * inch, 1.4 * inch, 1 * inch)).toBeCloseTo(1.6022 * 16.387, 1)
  })
  it('vane pump: 2π·Dc·e·L for Dc 76.2, e 6.35, L 50.8 mm (twice the textbook "crescent area" value)', () => {
    const v = vanePumpDisplacement(0.0762, 0.0635, 0.00635, 0.0508)
    expect(v).toBeCloseTo(2 * Math.PI * 7.62 * 0.635 * 5.08, 6)
    // agrees with the chamber-by-chamber integration in pumps.ts for thin vanes
  })
  it('axial piston pump: 9 × Ø12.7 mm pistons on Ø127 mm at 15° → 4.32 cm³ × 9 × 0.268', () => {
    const v = axialPistonDisplacement(9, 0.0127, 0.127, 15)
    const A = (Math.PI / 4) * 1.27 ** 2
    expect(v).toBeCloseTo(9 * A * 12.7 * Math.tan((15 * Math.PI) / 180), 6)
    expect(axialPistonDisplacement(9, 0.0127, 0.127, 0)).toBe(0)
  })
})
