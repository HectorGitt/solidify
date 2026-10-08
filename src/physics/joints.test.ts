import { describe, expect, it } from 'vitest'
import { hookeAcceleration as driveAcc, hookeAngle as driveAngle, hookeSpeedRatio as driveRatio } from '@/core/drive'
import {
  deg,
  doubleHooke,
  doubleHookeRange,
  hookeAcceleration,
  hookeDrivenSpeed,
  hookeInertiaTorque,
  hookeMaxPositionError,
  hookeOutputAngle,
  hookeSpeedRange,
  hookeVelocityRatio,
  inertiaFromWeight,
  isConstantVelocityPair,
  rad,
  rpmToRad,
} from './joints'

const THETAS = [10, 20, 30, 40, 50, 60, 70, 80, 90]

describe("Hooke's joint velocity ratio — AEE502 2017/18 marking scheme Q4(d) (also 2016/17 Q4d table)", () => {
  it('δ = 20°, ω_A = 1000 rpm, θ = 10°…90° → 1060, 1048, 1030, 1009, 987, 968, 953, 943, 940 rpm', () => {
    const guide = [1060, 1048, 1030, 1009, 987, 968, 953, 943, 940]
    THETAS.forEach((t, i) => expect(hookeDrivenSpeed(1000, rad(20), rad(t))).toBeCloseTo(guide[i], -0.3)) // ±1 rpm (guide rounds)
  })

  // The guide feeds each ω_B into a second joint at 15° as a steady input speed, re-using α.
  const second: [number, number[]][] = [
    [1060, [1095, 1088, 1078, 1066, 1053, 1041, 1032, 1026, 1024]],
    [1048, [1083, 1076, 1066, 1054, 1041, 1030, 1020, 1014, 1012]],
    [1030, [1064, 1057, 1048, 1036, 1023, 1012, 1003, 997, 995]],
    [1009, [1042, 1036, 1026, 1014, 1002, 991, 982, 977, 975]],
    [987, [1020, 1013, 1004, 992, 981, 970, 961, 955, 953]],
  ]
  for (const [wb, row] of second) {
    it(`second joint at 15°, ω_B = ${wb} rpm → ${row[0]}…${row[8]} rpm (guide tables 2 i–v)`, () => {
      THETAS.forEach((t, i) => expect(Math.abs(hookeDrivenSpeed(wb, rad(15), rad(t)) - row[i])).toBeLessThanOrEqual(1.2))
    })
  }
})

describe("speed range — analysis-2 Example 26.3 and Dunn 'Universal Couplings' p2–3", () => {
  it('20°, 1000 rpm: (ω_B)max = 1064 rpm, (ω_B)min = 939.7 rpm', () => {
    const r = hookeSpeedRange(1000, rad(20))
    expect(r.max).toBeCloseTo(1064.2, 1)
    expect(r.min).toBeCloseTo(939.7, 1)
  })
  it('Dunn, φ = 45°: maximum ratio √2 at cos θ = 1, minimum 1/√2 at cos θ = 0', () => {
    expect(hookeVelocityRatio(rad(45), 0)).toBeCloseTo(Math.SQRT2, 12)
    expect(hookeVelocityRatio(rad(45), Math.PI / 2)).toBeCloseTo(Math.SQRT1_2, 12)
  })
  it('analysis-2 Fig 26.9 reading: a 30° joint at 1000 rpm swings about 850–1150 rpm (exact 866–1155)', () => {
    const r = hookeSpeedRange(1000, rad(30))
    expect(r.min).toBeGreaterThan(850)
    expect(r.max).toBeLessThan(1160)
  })
  it('Culpin (AEE510 TOP p4–5): at 40° the output position fluctuates by up to 15° (lead to lag)', () => {
    expect(2 * deg(hookeMaxPositionError(rad(40)))).toBeCloseTo(15.2, 1)
    expect(2 * deg(hookeMaxPositionError(rad(10)))).toBeLessThan(1) // "10° gives small fluctuation"
  })
})

