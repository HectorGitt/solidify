import { describe, expect, it } from 'vitest'
import { solve } from './fourbar'
import { sliderCrankDiagrams, cylinderBalance, turningMoment, turningPeriod, turningStats, CLASSIC_CAM, ballsToBalance, camLift, coupleMrz, dynamicBalance, energyFluctuation, equivalentMasses, flywheelInertia, fourBarDiagrams, hartnell, instantaneousCentre, motionLaw, pendulumInertia, pendulumPeriod, porter, porterAlphaAfterLift, radToRpm, reciprocatingForce, requiredInertia, resultantMr, rodEnds, rpmToRad, sensitivity, speedFluctuation, staticBalance, suspensionInertia, suspensionPeriod, wattHeight, wattSpeed } from './machinedynamics'

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

describe('inertia by oscillation', () => {
  it('the pendulum lab: 4 kg, h = 0.62 m, T = 1.539 s gives 1.459 kg·m²', () => {
    expect(pendulumInertia(4, 0.62, 1.539)).toBeCloseTo(1.459, 2)
  })
  it('the other readings in the same table', () => {
    expect(pendulumInertia(4, 0.6, 1.579)).toBeCloseTo(1.487, 2)
    expect(pendulumInertia(4, 0.56, 1.531)).toBeCloseTo(1.305, 2)
  })
  it('period and inertia invert one another, and the period has a minimum at h = k', () => {
    const k = 0.2
    const T = pendulumPeriod(k, 0.3)
    expect(pendulumInertia(1, 0.3, T)).toBeCloseTo(k * k + 0.09, 9)
    expect(pendulumPeriod(k, k)).toBeLessThan(pendulumPeriod(k, 0.1))
    expect(pendulumPeriod(k, k)).toBeLessThan(pendulumPeriod(k, 0.4))
  })
  it('suspension: formula and its inverse agree', () => {
    const T = suspensionPeriod(0.5, 3, 0.25, 0.42)
    expect(suspensionInertia(3, 0.25, 0.42, T)).toBeCloseTo(0.5, 9)
  })
  it('the bifilar lab: block on platform, by subtraction', () => {
    const platform = suspensionInertia(2, 0.25, 0.42, 0.867)
    const both = suspensionInertia(5.5, 0.25, 0.42, 0.581)
    const block = both - platform
    expect(block).toBeGreaterThan(0)
    // a solid disc of 3.5 kg, Ø75 mm: ½ m r² ≈ 0.0025 kg·m². The rig’s readings give the size of effect, not this value
    expect(block).toBeLessThan(0.1)
  })
})

describe('rotating balance', () => {
  const ms = [
    { m: 5, r: 0.03, angle: 0 },
    { m: 7, r: 0.045, angle: rad(52) },
    { m: 12, r: 0.025, angle: rad(220) },
  ]
  it('Example 1: 5, 7 and 12 kg at 30, 45 and 25 mm are out of balance by 0.1266 kg·m at 26°; 3.16 kg at 40 mm, at 206°, balances them', () => {
    const b = staticBalance(ms, 0.04)
    expect(b.mbrb).toBeCloseTo(0.1266, 2)
    expect(b.mb).toBeCloseTo(3.16, 0)
    expect(deg(b.angle)).toBeCloseTo(206, -1)
    expect(deg(resultantMr(ms).angle)).toBeCloseTo(26, -1)
  })
  it('adding that mass leaves no force', () => {
    const b = staticBalance(ms, 0.04)
    expect(resultantMr([...ms, { m: b.mb, r: 0.04, angle: b.angle }]).mag).toBeCloseTo(0, 9)
  })
  it('static balance does not mean dynamic balance', () => {
    const pair = [
      { m: 1, r: 0.1, angle: 0, z: 0.1 },
      { m: 1, r: 0.1, angle: Math.PI, z: 0.5 },
    ]
    expect(resultantMr(pair).mag).toBeCloseTo(0, 9)
    expect(coupleMrz(pair)).toBeGreaterThan(0.03)
  })
  it('two-plane balance removes both the force and the couple', () => {
    const q = [
      { m: 2, r: 0.1, angle: 0.4, z: 0.2 },
      { m: 3, r: 0.08, angle: 2.4, z: 0.5 },
    ]
    const d = dynamicBalance(q, 0, 0.8)
    const all = [...q, { m: d.a.mr, r: 1, angle: d.a.angle, z: 0 }, { m: d.b.mr, r: 1, angle: d.b.angle, z: 0.8 }]
    expect(resultantMr(all).mag).toBeCloseTo(0, 9)
    expect(coupleMrz(all)).toBeCloseTo(0, 9)
  })
  it('the ball count is proportional to mr', () => expect(ballsToBalance(0.02, 0.001, 0.05) * 2).toBeCloseTo(ballsToBalance(0.04, 0.001, 0.05), 9))
})

