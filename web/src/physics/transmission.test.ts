import { describe, expect, it } from 'vitest'
import { frictionPairs, frictionRadiusUniformWear } from './clutch'
import {
  GEAR_PAIR_EFFICIENCY,
  axialPistonDisplacement,
  ballRampBrake,
  brakeTorqueOnShaft,
  converterEfficiency,
  converterPeak,
  converterTorqueRatio,
  crownWheelRatio,
  diffCaseSpeed,
  diffTorqueSplit,
  diffWheelSpeeds,
  epicyclicReduction,
  expandingShoeBrake,
  hydrostaticDrive,
  idealMotorSpeed,
  pistonOffset,
  reductionTable,
  ringTeeth,
  shortShoeBrake,
  spiderSpin,
  spurReduction,
  statorHeld,
  vortexShare,
  wetPlateBrake,
  brakeHeat,
} from './transmission'

const deg = (d: number) => (d * Math.PI) / 180

describe('hydrostatic drive — AEE502 marking guides (pump), PT p8', () => {
  it('pump of the 2016/17 guide (1800 rpm, 18 MPa, ηv 0.8, ηT 0.9): Ph 64.8 kW, Ps 90 kW, heat 25.2 kW', () => {
    const D = (2 * Math.PI * 429.7) / 18 // ≈150 cm³/rev, implied by the guide's TT = 429.7 N·m
    const r = hydrostaticDrive({ Dp: D, Dm: D, Np: 1800, dp: 18, pumpEtaV: 0.8, pumpEtaT: 0.9, motorEtaV: 1, motorEtaT: 1 })
    expect(r.hydraulicPower).toBeCloseTo(64.8, 1)
    expect(r.inputPower).toBeCloseTo(90, 1)
    expect(r.pumpTorque).toBeCloseTo(477.5, 0)
    // an ideal motor turns the delivered 216 L/min back into 64.8 kW at 0.8 × 1800 rpm
    expect(r.motorSpeed).toBeCloseTo(1440, 0)
    expect(r.outputPower).toBeCloseTo(64.8, 1)
    expect(r.heat).toBeCloseTo(25.2, 1)
  })
  it('swashplate at zero gives no flow; negative angle reverses the motor (PT p8: flow direction → travel direction)', () => {
    const base = { Dm: 50, Np: 2000, dp: 20, pumpEtaV: 0.95, pumpEtaT: 0.92, motorEtaV: 0.95, motorEtaT: 0.92 }
    expect(hydrostaticDrive({ ...base, Dp: 0 }).motorSpeed).toBe(0)
    const fwd = hydrostaticDrive({ ...base, Dp: 40 })
    const rev = hydrostaticDrive({ ...base, Dp: -40 })
    expect(rev.motorSpeed).toBeCloseTo(-fwd.motorSpeed, 6)
    expect(fwd.eta).toBeCloseTo(0.95 * 0.92 * 0.95 * 0.92, 6)
  })
  it('a smaller motor runs faster with less torque (variable motor)', () => {
    expect(idealMotorSpeed(2000, 50, 25)).toBe(4000)
    const a = hydrostaticDrive({ Dp: 50, Dm: 50, Np: 2000, dp: 20, pumpEtaV: 1, pumpEtaT: 1, motorEtaV: 1, motorEtaT: 1 })
    const b = hydrostaticDrive({ Dp: 50, Dm: 25, Np: 2000, dp: 20, pumpEtaV: 1, pumpEtaT: 1, motorEtaV: 1, motorEtaT: 1 })
    expect(b.motorSpeed / a.motorSpeed).toBeCloseTo(2, 6)
    expect(b.motorTorque / a.motorTorque).toBeCloseTo(0.5, 6)
    expect(b.outputPower).toBeCloseTo(a.outputPower, 6)
  })
  it('axial-piston displacement D = z·A·2R·tan β, and the stroke equals 2R·tan β', () => {
    const D = axialPistonDisplacement(9, 0.018, 0.036, deg(18))
    expect(D).toBeCloseTo(53.6, 1)
    expect(pistonOffset(0.036, deg(18), 0) - pistonOffset(0.036, deg(18), Math.PI)).toBeCloseTo(2 * 0.036 * Math.tan(deg(18)), 9)
    expect(axialPistonDisplacement(9, 0.018, 0.036, deg(-18))).toBeCloseTo(-D, 9)
  })
})