describe('angular acceleration and inertia torque — analysis-2 Example 26.3 (147 N, k = 0.25 m, 20°, 1000 rpm, 45°)', () => {
  const w = rpmToRad(1000)
  const I = inertiaFromWeight(147, 0.25)
  it('I = (147/9.81)(0.25)² = 0.9365 kg·m²', () => expect(I).toBeCloseTo(0.9365, 4))
  it('α_B = −1360 rad/s² (book: −1365, from rounding sin²20° to 0.1175 — errata)', () => {
    expect(hookeAcceleration(rad(20), rad(45), w)).toBeCloseTo(-1359.9, 1)
  })
  it('inertia torque 1273.6 N·m on the driven shaft and 1271.1 N·m at the driver (book 1278.4 / 1276.2 — errata)', () => {
    const t = hookeInertiaTorque(rad(20), rad(45), w, I)
    expect(Math.abs(t.TB)).toBeCloseTo(1273.6, 1)
    expect(Math.abs(t.TA)).toBeCloseTo(1271.1, 1)
    expect(t.ratio).toBeCloseTo(0.99807, 5)
  })
  it('acceleration is the time derivative of the velocity ratio (numerical check)', () => {
    const d = rad(25)
    for (const th of [0.3, 1.1, 2.0, 4.4]) {
      const h = 1e-5
      const num = ((hookeVelocityRatio(d, th + h) - hookeVelocityRatio(d, th - h)) / (2 * h)) * w * w
      expect(hookeAcceleration(d, th, w)).toBeCloseTo(num, 3)
    }
  })
})

describe('output angle', () => {
  it('tan θ_B = tan θ / cos δ, continuous over several turns, and its derivative is the velocity ratio', () => {
    const d = rad(30)
    let prev = hookeOutputAngle(d, 0)
    for (let i = 1; i <= 2000; i++) {
      const th = (i / 2000) * 6 * Math.PI
      const out = hookeOutputAngle(d, th)
      expect(out - prev).toBeGreaterThan(0)
      expect(out - prev).toBeLessThan(0.02)
      prev = out
    }
    expect(hookeOutputAngle(d, 6 * Math.PI)).toBeCloseTo(6 * Math.PI, 9)
    const h = 1e-6
    expect((hookeOutputAngle(d, 0.7 + h) - hookeOutputAngle(d, 0.7 - h)) / (2 * h)).toBeCloseTo(hookeVelocityRatio(d, 0.7), 6)
  })
  it('agrees with the DriveGraph hookeJoint helpers in src/core/drive.ts', () => {
    for (const th of [0.2, 1.3, 2.9, 5.1]) {
      expect(hookeVelocityRatio(0.4, th)).toBeCloseTo(driveRatio(th, 0.4), 12)
      expect(hookeOutputAngle(0.4, th)).toBeCloseTo(driveAngle(th, 0.4), 12)
      expect(hookeAcceleration(0.4, th, 50)).toBeCloseTo(driveAcc(th, 0.4, 50), 9)
    }
  })
})

describe('double joint — analysis-2 §26.2.3 and Culpin (AEE510 TOP p4–5) conditions', () => {
  it('equal angles, intermediate yokes in line → output exactly follows input (constant velocity)', () => {
    const spec = { delta1: rad(20), delta2: rad(20), phase: 0 }
    expect(isConstantVelocityPair(spec)).toBe(true)
    for (const th of [0.1, 0.9, 2.2, 3.7]) expect(doubleHooke(spec, th).thetaOut).toBeCloseTo(th, 10)
  })
  it('the intermediate shaft still fluctuates (its speed ratio is the single-joint ratio)', () => {
    const spec = { delta1: rad(20), delta2: rad(20), phase: 0 }
    expect(doubleHooke(spec, 0).ratioC).toBeCloseTo(1 / Math.cos(rad(20)), 12)
  })
  it('yokes 90° out of phase double the fluctuation: ratio swings cos²δ … 1/cos²δ', () => {
    const r = doubleHookeRange({ delta1: rad(20), delta2: rad(20), phase: Math.PI / 2 })
    expect(r.max).toBeCloseTo(1 / Math.cos(rad(20)) ** 2, 6)
    expect(r.min).toBeCloseTo(Math.cos(rad(20)) ** 2, 6)
  })
  it('unequal angles (20° and 15°, in line) leave a residual fluctuation between the two single joints', () => {
    const r = doubleHookeRange({ delta1: rad(20), delta2: rad(15), phase: 0 })
    const single20 = hookeSpeedRange(1, rad(20)).fluctuation
    expect(r.fluctuation).toBeGreaterThan(0.02)
    expect(r.fluctuation).toBeLessThan(single20)
  })
})

