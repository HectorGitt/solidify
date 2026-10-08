import { describe, expect, it } from 'vitest'
import {
  HYDRO_ADVANTAGES,
  HYDRO_LIFE_FACTORS,
  TC_DESIGNS,
  balancedPressures,
  brakePlacement,
  caseTorque,
  comboAngles,
  converterPoint,
  diffSpeeds,
  frictionBrakeTorque,
  hydraulicBrake,
  hydroLoop,
  threeReductions,
  turnSpeedRatio,
  turningBrakeSpeeds,
  unitDisplacement,
  type PistonUnit,
} from './drives'
import { theoreticalTorque } from './hydraulics'

const deg = (d: number) => (d * Math.PI) / 180
const unit: PistonUnit = { pistons: 9, bore: 0.018, pitchR: 0.036, maxAngle: deg(18) }

describe('hydrostatic loop — PT p8–9 (Q = D·N, T = Δp·D/2π beyond notes)', () => {
  const base = { pump: unit, motor: unit, Np: 2000, dp: 20, etaV: 1, etaT: 1 }
  it('VDP → FDM: lever through zero stops and reverses the motor (flow direction → travel direction)', () => {
    const fwd = hydroLoop({ ...base, combo: 'VDP-FDM', setting: { pumpLever: 1, motorLever: 1 } })
    const stop = hydroLoop({ ...base, combo: 'VDP-FDM', setting: { pumpLever: 0, motorLever: 1 } })
    const rev = hydroLoop({ ...base, combo: 'VDP-FDM', setting: { pumpLever: -0.5, motorLever: 1 } })
    expect(fwd.motorSpeed).toBeCloseTo(2000, 6) // equal units, full stroke → 1 : 1
    expect(stop.motorSpeed).toBe(0)
    expect(rev.motorSpeed).toBeLessThan(0)
    expect(Math.abs(rev.motorSpeed)).toBeCloseTo(2000 * Math.tan(deg(9)) / Math.tan(deg(18)), 3)
  })
  it('flow Q = D·N/1000 and motor torque = Δp·D/2π', () => {
    const r = hydroLoop({ ...base, combo: 'VDP-FDM', setting: { pumpLever: 1, motorLever: 1 } })
    expect(r.QT).toBeCloseTo((unitDisplacement(unit, deg(18)) * 2000) / 1000, 6)
    expect(r.motorTorque).toBeCloseTo(theoreticalTorque(20, r.Dm), 6)
  })
  it('a fixed pump cannot reverse or stop; a variable motor trades speed for torque', () => {
    const a = comboAngles('FDP-FDM', { pumpLever: -1, motorLever: 0.5 }, unit, unit)
    expect(a.pumpAngle).toBeCloseTo(deg(18), 9)
    expect(a.canReverse).toBe(false)
    const big = hydroLoop({ ...base, combo: 'FDP-VDM', setting: { pumpLever: 0, motorLever: 1 } })
    const small = hydroLoop({ ...base, combo: 'FDP-VDM', setting: { pumpLever: 0, motorLever: 0.5 } })
    expect(small.motorSpeed).toBeGreaterThan(big.motorSpeed)
    expect(small.motorTorque).toBeLessThan(big.motorTorque)
    expect(small.outputPower).toBeCloseTo(big.outputPower, 6)
  })
  it('piston stroke grows with the swashplate angle (2R·tan β)', () => {
    const r = hydroLoop({ ...base, combo: 'VDP-FDM', setting: { pumpLever: 0.5, motorLever: 1 } })
    expect(r.pumpStroke).toBeCloseTo(2 * 0.036 * Math.tan(deg(9)), 9)
  })
  it('the notes list 10 advantages and 4 life-shortening factors (PT p9)', () => {
    expect(HYDRO_ADVANTAGES).toHaveLength(10)
    expect(HYDRO_LIFE_FACTORS).toEqual(['Too much speed', 'Too much heat', 'Too much pressure', 'Contamination'])
  })
})

