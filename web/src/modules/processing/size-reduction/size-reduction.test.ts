import { describe, expect, it } from 'vitest'
import { averageSizeMm, scalePower } from '@/physics/processing'
import { analyseEnergy, analyseSieves, DEFAULTS } from './model'

describe('Size reduction module tests — RED, PQ, Fellows Ch 4', () => {
  it('RED worked example sieve analysis: FM = 3.12, D ≈ 0.357 mm, UI = 1:6:3', () => {
    const redPct = [1.0, 2.5, 7.0, 24.0, 35.5, 22.5, 7.5, 0]
    const res = analyseSieves(redPct)
    expect(res.FM).toBeCloseTo(3.12, 4)
    expect(res.averageD).toBeCloseTo(0.357, 3)
    expect(res.UI.ratio).toEqual([1, 6, 3])
  })

  it('PQ p1 Q3c burr mill Setting 1 (250 g sample): FM = 2.93, D = 0.337 mm, UI = 1:5:4', () => {
    const massesG = [0, 6.8, 16.5, 40.1, 86.2, 91.0, 7.3, 2.1]
    const res = analyseSieves(massesG)
    expect(res.totalMassG).toBeCloseTo(250, 1)
    expect(res.FM).toBeCloseTo(2.93, 2)
    expect(res.averageD).toBeCloseTo(0.337, 2)
    expect(averageSizeMm(Number(res.FM.toFixed(2)))).toBeCloseTo(0.337, 3)
    expect(res.UI.ratio).toEqual([1, 5, 4])
  })

  it('PQ p1 Q3c burr mill Setting 2 (narrower gap, 250 g sample): FM = 2.71, D = 0.314 mm, UI = 1:4:5', () => {
    const massesG = [0, 5.4, 13.5, 38.1, 70.8, 101.6, 9.2, 11.4]
    const res = analyseSieves(massesG)
    expect(res.totalMassG).toBeCloseTo(250, 1)
    expect(res.FM).toBeCloseTo(2.71, 2)
    expect(res.averageD).toBeCloseTo(0.314, 3)
    expect(res.UI.ratio).toEqual([1, 4, 5])
  })

  it('PQ p1 Q5b power scaling from Setting 1 (6.5 kW) to Setting 2: Rittinger ≈ 7.0 kW, Bond ≈ 6.8 kW', () => {
    const pRittinger = scalePower('rittinger', 6.5, 4.3, 0.337, 0.314)
    const pBond = scalePower('bond', 6.5, 4.3, 0.337, 0.314)
    expect(pRittinger).toBeCloseTo(7.02, 1)
    expect(pBond).toBeCloseTo(6.82, 1)
  })

  it('Fellows Sample 4.1: 6 mm -> 0.0012 mm on 7457 W motor, target 0.0008 mm requires ~11.19 kW (motor inadequate)', () => {
    const neededW = scalePower('rittinger', 7457, 6.0, 0.0012, 0.0008)
    expect(neededW / 1000).toBeCloseTo(11.19, 1)
  })

  it('PQ p6 Q3c: 4.22 mm -> 0.4 mm on 0.5 hp (372.85 W); 0.004 mm needs ~1.10 kW (Kick) and ~41.2 kW (Rittinger)', () => {
    const pKick = scalePower('kick', 372.85, 4.22, 0.4, 0.004)
    const pRittinger = scalePower('rittinger', 372.85, 4.22, 0.4, 0.004)
    expect(pKick / 1000).toBeCloseTo(1.10, 2)
    expect(pRittinger / 1000).toBeCloseTo(41.15, 1)
  })

  it('Energy analysis helper correctly calculates reduction ratio and power', () => {
    const energy = analyseEnergy(DEFAULTS)
    expect(energy.RR).toBeCloseTo(4.3 / 0.337, 2)
    expect(energy.E_kick).toBeGreaterThan(0)
    expect(energy.E_rittinger).toBeGreaterThan(0)
    expect(energy.E_bond).toBeGreaterThan(0)
    expect(energy.powerRequiredKw).toBeGreaterThan(0)
  })
})
