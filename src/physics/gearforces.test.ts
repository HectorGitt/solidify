import { describe, expect, it } from 'vitest'
import {
  bevelForces,
  bevelMeanRadius,
  centreDistance,
  circularPitch,
  gearModule,
  helicalForces,
  idlerTrain,
  pinionConeAngle,
  spurCircles,
  spurForces,
  torqueFromPower,
} from './gearforces'

const rad = (d: number) => (d * Math.PI) / 180

describe('gear nomenclature — AEE503 Module 5', () => {
  it('P_c/m = π', () => {
    expect(circularPitch(0.25, 50) / gearModule(0.25, 50)).toBeCloseTo(Math.PI, 12)
  })
  it('idler train module 6, 35/65/45 teeth → 210/390/270 mm (MG17, MG21 Q2c)', () => {
    expect([35, 65, 45].map((z) => z * 6)).toEqual([210, 390, 270])
    expect(centreDistance(0.006, 35, 65)).toBeCloseTo(0.3, 12)
  })
  it('standard circles: addendum r + m, dedendum r − 1.25m (beyond notes)', () => {
    const c = spurCircles(20, 0.005, rad(20))
    expect(c.pitch).toBeCloseTo(0.05, 12)
    expect(c.addendum).toBeCloseTo(0.055, 12)
    expect(c.dedendum).toBeCloseTo(0.04375, 12)
  })
})

describe('gear forces — AEE503 Module 5', () => {
  it('spur: 200 N·m on a 100 mm pinion, 20° → F_t = 4000 N, F_r = 1456 N (M5 Example 1, MG19 Q3b)', () => {
    const f = spurForces(200, 0.05, rad(20))
    expect(f.Ft).toBeCloseTo(4000, 6)
    expect(f.Fr).toBeCloseTo(1456, 0)
  })
  it('helical: 200 N·m, 250 mm, φ = 27°, α = 30° → F_t = 1600, F_r = 815, F_a = 924 N (MG16 Q3b, MG19 Q3c; guide prints 928)', () => {
    const f = helicalForces(200, 0.125, rad(27), rad(30))
    expect(f.Ft).toBeCloseTo(1600, 6)
    expect(f.Fr).toBeCloseTo(815, 0)
    expect(f.Fa).toBeCloseTo(923.8, 1)
    expect(helicalForces(200, 0.125, rad(20), rad(30)).Fr).toBeCloseTo(582, 0)
  })
  it('helical with φ_n in the normal plane: F_r = F_t tan φ_n / cos α', () => {
    const f = helicalForces(200, 0.125, rad(20), rad(30), 'normal')
    expect(f.Fr).toBeCloseTo((1600 * Math.tan(rad(20))) / Math.cos(rad(30)), 9)
  })
  it('bevel: ratio 4/3, 150 mm pinion, 50 mm face, 14.5°, 6 kW at 240 rpm → F_t = 3983, F_p = 618, F_g = 824 N (MG15 Q3c)', () => {
    const beta = pinionConeAngle(0.075, 0.1)
    expect(Math.sin(beta)).toBeCloseTo(0.6, 12)
    const rm = bevelMeanRadius(0.075, 0.05, beta)
    expect(rm).toBeCloseTo(0.06, 12)
    const Mt = torqueFromPower(6000, 240)
    expect(Mt).toBeCloseTo(239, 0)
    const f = bevelForces(Mt, rm, rad(14.5), beta)
    expect(f.Ft).toBeCloseTo(3979, 0) // guide 3983 (rounds M_t to 239 first)
    expect(f.Fp).toBeCloseTo(618, -1)
    expect(f.Fg).toBeCloseTo(824, -1)
    // with the guide's rounded torque the printed values come out exactly
    const g = bevelForces(239, 0.06, rad(14.5), beta)
    expect(g.Ft).toBeCloseTo(3983, 0)
    expect(g.Fp).toBeCloseTo(618, 0)
    expect(g.Fg).toBeCloseTo(824, 0)
  })
  it('bevel: M_t = 50 N·m at r_m = 50 mm, 20°, sin β = 30/67 → F_p = 163 N (MG16 Q3c)', () => {
    const f = bevelForces(50, 0.05, rad(20), Math.asin(30 / 67))
    expect(f.Fp).toBeCloseTo(162.97, 1)
  })
  it('idler train: 3 kW at 600 rpm → T_A = 47.8, T_C = 61.4 N·m, N_C = 466.7 rpm; tooth load F_t = 455 N, F_r = 166 N (guide: 434 N)', () => {
    const t = idlerTrain(3000, 600, 35, 65, 45)
    expect(t.TA).toBeCloseTo(47.75, 2)
    expect(t.TC).toBeCloseTo(61.4, 1)
    expect(t.rpmC).toBeCloseTo(466.67, 2)
    const f = spurForces(t.TA, 0.105, rad(20))
    expect(f.Ft).toBeCloseTo(455, 0)
    expect(f.Fr).toBeCloseTo(166, 0)
  })
})