describe('torque converter — PT p8–11 (characteristic beyond notes)', () => {
  it('multiplies torque at stall and becomes a 1 : 1 coupling once the stator freewheels', () => {
    expect(converterTorqueRatio(0)).toBeCloseTo(2.2, 9)
    expect(converterTorqueRatio(0.85)).toBe(1)
    expect(converterTorqueRatio(0.95)).toBe(1)
    expect(statorHeld(0.5)).toBe(true)
    expect(statorHeld(0.9)).toBe(false)
  })
  it('efficiency is TR × SR: zero at stall, equal to SR in the coupling range', () => {
    expect(converterEfficiency(0)).toBe(0)
    expect(converterEfficiency(0.9)).toBeCloseTo(0.9, 9)
    const pk = converterPeak()
    expect(pk.SR).toBeGreaterThan(0.6)
    expect(pk.SR).toBeLessThanOrEqual(0.85)
    expect(converterEfficiency(pk.SR - 0.05)).toBeLessThan(pk.eta)
  })
  it('flow is all vortex at stall and turns into rotary flow as the turbine catches up (PT p10)', () => {
    expect(vortexShare(0)).toBe(1)
    expect(vortexShare(0.95)).toBeLessThan(0.1)
  })
})

describe('crown wheel & differential — TTS p7–8, PT p11–12', () => {
  it('crown wheel ratio is z_crown / z_pinion', () => {
    expect(crownWheelRatio(11, 47)).toBeCloseTo(4.273, 3)
  })
  it('one wheel held → the other turns at twice the cage speed (TTS p8)', () => {
    const s = diffWheelSpeeds(100, 'held', false)
    expect(s.left).toBe(0)
    expect(s.right).toBe(200)
    expect(diffCaseSpeed(s.left, s.right)).toBe(100)
  })
  it('cornering: one wheel gains what the other loses ("faster by the same amount", PT p11)', () => {
    const s = diffWheelSpeeds(100, 'cornering', false, 5, 1.5)
    expect(100 - s.left).toBeCloseTo(s.right - 100, 9)
    expect(s.left / s.right).toBeCloseTo((5 - 0.75) / (5 + 0.75), 9)
  })
  it('straight running: the planet pinions do not spin; diff lock forces equal speeds', () => {
    expect(spiderSpin(100, 100, 16, 10)).toBe(0)
    expect(spiderSpin(0, 200, 16, 10)).toBeCloseTo(-160, 9)
    expect(diffWheelSpeeds(100, 'held', true)).toEqual({ left: 100, right: 100 })
  })
  it('open diff gives equal torque, limited by the wheel with less grip; the lock lets the other wheel pull', () => {
    expect(diffTorqueSplit(1000, false, 100, Infinity)).toEqual({ left: 100, right: 100, delivered: 200 })
    expect(diffTorqueSplit(1000, true, 100, Infinity)).toEqual({ left: 100, right: 900, delivered: 1000 })
  })
})

describe('final drives — TTS p1, p10–11; AEE502 Tractor Mechanics p8', () => {
  it('spur and epicyclic reductions', () => {
    expect(spurReduction(13, 62)).toBeCloseTo(4.769, 3)
    expect(ringTeeth(15, 21)).toBe(57)
    expect(epicyclicReduction(15, 57)).toBeCloseTo(4.8, 9)
  })
  it('three reductions take a 2000 rpm engine to ≈ 20 rpm at the wheel — about 100 : 1 (TTS p1)', () => {
    const rows = reductionTable(2000, 200, [
      { name: 'gearbox', ratio: 5, pairs: 3 },
      { name: 'crown wheel', ratio: 4, pairs: 1 },
      { name: 'final', ratio: 5, pairs: 1 },
    ])
    const last = rows[rows.length - 1]
    expect(last.overall).toBe(100)
    expect(last.rpm).toBeCloseTo(20, 9)
    // five gear pairs at 98 % ≈ 90 % (Tractor Mechanics p8)
    expect(last.eta).toBeCloseTo(0.98 ** 5, 9)
    expect(last.eta).toBeCloseTo(0.904, 3)
    expect(last.torque).toBeCloseTo(200 * 100 * GEAR_PAIR_EFFICIENCY ** 5, 6)
  })
  it('a brake on the fast shaft needs only 1/i of the wheel torque (TTS p11)', () => {
    expect(brakeTorqueOnShaft(9600, 4.8)).toBeCloseTo(2000, 9)
  })
})

