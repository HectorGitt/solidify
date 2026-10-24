import { describe, expect, it } from 'vitest'
import { ANTHRO, CONTROLS, DEFAULTS, NOISE, addLevels, dueAt, headroom, noiseAtEar, oshaHours, pressureFor, spl } from './model'

describe('Human Engineering in tractor design (AEE510) — noise', () => {
  it('HE p6: OSHA 90 dBA for 8 h … 115 dBA for ¼ h', () => {
    expect(oshaHours(90)).toBeCloseTo(8, 12)
    expect(oshaHours(115)).toBeCloseTo(0.25, 12)
  })
  it('HE p8–9: two 80 dB sources make 83 dB; +6 dB ≈ doubles the pressure', () => {
    expect(addLevels(80, 80)).toBeCloseTo(83.01, 2)
    expect(pressureFor(86) / pressureFor(80)).toBeCloseTo(2, 0)
    expect(spl(2e-5)).toBeCloseTo(0, 12)
  })
  it('HE p5, p22: 96 dB(A) open allows ≈ 3.5 h; 88 dB(A) in a cab is inside the 8 h limit', () => {
    expect(noiseAtEar({ ...DEFAULTS, station: 'open' }).allowed).toBeCloseTo(3.48, 2)
    expect(noiseAtEar({ ...DEFAULTS, station: 'cab' }).dose).toBeLessThan(1)
    expect(NOISE).toEqual({ open: 96, cab: 88, target: 80 })
  })
})

describe('Human Engineering — Table 10.6 and the 185 cm cab', () => {
  it('percentiles 162/173/185 cm, sitting 84/91/97 cm, 58/75/98 kg', () => {
    expect([ANTHRO[5].height, ANTHRO[50].height, ANTHRO[95].height]).toEqual([1.62, 1.73, 1.85])
    expect([ANTHRO[5].sitting, ANTHRO[50].sitting, ANTHRO[95].sitting]).toEqual([0.84, 0.91, 0.97])
    expect([ANTHRO[5].mass, ANTHRO[50].mass, ANTHRO[95].mass]).toEqual([58, 75, 98])
  })
  it('the 95th-percentile operator has headroom under the 185 cm cab', () => expect(headroom(95, 'cab').clearance).toBeGreaterThan(0.05))
  it('21 controls, clutch on the left foot', () => {
    expect(CONTROLS).toHaveLength(21)
    expect(CONTROLS.find((c) => c.name === 'Clutch pedal')!.limb).toBe('left foot')
  })
})

describe('Tractor Maintenance p1–2 — intervals', () => {
  it('a 250 h service includes the 10 h and 50 h checks; 600 h does not repeat the 250 h list', () => {
    const at250 = dueAt(250).map((s) => s.interval)
    expect(new Set(at250)).toEqual(new Set([10, 50, 250]))
    expect(dueAt(600).some((s) => s.interval === 250)).toBe(false)
  })
})
