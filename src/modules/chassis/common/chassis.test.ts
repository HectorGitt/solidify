import { describe, expect, it } from 'vitest'
import {
  FARMLAND,
  cgFromFrontWeight,
  cgFromRaisedFront,
  cgHeightFromRaise,
  dynamicLoads,
  hitchConditionLimits,
  hitchLoads,
  instabilityPsi,
  liftPull,
  maxSlopes,
  pullForPsi,
  raiseAngle,
  raisedFrontReading,
  raisedSpacing,
  simpleTransfer,
  staticFront,
  staticOverturnTan,
  tippingDrawbarHeight,
  walkingHandleForce,
  weightTransferHitchLoads,
  type Chassis,
  type SoilForce,
} from '@/physics/chassis'

const deg = Math.PI / 180
/** Farmland with W rounded to 27.9 kN as in Macmillan's answers. */
const F279: Chassis = { ...FARMLAND, W: 27900 }

describe('AEE510 2022/23 exam Q2c (weight transfer, AEE510 Power Transmission inventory §2)', () => {
  it('CG 657.8 mm ahead of the rear axle from Rf = 9 kN, W = 28.5 kN, L = 2083 mm', () => {
    expect(cgFromFrontWeight(9, 28.5, 2083)).toBeCloseTo(657.8, 1)
  })
  it('ΔW = 12 × 580 / 2083 = 3.34 kN; front 5.66 kN, rear 22.84 kN', () => {
    expect(simpleTransfer(12, 580, 2083)).toBeCloseTo(3.34, 2)
    const exam: Chassis = { W: 28.5e3, x: 2.083, xr: 0.6578, yg: 0.1, r: 0.6, xd: 0.6, yd: 0.58 }
    const d = dynamicLoads(exam, 12e3, 0, 0)
    expect(d.Vf / 1000).toBeCloseTo(5.66, 2)
    expect(d.Vr / 1000).toBeCloseTo(22.84, 2)
  })
})

describe('Macmillan Ch 6 with the Farmland tractor', () => {
  it('static loads Wf 8.0 kN, Wr 19.9 kN (App. II)', () => {
    expect(staticFront(F279) / 1000).toBeCloseTo(8.01, 1)
    expect((F279.W - staticFront(F279)) / 1000).toBeCloseTo(19.9, 1)
  })
  it('Problem 6.6: Vf = 5.92 kN on a 10° slope (Eq 6.4, no pull)', () => {
    expect(dynamicLoads(F279, 0, 0, 10 * deg).Vf / 1000).toBeCloseTo(5.92, 2)
  })
  it('Problem 6.8: 15° slope, θ = 10°, ψ′ = 0.8 → P = 17.1 kN, Vr = 30.1 kN (Eqs 6.5, 6.8)', () => {
    const P = pullForPsi(F279, 0.8, 10 * deg, 15 * deg, 0)
    expect(P / 1000).toBeCloseTo(17.1, 1)
    expect(dynamicLoads(F279, P, 10 * deg, 15 * deg).Vr / 1000).toBeCloseTo(30.1, 1)
  })
  it('liftPull makes Vf exactly zero', () => {
    const P = liftPull(FARMLAND, 5 * deg, 4 * deg)
    expect(dynamicLoads(FARMLAND, P, 5 * deg, 4 * deg).Vf).toBeCloseTo(0, 6)
  })
  it('Eqs 6.4 + 6.5 balance vertically: Vf + Vr = W cosα + P sinθ', () => {
    const d = dynamicLoads(FARMLAND, 9000, 12 * deg, 8 * deg)
    expect(d.Vf + d.Vr).toBeCloseTo(FARMLAND.W * Math.cos(8 * deg) + 9000 * Math.sin(12 * deg), 6)
  })
})

describe('CG height by raising the front (Eqs 6.1–6.3)', () => {
  it('recovers yg = 0.13 m from simulated scale readings', () => {
    const rr = 0.635
    const rf = 0.39
    const yLift = 1.3
    const xpp = raisedSpacing(rr, rf, FARMLAND.x, yLift)
    const beta = raiseAngle(rr, rf, FARMLAND.x, yLift, xpp)
    const Wf2 = raisedFrontReading(FARMLAND, beta, xpp)
    const xr = cgFromFrontWeight(staticFront(FARMLAND), FARMLAND.W, FARMLAND.x)
    expect(xr).toBeCloseTo(0.54, 6)
    const xr2 = cgFromRaisedFront(Wf2, FARMLAND.W, xpp)
    expect(cgHeightFromRaise(xr, xr2, beta)).toBeCloseTo(0.13, 6)
  })
})

