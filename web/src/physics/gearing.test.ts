import { describe, expect, it } from 'vitest'
import {
  centreDistance,
  describeRatio,
  followerSpeed,
  groundSpeedKmh,
  meshSense,
  pitchDiameter,
  planetaryRatio,
  planetSpeed,
  planetsFit,
  ratioCount,
  reductionRatio,
  ringTeeth,
  syncTime,
  synchroRemaining,
  gearTable,
  clutchPedal,
  TYPICAL_PEDAL,
  simulateShift,
  torqueFromPower,
  trainSpeedRatio,
  willis,
} from './gearing'

describe('gear pairs and trains — AEE510 Culpin App. 2', () => {
  it('D·N = d·n: a 60-tooth gear driven by a 20-tooth pinion at 1800 rpm turns at 600 rpm (TOP p3–4)', () => {
    expect(followerSpeed(20, 1800, 60)).toBeCloseTo(600, 9)
  })
  it('train ratio = Π driver teeth / Π follower teeth (TOP p4)', () => {
    expect(trainSpeedRatio([20, 15], [60, 45])).toBeCloseTo((20 / 60) * (15 / 45), 12)
  })
  it('engine > 2000 rpm, rear wheels ≈ 20 rpm in bottom gear → about 100 : 1 overall (TTS p1)', () => {
    expect(reductionRatio(2000, 20)).toBe(100)
  })
  it('MF 2000 gearbox: 4 synchro gears × 2 ranges × 2 speed-shift = 16 forward (TOP p3)', () => {
    expect(ratioCount(4, 2, 2)).toBe(16)
  })
  it('each external mesh reverses rotation; an idler restores it', () => {
    expect(meshSense(1)).toBe(-1)
    expect(meshSense(2)).toBe(1)
  })
})

describe('idler train A–B–C — AEE503 Module 5 (Q17 / E21)', () => {
  // module 6 mm, teeth 35 / 65 / 45, 3 kW at 600 rpm into A
  it('pitch diameters 210 / 390 / 270 mm', () => {
    expect(pitchDiameter(6, 35)).toBe(210)
    expect(pitchDiameter(6, 65)).toBe(390)
    expect(pitchDiameter(6, 45)).toBe(270)
  })
  it('the idler cancels: N_C = 600 × 35/45 = 466.7 rpm', () => {
    const nC = 600 * trainSpeedRatio([35, 65], [65, 45])
    expect(nC).toBeCloseTo(466.7, 1)
  })
  it('T_A = 47.8 N·m and T_C = 61.4 N·m for 3 kW', () => {
    expect(Math.abs(torqueFromPower(3000, 600) - 47.8)).toBeLessThan(0.06) // 47.75, rounded
    expect(torqueFromPower(3000, (600 * 35) / 45)).toBeCloseTo(61.4, 1)
  })
  it('centre distances follow from the module: A–B 300 mm, B–C 330 mm', () => {
    expect(centreDistance(6, 35, 65)).toBe(300)
    expect(centreDistance(6, 65, 45)).toBe(330)
  })
})

describe('planetary set — PT p5–6, Culpin Fig A2.4 (ratios by the Willis equation, beyond the notes)', () => {
  const zs = 30
  const zp = 24
  const zr = ringTeeth(zs, zp)
  it('ring teeth z_r = z_s + 2z_p, and four planets fit when (z_s + z_r)/4 is whole', () => {
    expect(zr).toBe(78)
    expect(planetsFit(zs, zr, 4)).toBe(true)
    expect(planetsFit(zs, zr, 5)).toBe(false)
  })
  it('lock any two members and the whole set turns as one, 1 : 1 (PT p6)', () => {
    expect(planetaryRatio(zs, zr, 'sun', 'carrier', 'locked')).toBe(1)
    const w = willis(zs, zr, { sun: 5, carrier: 5 })
    expect(w.ring).toBeCloseTo(5, 12)
  })
  it('sun in, ring held: carrier turns the same way as the sun but slower (PT p6)', () => {
    const r = planetaryRatio(zs, zr, 'sun', 'carrier', 'held')
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(1)
    expect(r).toBeCloseTo(zs / (zs + zr), 12)
  })
  it('Culpin: casing (ring) held, carrier driving → the follower is speeded up (TOP p2)', () => {
    expect(planetaryRatio(zs, zr, 'carrier', 'sun', 'held')).toBeCloseTo((zs + zr) / zs, 12)
    expect(describeRatio((zs + zr) / zs)).toMatch(/overdrive/)
  })
  it('carrier held: sun drives the ring backwards, ω_r/ω_s = −z_s/z_r', () => {
    expect(planetaryRatio(zs, zr, 'sun', 'ring', 'held')).toBeCloseTo(-zs / zr, 12)
  })
  it('nothing held: neutral (no drive)', () => {
    expect(Number.isNaN(planetaryRatio(zs, zr, 'sun', 'carrier', 'free'))).toBe(true)
  })
  it('planets spin backwards at z_s/z_p when the carrier is held', () => {
    expect(planetSpeed(1, 0, zs, zp)).toBeCloseTo(-zs / zp, 12)
    expect(planetSpeed(3, 3, zs, zp)).toBeCloseTo(3, 12)
  })
})

