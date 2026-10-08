import { describe, expect, it } from 'vitest'
import {
  CHAIN_LIMIT,
  CLEARING_1819,
  MANUAL_GUIDE,
  SANDEL,
  THRESH_REF,
  acresFromHa,
  chainingSuitable,
  clearingCost,
  combineCapacity,
  cylinderPeripheralSpeed,
  elevatorRatio,
  leverAdvantage,
  lossPercent,
  machineFeed,
  recovered,
  soilLifted,
  stemsPerHa,
  stripAreaHa,
  threshing,
  threshSeverity,
} from './harvest'

describe('combine capacity — AEE501 2019/20 Q (SANDEL: 10,000 t, 75 % maize, 85 % of 600 h, 15 t/ha, 5.85 of 6 m)', () => {
  const c = combineCapacity(SANDEL)
  it('hours worked = 0.85 × 600 = 510 h', () => expect(c.hours).toBeCloseTo(510, 6))
  it('commodity throughput = 7500 t / 510 h = 14.71 t/h', () => expect(c.commodity).toBeCloseTo(14.706, 2))
  it('total throughput = 10,000 t / 510 h = 19.61 t/h', () => expect(c.total).toBeCloseTo(19.608, 2))
  it('area = 7500 t ÷ 15 t/ha = 500 ha', () => expect(c.area).toBeCloseTo(500, 6))
  it('effective area capacity = 500 ha / 510 h = 0.980 ha/h', () => expect(c.effectiveArea).toBeCloseTo(0.9804, 3))
  it('theoretical area capacity = 0.980 × 6/5.85 = 1.006 ha/h', () => expect(c.theoreticalArea).toBeCloseTo(1.0055, 3))
  it('implied speed S = 10·Ce/We = 1.68 km/h; width efficiency 97.5 %', () => {
    expect(c.speedKmh).toBeCloseTo(1.676, 2)
    expect(c.widthEfficiency).toBeCloseTo(0.975, 6)
  })
  it('consistency: area capacity × total material per ha (20 t/ha) = total throughput', () => {
    expect(c.totalPerHa).toBeCloseTo(20, 6)
    expect(c.effectiveArea * c.totalPerHa).toBeCloseTo(c.total, 6)
    const f = machineFeed(SANDEL.effectiveWidth, c.speedKmh, SANDEL.yieldPerHa, SANDEL.productFraction)
    expect(f.totalRate).toBeCloseTo(c.total, 6)
    expect(f.grainRate).toBeCloseTo(c.commodity, 6)
  })
})

describe('threshing teaching model — directions of Table 19.1 / §18.5 (AGRICULTURAL MACHINERIES)', () => {
  const base = { speed: THRESH_REF.speed, clearance: THRESH_REF.clearance, fan: 1, load: 1 }
  const ok = threshing(base)
  it('at the reference setting all losses are small (< 2 %)', () => {
    expect(ok.totalLoss).toBeLessThan(2)
    expect(ok.cracked).toBeLessThan(1)
    expect(threshSeverity(base.speed, base.clearance)).toBeCloseTo(1, 9)
  })
  it('speed too high or clearance too small → cracked grain', () => {
    expect(threshing({ ...base, speed: 40 }).cracked).toBeGreaterThan(3 * ok.cracked)
    expect(threshing({ ...base, clearance: 5 }).cracked).toBeGreaterThan(3 * ok.cracked)
  })
  it('the reverse → unthreshed heads', () => {
    expect(threshing({ ...base, speed: 16 }).unthreshed).toBeGreaterThan(3 * ok.unthreshed)
    expect(threshing({ ...base, clearance: 30 }).unthreshed).toBeGreaterThan(2 * ok.unthreshed)
  })
  it('low fan → unclean grain; high fan → grain blown out', () => {
    expect(threshing({ ...base, fan: 0.5 }).dockage).toBeGreaterThan(3 * ok.dockage)
    expect(threshing({ ...base, fan: 1.6 }).shoe).toBeGreaterThan(3 * ok.shoe)
  })
  it('overloading carries grain over the walkers', () => expect(threshing({ ...base, load: 1.5 }).walker).toBeGreaterThan(2 * ok.walker))
  it('rasp-bar peripheral speed v = πDN/60: Ø0.6 m at 900 rpm = 28.3 m/s (beyond notes)', () => expect(cylinderPeripheralSpeed(0.6, 900)).toBeCloseTo(28.27, 2))
  it('loss % of the crop available', () => {
    const l = lossPercent({ preHarvest: 50, header: 100, machine: 150, yield: 4700 })
    expect(l.available).toBe(5000)
    expect(l.total).toBeCloseTo(6, 9)
  })
})