describe('torque converter — PT p8–11 (characteristic beyond notes)', () => {
  it('torque balance: turbine = impeller + stator; at stall the turbine torque is multiplied', () => {
    const p = converterPoint(2000, 300, 0)
    expect(p.Tt).toBeCloseTo(p.Ti + p.Ts, 9)
    expect(p.Tt).toBeGreaterThan(p.Ti)
    expect(p.statorHeld).toBe(true)
    expect(p.Nt).toBe(0)
    expect(p.eta).toBe(0)
  })
  it('past the coupling point the stator freewheels: no reaction torque, 1 : 1 torque (lock-up, PT p10)', () => {
    const p = converterPoint(2000, 300, 0.9)
    expect(p.statorHeld).toBe(false)
    expect(p.Ts).toBe(0)
    expect(p.Tt).toBe(300)
  })
  it('element-count table of PT p10 (designs A–D)', () => {
    expect(TC_DESIGNS.map((d) => [d.pumps, d.stators, d.turbines])).toEqual([
      [2, 2, 1],
      [1, 1, 2],
      [1, 2, 1],
      [1, 1, 1],
    ])
  })
})

describe('differential — TTS p8, PT p11–12', () => {
  it('one wheel held → the other turns at twice the case speed (TTS p8)', () => {
    expect(diffSpeeds(50, 'held', false)).toEqual({ left: 0, right: 100 })
  })
  it('one wheel on mud spins at 2× while the firm wheel stands; the diff lock makes both turn', () => {
    expect(diffSpeeds(50, 'mud', false)).toEqual({ left: 0, right: 100 })
    expect(diffSpeeds(50, 'mud', true)).toEqual({ left: 50, right: 50 })
  })
  it('cornering: one wheel faster by the same amount the other is slower (PT p11)', () => {
    const s = diffSpeeds(60, 'cornering', false, 4, 1.5)
    expect(60 - s.left).toBeCloseTo(s.right - 60, 9)
    expect(s.left / s.right).toBeCloseTo(turnSpeedRatio(4, 1.5), 9)
  })
  it('case torque = pinion torque × ratio × efficiency', () => {
    expect(caseTorque(500, 47 / 11, 1)).toBeCloseTo(2136.4, 1)
  })
})

describe('final drives — three reductions (TTS p1, p10)', () => {
  it('> 2000 rpm engine → ≈ 20 rpm wheel in bottom gear: about 100 : 1 overall', () => {
    const rows = threeReductions(2000, 250, 5, 4, 5)
    expect(rows[2].overall).toBe(100)
    expect(rows[2].rpm).toBeCloseTo(20, 9)
    // torque multiplies at each of the three points
    expect(rows[0].torque).toBeGreaterThan(250)
    expect(rows[1].torque).toBeGreaterThan(rows[0].torque)
    expect(rows[2].torque).toBeGreaterThan(rows[1].torque)
  })
  it('a straight axle (no final reduction) adds no gear pair', () => {
    const rows = threeReductions(2000, 250, 5, 4, 1)
    expect(rows[2].eta).toBeCloseTo(rows[1].eta, 12)
  })
})

describe('brakes — TTS p11–13, AEE503 M9', () => {
  it('T = μ·N·r per friction surface', () => {
    expect(frictionBrakeTorque(0.3, 2083.33, 0.36)).toBeCloseTo(225, 1) // AEE503 M9 single-shoe example
    expect(frictionBrakeTorque(0.1, 1000, 0.1, 18)).toBeCloseTo(180, 9)
  })
  it('brake on the fast shaft: same wheel torque needs 1/i of the torque and clamping force (TTS p11)', () => {
    const b = brakePlacement(6000, 5, 0.35, 0.1, 2)
    expect(b.torqueOnShaft).toBe(1200)
    expect(b.forceOnWheel / b.forceOnShaft).toBeCloseTo(5, 9)
  })
  it('hydraulic brakes: one master cylinder per pedal, balancing valve equalises when latched (TTS p13)', () => {
    const h = hydraulicBrake(300, 5, 3e-4, 1.2e-3)
    expect(h.p).toBeCloseTo(5e6, 3)
    expect(h.F).toBeCloseTo(6000, 3)
    expect(balancedPressures(4e6, 0, false)).toEqual({ left: 4e6, right: 0 })
    expect(balancedPressures(4e6, 0, true)).toEqual({ left: 2e6, right: 2e6 })
  })
  it('turning brake on one wheel: it stops and the other runs at twice cage speed', () => {
    expect(turningBrakeSpeeds(30, true, false)).toEqual({ left: 0, right: 60 })
    expect(turningBrakeSpeeds(30, false, false)).toEqual({ left: 30, right: 30 })
  })
})