describe('double joint in a turn and out of plane — Culpin (AEE510 TOP p5, BS 1495)', () => {
  it('hitch midway between the joints: equal angles ψ/2 in a turn → uniform output', async () => {
    const { hitchJointAngles } = await import('./joints')
    const h = hitchJointAngles(0.4, 0.4, rad(40))
    expect(deg(h.delta1)).toBeCloseTo(20, 9)
    expect(deg(h.delta2)).toBeCloseTo(20, 9)
    expect(isConstantVelocityPair({ delta1: h.delta1, delta2: h.delta2, phase: 0 })).toBe(true)
  })
  it('hitch not midway: the angles become unequal and the output fluctuates', async () => {
    const { hitchJointAngles } = await import('./joints')
    const h = hitchJointAngles(0.2, 0.6, rad(40))
    expect(h.delta1).toBeGreaterThan(h.delta2)
    expect(doubleHookeRange({ delta1: h.delta1, delta2: h.delta2, phase: 0 }).fluctuation).toBeGreaterThan(0.01)
  })
  it('shafts not in one plane: twisting joint 2’s plane by 90° is as bad as yokes 90° out of phase', () => {
    const twisted = doubleHookeRange({ delta1: rad(20), delta2: rad(20), phase: 0, twist: Math.PI / 2 })
    const outOfPhase = doubleHookeRange({ delta1: rad(20), delta2: rad(20), phase: Math.PI / 2 })
    expect(twisted.fluctuation).toBeCloseTo(outOfPhase.fluctuation, 9)
    // a plane twist can be cancelled by re-phasing the yokes by the same angle
    expect(isConstantVelocityPair({ delta1: rad(20), delta2: rad(20), phase: rad(30), twist: rad(30) })).toBe(true)
  })
})

describe('steering boxes — Tractor Steering Fig 46 (drop arm swings about ±30°, ST p3)', () => {
  it('recirculating ball: lead chosen for ±30° at ±2 turns; ratio 2πr/p at centre', async () => {
    const { recircBall, leadForSwing } = await import('./joints')
    const lead = leadForSwing('ball', 0.045, rad(30), 2)
    expect(deg(recircBall(4 * Math.PI, lead, 0.045).phi)).toBeCloseTo(30, 9)
    expect(recircBall(0, lead, 0.045).ratio).toBeCloseTo((2 * Math.PI * 0.045) / lead, 9)
    const h = 1e-6
    const num = (2 * h) / (recircBall(1 + h, lead, 0.045).phi - recircBall(1 - h, lead, 0.045).phi)
    expect(recircBall(1, lead, 0.045).ratio).toBeCloseTo(num, 3)
  })
  it('worm and peg: r·sin φ = p·θ/2π; ratio falls towards full lock', async () => {
    const { wormPeg, leadForSwing } = await import('./joints')
    const lead = leadForSwing('peg', 0.06, rad(30), 2)
    expect(deg(wormPeg(-4 * Math.PI, lead, 0.06).phi)).toBeCloseTo(-30, 9)
    expect(wormPeg(4 * Math.PI, lead, 0.06).ratio).toBeLessThan(wormPeg(0, lead, 0.06).ratio)
  })
})

describe('constant-velocity joints — analysis-2 §26.2.4–26.2.7', () => {
  it('Rzeppa balls lie in the bisecting (homokinetic) plane at the ball-circle radius', async () => {
    const { cvBallCentre } = await import('./joints')
    const d = rad(36)
    const n = [Math.cos(d / 2), 0, -Math.sin(d / 2)] // bisecting-plane normal
    for (const psi of [0.2, 1.4, 2.9, 4.4]) {
      const p = cvBallCentre(psi, d, 0.03)
      expect(p[0] * n[0] + p[1] * n[1] + p[2] * n[2]).toBeCloseTo(0, 12)
      expect(Math.hypot(...p)).toBeCloseTo(0.03, 12)
    }
  })
  it('tripode: drive shaft keeps step with the pot to within 0.02° at 30°; spider centre orbits a few tenths of a mm', async () => {
    const { tripodeSolve } = await import('./joints')
    let s = tripodeSolve(0, rad(30), 0.025)
    let maxErr = 0
    let maxOff = 0
    for (let i = 1; i <= 360; i++) {
      const th = (i / 360) * 2 * Math.PI
      s = tripodeSolve(th, rad(30), 0.025, s)
      const err = Math.atan2(Math.sin(s.phi - th), Math.cos(s.phi - th))
      maxErr = Math.max(maxErr, Math.abs(err))
      maxOff = Math.max(maxOff, Math.hypot(s.cy, s.cz))
    }
    expect(deg(maxErr)).toBeLessThan(0.02)
    expect(maxOff).toBeGreaterThan(1e-4)
    expect(maxOff).toBeLessThan(0.004)
  })
})