describe('root crops — AGRICULTURAL MACHINERIES §20', () => {
  it('cassava lifter: about 400 N gives about 1500 N → advantage 3.75', () => expect(leverAdvantage(1500, 400)).toBeCloseTo(3.75, 9))
  it('digger-elevator recovers 85 % (manual about 90 %)', () => {
    expect(recovered(20, 0.85)).toBeCloseTo(17, 9)
    expect(recovered(20, 0.9)).toBeCloseTo(18, 9)
  })
  it('elevator faster than forward speed (ratio > 1)', () => expect(elevatorRatio(1.5, 1)).toBeGreaterThan(1))
  it('soil lifted = W·d·S: 1 m × 0.3 m at 3 km/h = 900 m³/h (beyond notes)', () => expect(soilLifted(1, 0.3, 3)).toBeCloseTo(900, 9))
})

describe('land clearing — AGRICULTURAL MACHINERIES §11 and the 2018/19 marking guide', () => {
  it('tree-count strip 100 m × (5 m each side) = 0.1 ha, so stems/ha = 10 × count', () => {
    expect(stripAreaHa()).toBeCloseTo(0.1, 12)
    expect(stemsPerHa(180)).toBeCloseTo(1800, 9)
  })
  it('chaining works for trees ≤ 45 cm and ≤ 2500 stems/ha', () => {
    expect(chainingSuitable(40, 2000).ok).toBe(true)
    expect(chainingSuitable(50, 2000).sizeOk).toBe(false)
    expect(chainingSuitable(40, 3000).densityOk).toBe(false)
    expect(CHAIN_LIMIT).toEqual({ diameterCm: 45, stemsPerHa: 2500 })
  })
  it('2018/19 Q2c dozer: 100/15 × ₦150,000 = ₦1,000,000 in 6.7 ≈ 7 days', () => {
    const d = clearingCost(100, CLEARING_1819.dozer)
    expect(d.cost).toBeCloseTo(1_000_000, 3)
    expect(d.days).toBeCloseTo(6.667, 2)
    expect(d.daysWhole).toBe(7)
  })
  it('2018/19 Q2c bale loader: 100/5 × ₦50,000 = ₦1,000,000 in 20 days', () => {
    const b = clearingCost(100, CLEARING_1819.baleLoader)
    expect(b.cost).toBeCloseTo(1_000_000, 3)
    expect(b.days).toBeCloseTo(20, 9)
  })
  it('2018/19 Q2c manual: 100 acres × (₦10,000 + ₦5,000) = ₦1,500,000', () => {
    expect(clearingCost(100, CLEARING_1819.manual).cost).toBeCloseTo(1_500_000, 3)
  })
  it('errata: "4 people clear 1 acre a day" → 100 days for 100 acres; the guide’s 25 days needs 4 acres/day', () => {
    expect(clearingCost(100, CLEARING_1819.manual).days).toBeCloseTo(100, 9)
    expect(clearingCost(100, MANUAL_GUIDE).days).toBeCloseTo(25, 9)
  })
  it('errata: 40 ha = 98.8 acres (the guide rounds to 100 acres)', () => expect(acresFromHa(40)).toBeCloseTo(98.84, 2))
})
