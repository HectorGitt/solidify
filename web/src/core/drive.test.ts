import { describe, expect, it } from 'vitest'
import {
  DriveGraph,
  beltDrive,
  brake,
  coupling,
  differential,
  gearMesh,
  hookeAcceleration,
  hookeAngle,
  hookeJoint,
  hookeSpeedRatio,
  planetary,
} from './drive'

const rpm = (w: number) => (w * 60) / (2 * Math.PI)
const rad = (n: number) => (n * 2 * Math.PI) / 60

describe('DriveGraph', () => {
  it('gear train ratio = Π driver teeth / Π follower teeth (Culpin p4)', () => {
    const g = new DriveGraph()
    ;['a', 'b', 'c'].forEach((id) => g.body(id))
    g.add(gearMesh('ab', 'a', 20, 'b', 60))
    g.add(gearMesh('bc', 'b', 15, 'c', 45))
    g.drive('a', rad(1800))
    g.step(0.01)
    expect(rpm(g.get('c').omega)).toBeCloseTo(1800 * (20 / 60) * (15 / 45), 6)
    expect(Math.sign(g.get('b').omega)).toBe(-1)
  })

  it('open belt keeps direction, crossed belt reverses it', () => {
    const g = new DriveGraph()
    ;['m', 'o', 'x'].forEach((id) => g.body(id))
    g.add(beltDrive('open', 'm', 0.1, 'o', 0.3))
    g.add(beltDrive('cross', 'm', 0.1, 'x', 0.2, true))
    g.drive('m', 30)
    g.step(0.01)
    expect(g.get('o').omega).toBeCloseTo(10, 9)
    expect(g.get('x').omega).toBeCloseTo(-15, 9)
  })

  it('released clutch: driven shaft coasts down instead of locking', () => {
    const g = new DriveGraph()
    g.body('engine')
    g.body('gearbox', 1.0)
    let engaged = true
    g.add(coupling('clutch', 'engine', 'gearbox', () => engaged))
    g.drive('engine', 100)
    g.step(0.01)
    expect(g.get('gearbox').omega).toBeCloseTo(100, 9)
    engaged = false
    g.step(0.5)
    expect(g.coasting.has('gearbox')).toBe(true)
    expect(g.get('gearbox').omega).toBeLessThan(100)
    expect(g.get('gearbox').omega).toBeGreaterThan(0)
  })

  it('differential: one wheel held → other turns at twice case speed (AEE510 TTS p8)', () => {
    const g = new DriveGraph()
    ;['case', 'L', 'R'].forEach((id) => g.body(id))
    g.add(differential('diff', 'case', 'L', 'R'))
    g.add(brake('holdL', 'L', () => true))
    g.drive('case', 10)
    g.step(0.01)
    expect(g.get('R').omega).toBeCloseTo(20, 9)
  })

  it('planetary: ring held → carrier = sun·zs/(zs+zr), same sense; lock two → 1:1 (PT p5–6)', () => {
    const zs = 30
    const zr = 78
    const g = new DriveGraph()
    ;['sun', 'ring', 'carrier'].forEach((id) => g.body(id))
    g.add(planetary('ps', 'sun', zs, 'ring', zr, 'carrier'))
    let ringHeld = true
    let locked = false
    g.add(brake('ringBrake', 'ring', () => ringHeld))
    g.add(coupling('lockup', 'sun', 'carrier', () => locked))
    g.drive('sun', 100)
    g.step(0.01)
    expect(g.get('carrier').omega).toBeCloseTo((100 * zs) / (zs + zr), 9)
    ringHeld = false
    locked = true
    g.step(0.01)
    expect(g.get('carrier').omega).toBeCloseTo(100, 9)
    expect(g.get('ring').omega).toBeCloseTo(100, 9)
  })
})

describe("Hooke's joint — AEE502 marking guides", () => {
  const beta = (20 * Math.PI) / 180
  it('δ = 20°, 1000 rpm: 1060 rpm at θ=10°, 940 rpm at θ=90°', () => {
    const table = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((d) => Math.round(1000 * hookeSpeedRatio((d * Math.PI) / 180, beta)))
    expect(table).toEqual([1060, 1048, 1030, 1009, 987, 968, 953, 943, 940])
  })
  it('max/min = ω/cosδ and ω·cosδ (939.7 … 1064 rpm)', () => {
    expect(1000 * hookeSpeedRatio(0, beta)).toBeCloseTo(1064.2, 1)
    expect(1000 * hookeSpeedRatio(Math.PI / 2, beta)).toBeCloseTo(939.7, 1)
  })
  it('δ = 45°: max √2, min 1/√2 (Dunn)', () => {
    const b = Math.PI / 4
    expect(hookeSpeedRatio(0, b)).toBeCloseTo(Math.SQRT2, 9)
    expect(hookeSpeedRatio(Math.PI / 2, b)).toBeCloseTo(1 / Math.SQRT2, 9)
  })
  it('output acceleration at θ = 45°, 1000 rpm ≈ −1365 rad/s² (notes, within rounding)', () => {
    const a = hookeAcceleration(Math.PI / 4, beta, rad(1000))
    expect(Math.abs(a + 1365) / 1365).toBeLessThan(0.01)
  })
  it('angle map is continuous over many turns and averages 1:1', () => {
    let prev = hookeAngle(0, beta)
    for (let i = 1; i <= 2000; i++) {
      const th = (i / 2000) * 6 * Math.PI
      const out = hookeAngle(th, beta)
      expect(out - prev).toBeGreaterThan(0)
      expect(out - prev).toBeLessThan(0.02)
      prev = out
    }
    expect(prev).toBeCloseTo(6 * Math.PI, 9)
  })
  it('graph angle map reproduces the speed ratio', () => {
    const g = new DriveGraph()
    g.body('in')
    g.body('out')
    g.addMap(hookeJoint('uj', 'in', 'out', () => beta))
    g.drive('in', 10)
    const dt = 1e-4
    for (let i = 0; i < 100; i++) g.step(dt)
    expect(g.get('out').omega / 10).toBeCloseTo(hookeSpeedRatio(g.get('in').theta, beta), 9)
    expect(g.get('out').theta).toBeCloseTo(hookeAngle(g.get('in').theta, beta), 9)
  })
})
