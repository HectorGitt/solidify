import { describe, expect, it } from 'vitest'
import {
  ALTERNATOR,
  DYNAMO,
  MAGNETO_SPARKS_PER_REV,
  SG_CHARGED,
  advanceTime,
  batteryHours,
  batteryVoltage,
  breakerLobes,
  cellsFor,
  chargeCurrent,
  coilEnergy,
  coilSecondaryVoltage,
  cutInRpm,
  dwellTime,
  primaryCurrent,
  sparksPerMinute,
  starterRatio,
} from './electrical'

describe('battery — TB p31', () => {
  it('2 V per cell: a 12 V tractor battery has 6 cells, a 24 V diesel set 12', () => {
    expect(batteryVoltage(6)).toBe(12)
    expect(cellsFor(12)).toBe(6)
    expect(cellsFor(24)).toBe(12)
  })
  it('100 Ah supplies 5 A for 20 h, or 10 A for 10 h', () => {
    expect(batteryHours(100, 5)).toBe(20)
    expect(batteryHours(100, 10)).toBe(10)
  })
  it('fully charged electrolyte SG 1.27', () => {
    expect(SG_CHARGED).toBe(1.27)
  })
})

describe('coil ignition — 509 Lecture 4, TB ch.5', () => {
  it('breaker cam: 4 corners for a 4-cylinder engine, a hexagon for 6', () => {
    expect(breakerLobes(4)).toBe(4)
    expect(breakerLobes(6)).toBe(6)
  })
  it('primary 200–300 turns, secondary ≈ 21 000 turns: step-up of 70–105 ×', () => {
    expect(coilSecondaryVoltage(1, 300, 21000)).toBeCloseTo(70, 6)
    expect(coilSecondaryVoltage(1, 200, 21000)).toBeCloseTo(105, 6)
    // a ~200 V primary kick on opening gives the 10–15 kV+ a spark needs (TB p27)
    const v = coilSecondaryVoltage(200, 250, 21000)
    expect(v).toBeGreaterThan(15e3)
  })
  it('a 4-cylinder four-stroke at 1500 rpm needs 3000 sparks/min', () => {
    expect(sparksPerMinute(1500, 4)).toBe(3000)
  })
  it('dwell time shrinks with speed, so the coil current has less time to build (beyond notes)', () => {
    const tau = 0.004 / 3
    const iLow = primaryCurrent(dwellTime(800, 4, 0.6), 12, 3, 0.004)
    const iHigh = primaryCurrent(dwellTime(4000, 4, 0.6), 12, 3, 0.004)
    expect(iLow).toBeGreaterThan(iHigh)
    expect(primaryCurrent(10 * tau, 12, 3, 0.004)).toBeCloseTo(4, 2)
    expect(coilEnergy(0.004, 4)).toBeCloseTo(0.032, 6)
  })
  it('spark at 25° BTDC (TB p30) leads TDC by 2.78 ms at 1500 rpm', () => {
    expect(advanceTime(25, 1500) * 1000).toBeCloseTo(2.778, 3)
  })
  it('magneto field reverses every half revolution (TB p28)', () => {
    expect(MAGNETO_SPARKS_PER_REV).toBe(2)
  })
})

describe('starting and charging (beyond notes)', () => {
  it('a 9-tooth pinion on a 108-tooth ring gear gives 12 : 1', () => {
    expect(starterRatio(108, 9)).toBe(12)
  })
  it('no charge below cut-in; the alternator cuts in at a lower speed than the dynamo (TB p32)', () => {
    expect(chargeCurrent(cutInRpm(12.6, DYNAMO) - 10, 12.6, DYNAMO)).toBe(0)
    expect(cutInRpm(12.6, ALTERNATOR)).toBeLessThan(cutInRpm(12.6, DYNAMO))
    expect(chargeCurrent(1500, 12.6, ALTERNATOR)).toBeGreaterThan(chargeCurrent(1500, 12.6, DYNAMO))
  })
})