describe('speeds and synchronisers (standard texts)', () => {
  it('ground speed: 2000 rpm through 100 : 1 on a 0.75 m rolling radius is 5.65 km/h', () => {
    expect(groundSpeedKmh(2000, 1 / 100, 0.75)).toBeCloseTo(5.655, 2)
  })
  it('synchronising time t = JΔω/T', () => {
    expect(syncTime(0.02, -50, 20)).toBeCloseTo(0.05, 12)
  })
})

describe('gear tables, clutch pedal and powershift overlap', () => {
  it('stages in series: 2 speed-shift × 4 gears × 2 ranges = 16 rows, sorted by speed (TOP p3)', () => {
    const rows = gearTable(2000, [
      [{ label: 'L', ratio: 0.8 }, { label: 'H', ratio: 1 }],
      [1, 2, 3, 4].map((g) => ({ label: `${g}`, ratio: g / 5 })),
      [{ label: 'lo', ratio: 0.25 }, { label: 'hi', ratio: 1 }],
    ], 20, 0.635)
    expect(rows).toHaveLength(16)
    for (let i = 1; i < rows.length; i++) expect(rows[i].kmh).toBeGreaterThanOrEqual(rows[i - 1].kmh)
    expect(rows[15].wheelRpm).toBeCloseTo((2000 * 0.8) / 20, 9)
  })
  it('synchroniser leaves no speed difference after t = JΔω/T', () => {
    expect(synchroRemaining(-50, 0.02, 20, syncTime(0.02, -50, 20))).toBeCloseTo(0, 12)
    expect(synchroRemaining(50, 0.02, 20, 0.025)).toBeCloseTo(25, 12)
  })
  it('pedal: the first 18 mm is free play (TTS p3); full travel lifts the plate clear', () => {
    expect(clutchPedal(10).clamp).toBe(1)
    expect(clutchPedal(10).bearingContact).toBe(false)
    expect(clutchPedal(18 + 15).clamp).toBeCloseTo(0.5, 9)
    const full = clutchPedal(150)
    expect(full.clamp).toBe(0)
    expect(full.lift).toBeGreaterThan(TYPICAL_PEDAL.cleanLift)
    expect(full.drag).toBe(0)
  })
  it('too little free play → slip at rest; too much → drag at full travel (TTS p4)', () => {
    expect(clutchPedal(0, { ...TYPICAL_PEDAL, freePlay: 0 }).clamp).toBeLessThan(1)
    expect(clutchPedal(150, { ...TYPICAL_PEDAL, freePlay: 50 }).drag).toBeGreaterThan(0)
  })
  it('overlapping clutches shift without a power interruption; early release leaves a torque hole and engine flare (PT p4)', () => {
    const base = { Te: 300, J: 1.2, wOut: 100, iOff: 1.714, iOn: 1, Cmax: 600, fill: 0.15 }
    const good = simulateShift({ ...base, overlap: 0.075 })
    expect(Math.min(...good.Tout)).toBeGreaterThan(0.6 * base.Te)
    expect(good.wIn[good.wIn.length - 1]).toBeCloseTo(100, 6)
    expect(Number.isFinite(good.tLock)).toBe(true)
    const early = simulateShift({ ...base, overlap: -0.15 })
    expect(Math.min(...early.Tout)).toBeLessThan(0.3 * base.Te)
    expect(Math.max(...early.wIn)).toBeGreaterThan(171.4 + 1)
    expect(early.heat).toBeGreaterThan(good.heat)
  })
})