describe('Slopes and impending instability', () => {
  it('tanαs = xr/(r + yg) = 0.706 and h = y′/(r + yg) = 0.59 for the Farmland tractor', () => {
    expect(staticOverturnTan(FARMLAND)).toBeCloseTo(0.706, 3)
    expect(FARMLAND.yd / (FARMLAND.r + FARMLAND.yg)).toBeCloseTo(0.588, 3)
  })
  it('Eq 6.35 worked case at tanα = 0.3, tanαs = 0.6: ψ′ = 0.73 (h 0.7) and 0.675 (h 0.8)', () => {
    expect(instabilityPsi(0.3, 0.6, 0.7)).toBeCloseTo(0.729, 3)
    expect(instabilityPsi(0.3, 0.6, 0.8)).toBeCloseTo(0.675, 3)
  })
  it('Problem 6.16: tipping drawbar height 0.85 m (A 0.076 m², c 2 kPa, φ 32°)', () => {
    expect(tippingDrawbarHeight(FARMLAND.W, 0.54, 0.076, 2000, 32 * deg)).toBeCloseTo(0.857, 2)
  })
  it('Eqs 6.9–6.10: the max uphill slope makes Eq 6.8 give exactly ψ′ with P = 0', () => {
    const { up, down } = maxSlopes(FARMLAND, 0.6, 0.05)
    // uphill with no pull: ψ′ = (W sinα + ρ W cosα)/Vr
    const Vr = dynamicLoads(FARMLAND, 0, 0, up).Vr
    expect((FARMLAND.W * Math.sin(up) + 0.05 * FARMLAND.W * Math.cos(up)) / Vr).toBeCloseTo(0.6, 6)
    // downhill, braking on the rear wheels: ψ′ = (W sinα − ρW cosα)/(Wr cosα − W sinα (r+yg)/x)
    const Wr = FARMLAND.W - staticFront(FARMLAND)
    const VrD = Wr * Math.cos(down) - (FARMLAND.W * Math.sin(down) * (FARMLAND.r + FARMLAND.yg)) / FARMLAND.x
    expect((FARMLAND.W * Math.sin(down) - 0.05 * FARMLAND.W * Math.cos(down)) / VrD).toBeCloseTo(0.6, 6)
  })
})

describe('Hitch comparison (Eqs 6.11–6.21, 6.30–6.31)', () => {
  const s: SoilForce = { S: 10000, theta: 20 * deg, a: 1.6, b: 0.9, z: 0.15 }
  it('Eq 6.17/6.20 limits agree with the load equations', () => {
    const lim = hitchConditionLimits(FARMLAND, s)
    const m = hitchLoads(FARMLAND, s, 'mounted')
    const t = hitchLoads(FARMLAND, s, 'trailed')
    const semi = hitchLoads(FARMLAND, s, 'semi')
    expect(m.gainRear > 0).toBe(Math.tan(s.theta) > lim.mountedRearGains)
    expect(m.lossFront > 0).toBe(Math.tan(s.theta) > lim.mountedFrontLoses)
    expect(m.gainRear > t.gainRear).toBe(Math.tan(s.theta) > lim.mountedOverTrailed)
    expect(m.gainRear > semi.gainRear).toBe(Math.tan(s.theta) > lim.mountedOverSemi)
  })
  it('weight-transfer hitch: axle loads add up to W + T + P·y′/a + F·c/a', () => {
    const h = { Wt: 6000, a: 2.5, b: 1.5, P: 8000, F: 3000, c: 0.4 }
    const r = weightTransferHitchLoads(FARMLAND, h)
    expect(r.T).toBeCloseTo(2400, 6)
    expect(r.Vf + r.Vr).toBeCloseTo(FARMLAND.W + r.T + (h.P * FARMLAND.yd) / h.a + (h.F * h.c) / h.a, 6)
  })
  it('walking tractor (Eq 6.22): level, no pull → U0 = W·xr/xh', () => {
    expect(walkingHandleForce(2000, 0.2, 0.3, 0.1, 1.2).U0).toBeCloseTo(333.33, 2)
  })
})