describe('brakes — AEE503 Module 9', () => {
  it('single shoe (Fig 15-10, MG15/Q17/E21/T21): 225 N·m, f 0.3 → N 2083 N, F 805 / 861 N, self-locks at c ≥ 1.2 m, 11.8 kW', () => {
    const r = shortShoeBrake({ T: 225, f: 0.3, R: 0.36, a: 0.36, b: 0.9, c: 0.04 })
    expect(r.N).toBeCloseTo(2083, 0)
    expect(r.Ff).toBeCloseTo(625, 0)
    expect(Math.abs(r.Fhelped - 805)).toBeLessThan(1) // guide truncates 805.6
    expect(Math.abs(r.Fopposed - 861)).toBeLessThan(1)
    expect(r.selfLockC).toBeCloseTo(1.2, 9)
    expect(brakeHeat(225, 500) / 1000).toBeCloseTo(11.8, 1)
  })
  it('internal expanding shoe (M9 formulas) reproduces the standard textbook example: F 2.28 kN, T 366 + 162 N·m', () => {
    // Shigley Ex. 16-2 geometry, used here only to check the notes' formulas (beyond-notes data)
    const g = { r: 0.15, w: 0.032, a: Math.hypot(0.112, 0.05), c: 0.212, f: 0.32, theta1: 0, theta2: deg(126) }
    const r = expandingShoeBrake(2280, g)
    expect(r.perPressure.Mf * 1e6).toBeCloseTo(304, 0)
    expect(Math.abs(r.perPressure.Mn * 1e6 - 788)).toBeLessThan(2) // textbook rounds intermediate values
    expect(r.pLead / 1e3).toBeCloseTo(1000, -1)
    expect(r.TLead).toBeCloseTo(366, -1)
    expect(r.pTrail / 1e3).toBeCloseTo(443, -1)
    expect(r.TTrail).toBeCloseTo(162, -1)
    expect(r.selfLocking).toBe(false)
  })
  it('ball-ramp disc brake is self-energising: servo factor > 1, growing with f and with a flatter ramp (TOP p9)', () => {
    const base = { P: 500, rampAngle: deg(30), rBall: 0.07, rFriction: frictionRadiusUniformWear(0.12, 0.07), f: 0.3, surfaces: 4 }
    const a = ballRampBrake(base)
    expect(a.F0).toBeCloseTo(500 / Math.tan(deg(30)), 6)
    expect(a.servoFactor).toBeGreaterThan(1)
    expect(ballRampBrake({ ...base, f: 0.4 }).servoFactor).toBeGreaterThan(a.servoFactor)
    expect(ballRampBrake({ ...base, rampAngle: deg(40) }).servoFactor).toBeLessThan(a.servoFactor)
    expect(ballRampBrake({ ...base, rampAngle: deg(20), f: 0.5 }).selfLocking).toBe(true)
  })
  it('wet multi-plate: T = n·f·F·R_f with n from the plate count (10 + 9 → 18 surfaces, TOP p7)', () => {
    const n = frictionPairs(10, 9)
    const r = wetPlateBrake(2e6, 0.005, 1000, 0.1, 0.1, n)
    expect(r.F).toBe(9000)
    expect(r.T).toBeCloseTo(18 * 0.1 * 9000 * 0.1, 9)
  })
})