describe('reciprocating parts', () => {
  it('primary at crank speed, secondary at twice it and smaller by n', () => {
    const f = reciprocatingForce(2, 0.05, 4, 100, 0)
    expect(f.primary).toBeCloseTo(1000, 6)
    expect(f.secondary).toBeCloseTo(250, 6)
    expect(f.total).toBeCloseTo(1250, 6)
    expect(reciprocatingForce(2, 0.05, 4, 100, Math.PI).total).toBeCloseTo(-750, 6)
  })
  it('the worked rod: 16 kg, I = 320 000 kg·mm², a = 200 mm gives b = 100 mm, 5.333 and 10.667 kg', () => {
    const e = equivalentMasses(16, 320000, 200)
    expect(e.b).toBeCloseTo(100, 9)
    expect(e.m1).toBeCloseTo(5.333, 3)
    expect(e.m2).toBeCloseTo(10.667, 3)
  })
  it('a rod’s two end shares add up to the rod', () => {
    const r = rodEnds(16, 350, 200)
    expect(r.reciprocating + r.rotating).toBeCloseTo(16, 9)
  })
})

describe('governors', () => {
  it('Watt: 60 rpm stands about 0.25 m', () => {
    expect(wattHeight(rpmToRad(60))).toBeCloseTo(0.2485, 3)
    expect(wattSpeed(wattHeight(5))).toBeCloseTo(5, 9)
  })
  it('the Porter example: arms 200 mm at 30°, offset 36 mm, balls 3 kg, load 20 kg, lift 36 mm', () => {
    const low = porter(3, 20, 0.2, 0.036, rad(30))
    expect(low.r).toBeCloseTo(0.136, 9)
    expect(radToRpm(low.w)).toBeCloseTo(170.6, 0)
    expect(low.controllingForce).toBeCloseTo(130.3, 0)
    const a2 = porterAlphaAfterLift(0.2, rad(30), 0.036)
    expect(deg(a2)).toBeCloseTo(39.2, 0)
    const high = porter(3, 20, 0.2, 0.036, a2)
    expect(radToRpm(high.w)).toBeCloseTo(185.5, 0)
    expect(low.sleeve - high.sleeve).toBeCloseTo(0.036, 9)
    expect(sensitivity(radToRpm(low.w), radToRpm(high.w))).toBeCloseTo(0.084, 2)
  })
  it('the Hartnell example: 2.5 kg, arms 150 and 90 mm, r₀ 120 mm, 300 rpm, 8 % over 12 mm', () => {
    const h = hartnell(2.5, 0.15, 0.09, 0.12, 300, 0.08, 0.012)
    expect(h.r2).toBeCloseTo(0.14, 9)
    expect(h.F1).toBeCloseTo(296, 0)
    expect(h.S1).toBeCloseTo(987, 0)
    expect(h.k / 1000).toBeCloseTo(29.7, 0)
  })
})

describe('flywheels', () => {
  it('practice 1: 6500 kg, k = 1.8 m, between 120 and 118 rpm', () => {
    const I = flywheelInertia(6500, 1.8)
    expect(energyFluctuation(I, rpmToRad(120), rpmToRad(118)) / 1e3).toBeCloseTo(54.9, 0)
    expect(speedFluctuation(120, 118)).toBeCloseTo(2 / 119, 9)
  })
  it('sizing inverts the fluctuation', () => {
    const I = requiredInertia(1000, 100, 0.01)
    expect(I * 100 * 100 * 0.01).toBeCloseTo(1000, 6)
  })
})

describe('cams', () => {
  const s = CLASSIC_CAM(0.032)
  it('the past question: lift 32 mm by 120°, dwell to 180°, fall with SHM by 360°', () => {
    expect(camLift(s, 0)).toBeCloseTo(0, 9)
    expect(camLift(s, rad(60))).toBeCloseTo(0.016, 9)
    expect(camLift(s, rad(120))).toBeCloseTo(0.032, 9)
    expect(camLift(s, rad(150))).toBeCloseTo(0.032, 9)
    expect(camLift(s, rad(270))).toBeCloseTo(0.016, 9)
    expect(camLift(s, rad(359.99))).toBeCloseTo(0, 6)
  })
  it('every law runs from 0 to 1, through a half at the middle', () => {
    for (const m of ['uniform', 'shm', 'cycloidal', 'parabolic'] as const) {
      expect(motionLaw(m, 0)).toBeCloseTo(0, 9)
      expect(motionLaw(m, 1)).toBeCloseTo(1, 9)
      expect(motionLaw(m, 0.5)).toBeCloseTo(0.5, 9)
    }
  })
})

