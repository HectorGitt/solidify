import { describe, expect, it } from 'vitest'
import { DEFAULTS, STUBS, ptoRatio, ratedEngineRpm, steadySpeeds, type PtoParams } from './model'

const run = (p: Partial<PtoParams>) => steadySpeeds({ ...DEFAULTS, ...p })

describe('PTO types — AEE510 Power Transmission p2–3 and Bell (Tractor Transmission System) p10', () => {
  it('transmission PTO: stops when the clutch is disengaged; runs in neutral with the clutch in', () => {
    expect(Math.abs(run({ type: 'transmission', pedal: 'up' }).pto)).toBeGreaterThan(400)
    expect(run({ type: 'transmission', pedal: 'down' }).pto).toBeCloseTo(0, 6)
    expect(run({ type: 'transmission', pedal: 'half' }).pto).toBeCloseTo(0, 6)
    expect(Math.abs(run({ type: 'transmission', gear: 'N' }).pto)).toBeGreaterThan(400)
  })
  it('live (continuous-running) PTO: first half of the pedal stops the transmission only; full travel stops the PTO', () => {
    const half = run({ type: 'live', pedal: 'half' })
    expect(half.crown).toBeCloseTo(0, 6)
    expect(Math.abs(half.pto)).toBeGreaterThan(400)
    expect(run({ type: 'live', pedal: 'down' }).pto).toBeCloseTo(0, 6)
  })
  it('independent PTO: unaffected by the clutch pedal; its own control engages or stops it on the move', () => {
    expect(Math.abs(run({ type: 'independent', pedal: 'down' }).pto)).toBeGreaterThan(400)
    const off = run({ type: 'independent', lever: false })
    expect(Math.abs(off.pto)).toBe(0) // braked when released (Culpin Fig A2.10)
    expect(Math.abs(off.crown)).toBeGreaterThan(10) // tractor still moving
  })
  it('ground-speed PTO: proportional to travel speed, reverses in reverse, stops with the tractor', () => {
    const f = run({ type: 'ground', gear: 'F' })
    const r = run({ type: 'ground', gear: 'R' })
    expect(Math.sign(f.pto)).toBe(-Math.sign(r.pto))
    expect(f.pto / f.crown).toBeCloseTo(r.pto / r.crown, 9) // same revs per wheel turn either way
    expect(run({ type: 'ground', gear: 'N' }).pto).toBeCloseTo(0, 6)
    expect(run({ type: 'ground', pedal: 'down' }).pto).toBeCloseTo(0, 6)
    // halve engine speed → halve travel and PTO speed together
    const slow = run({ type: 'ground', rpm: 1000 })
    expect(slow.pto / f.pto).toBeCloseTo(0.5, 9)
  })
})

describe('PTO standards — TTS p10', () => {
  it('540 rpm stub: 6 splines, 35 mm; 1000 rpm stub: 21 splines', () => {
    expect(STUBS['540'].splines).toBe(6)
    expect(STUBS['540'].od).toBeCloseTo(0.035, 6)
    expect(STUBS['1000'].splines).toBe(21)
  })
  it('the gear train gives 540 and 1000 rpm at typical rated engine speeds (≈ 2000–2150 rpm)', () => {
    expect(ratedEngineRpm('540')).toBeGreaterThan(1900)
    expect(ratedEngineRpm('540')).toBeLessThan(2100)
    expect(ratedEngineRpm('1000')).toBeGreaterThan(2050)
    expect(ratedEngineRpm('1000')).toBeLessThan(2200)
    const s = run({ type: 'independent', rpm: ratedEngineRpm('540') })
    expect(Math.abs(s.pto)).toBeCloseTo(540, 6)
    expect(ptoRatio('540')).toBeCloseTo(21 / 78, 12)
  })
})
