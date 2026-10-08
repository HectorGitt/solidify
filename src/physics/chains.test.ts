import { describe, expect, it } from 'vitest'
import {
  PITCH,
  centreForLinks,
  chainLengthPitches,
  chainSpeed,
  chordalSpeed,
  chordalVariation,
  designPower,
  drivenSpeed,
  pitchDiameter,
  speedRatio,
  strandRating,
  strandsNeeded,
} from './chains'

describe('chain selection — AEE503 Module 3', () => {
  it('2 kW, 200 → 60 rpm, moderate shock: SF 1.3 → 2.6 kW; 2.5 kW simplex < 2.6 → duplex 4.25 kW (M3 example, MG17, MG21, T21)', () => {
    const P = designPower(2.0, 1.3)
    expect(P).toBeCloseTo(2.6, 12)
    expect(speedRatio(200, 60)).toBeCloseTo(3.33, 2)
    expect(strandRating(2.5, 2)).toBeCloseTo(4.25, 12)
    expect(strandsNeeded(P, 2.5)).toBe(2)
  })
  it('the driving (200 rpm) sprocket must be the 17-tooth one: 200 × 17/57 = 59.6 rpm (the notes swap driving/driven — errata)', () => {
    expect(drivenSpeed(200, 17, 57)).toBeCloseTo(59.6, 1)
    expect(drivenSpeed(200, 57, 17)).toBeGreaterThan(600) // as printed it would speed up
  })
  it('MG16 alternative: 23/76 teeth, 3.46 kW single strand ≥ 2.6 kW → simplex', () => {
    expect(strandsNeeded(2.6, 3.46)).toBe(1)
    expect(76 / 23).toBeCloseTo(3.3, 1)
  })
  it('11 kW, 970 → 330 rpm, moderate shock: 14.3 kW design; 11.70 kW simplex → duplex 19.89 kW (MG19, T19)', () => {
    const P = designPower(11, 1.3)
    expect(P).toBeCloseTo(14.3, 12)
    expect(speedRatio(970, 330)).toBeCloseTo(2.94, 2)
    expect(strandRating(11.7, 2)).toBeCloseTo(19.89, 2)
    expect(strandsNeeded(P, 11.7)).toBe(2)
    expect(57 / 19).toBeCloseTo(3, 6)
  })
  it('6.5 kW pump, heavy shock: SF 1.5 → 9.75 kW, ratio 2.61, 16/38 teeth (MG15 Q2a)', () => {
    expect(designPower(6.5, 1.5)).toBeCloseTo(9.75, 12)
    expect(speedRatio(1500, 575)).toBeCloseTo(2.61, 2)
  })
  it('returns null when even duplex is not enough', () => {
    expect(strandsNeeded(10, 5)).toBeNull()
  })
})

describe('sprocket geometry and chordal action (beyond notes)', () => {
  const p = PITCH['3/4']
  it('pitch diameter D = p / sin(π/z); 17 T, ¾″ → 103.7 mm', () => {
    expect(pitchDiameter(17, p) * 1000).toBeCloseTo(103.7, 1)
  })
  it('chain speed = zpN/60', () => {
    expect(chainSpeed(17, p, 200)).toBeCloseTo((17 * 0.01905 * 200) / 60, 12)
  })
  it('speed variation 1 − cos(π/z): 17 teeth ≈ 1.7 %, 8 teeth ≈ 7.6 %', () => {
    expect(chordalVariation(17) * 100).toBeCloseTo(1.70, 2)
    expect(chordalVariation(8) * 100).toBeCloseTo(7.61, 2)
    const w = 10
    expect(chordalSpeed(w, 17, p, 0)).toBeCloseTo((w * pitchDiameter(17, p)) / 2, 12)
  })
  it('centreForLinks inverts chainLengthPitches', () => {
    const C = centreForLinks(120, p, 17, 57)
    expect(chainLengthPitches(C, p, 17, 57)).toBeCloseTo(120, 9)
  })
})