describe('velocity and acceleration diagrams', () => {
  const L = { frame: 0.08, crank: 0.04, coupler: 0.12, rocker: 0.1 }
  const D: [number, number] = [0.08, 0]
  it('agree with differentiating the solved linkage', () => {
    const h = 1e-5
    const w = 10
    for (const t of [0.4, 1.3, 2.6, 4, 5.4]) {
      const p = solve(L, t)!
      const d = fourBarDiagrams(p.B, p.C, D, w)
      const dt4 = (solve(L, t + h)!.theta4 - solve(L, t - h)!.theta4) / (2 * h)
      const ddt4 = (solve(L, t + h)!.theta4 - 2 * p.theta4 + solve(L, t - h)!.theta4) / (h * h)
      expect(d.w4).toBeCloseTo(w * dt4, 3)
      expect(d.a4).toBeCloseTo(w * w * ddt4, 0)
    }
  })
  it('closes: v_C = v_B + v_CB', () => {
    const p = solve(L, 1)!
    const d = fourBarDiagrams(p.B, p.C, D, 10)
    expect(d.vB[0] + d.vCB[0]).toBeCloseTo(d.vC[0], 9)
    expect(d.vB[1] + d.vCB[1]).toBeCloseTo(d.vC[1], 9)
  })
  it('the instantaneous centre gives the coupler’s velocities by radius', () => {
    const p = solve(L, 1)!
    const d = fourBarDiagrams(p.B, p.C, D, 10)
    const I = instantaneousCentre(p.B, p.C, D)!
    const rB = Math.hypot(p.B[0] - I[0], p.B[1] - I[1])
    const rC = Math.hypot(p.C[0] - I[0], p.C[1] - I[1])
    expect(Math.hypot(...d.vB) / rB).toBeCloseTo(Math.abs(d.w3), 6)
    expect(Math.hypot(...d.vC) / rC).toBeCloseTo(Math.abs(d.w3), 6)
  })
})

describe('turning moment', () => {
  it('a four-stroke averages far below its peak: that is what a flywheel smooths', () => {
    const s = turningStats('four-stroke', 1000)
    expect(s.mean).toBeGreaterThan(0)
    expect(s.mean).toBeLessThan(250)
    expect(s.dE).toBeGreaterThan(0)
    expect(turningPeriod('four-stroke')).toBeCloseTo(4 * Math.PI, 9)
  })
  it('the energy over a full cycle closes', () => {
    const s = turningStats('four-stroke', 1000)
    expect(s.E[s.E.length - 1]).toBeCloseTo(0, 6)
  })
  it('four cylinders firing in turn need far less flywheel for the same peak', () => {
    expect(turningStats('four-cylinder', 1000).dE).toBeLessThan(turningStats('four-stroke', 1000).dE / 4)
  })
  it('a press takes its load in one part of the turn', () => {
    expect(turningMoment('press', 1000, 0.5)).toBeGreaterThan(900)
    expect(turningMoment('press', 1000, 3)).toBeLessThan(30)
  })
})

describe('multi-cylinder balance', () => {
  it('one cylinder: nothing cancels', () => {
    const b = cylinderBalance([0])
    expect(b.primary).toBeCloseTo(1, 9)
    expect(b.secondary).toBeCloseTo(1, 9)
  })
  it('two at 180°: primary cancels, secondary doubles', () => {
    const b = cylinderBalance([0, Math.PI])
    expect(b.primary).toBeCloseTo(0, 9)
    expect(b.secondary).toBeCloseTo(2, 9)
  })
  it('a flat four: primary cancels, secondary is four times one cylinder', () => {
    const b = cylinderBalance([0, Math.PI, Math.PI, 0])
    expect(b.primary).toBeCloseTo(0, 9)
    expect(b.secondary).toBeCloseTo(4, 9)
  })
  it('a straight six cancels both', () => {
    const t = (2 * Math.PI) / 3
    const b = cylinderBalance([0, t, 2 * t, 2 * t, t, 0])
    expect(b.primary).toBeCloseTo(0, 9)
    expect(b.secondary).toBeCloseTo(0, 9)
  })
})

describe('the slider-crank’s diagrams', () => {
  const x = (t: number) => 0.05 * Math.cos(t) + Math.sqrt(0.2 ** 2 - (0.05 * Math.sin(t)) ** 2)
  it('agree with differentiating the slider’s position', () => {
    const h = 1e-5
    const w = 10
    for (const t of [0.4, 1.3, 2.6, 4, 5.4]) {
      const d = sliderCrankDiagrams(0.05, 0.2, t, w)
      expect(d.vC[0]).toBeCloseTo((w * (x(t + h) - x(t - h))) / (2 * h), 4)
      expect(d.aC[0]).toBeCloseTo((w * w * (x(t + h) - 2 * x(t) + x(t - h))) / (h * h), 1)
    }
  })
  it('the slider stops at the dead centres, and the polygon closes', () => {
    expect(sliderCrankDiagrams(0.05, 0.2, 0, 10).vC[0]).toBeCloseTo(0, 9)
    expect(sliderCrankDiagrams(0.05, 0.2, Math.PI, 10).vC[0]).toBeCloseTo(0, 9)
    const d = sliderCrankDiagrams(0.05, 0.2, 1, 10)
    expect(d.vB[1] + d.vCB[1]).toBeCloseTo(0, 9)
  })
  it('at the outer dead centre the acceleration is ω²r(1 + 1/n)', () => {
    expect(Math.abs(sliderCrankDiagrams(0.05, 0.2, 0, 10).aC[0])).toBeCloseTo(100 * 0.05 * 1.25, 6)
  })
})
