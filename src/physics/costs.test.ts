import { describe, expect, it } from 'vitest'
import {
  capacityAcres,
  capacityHa,
  crf,
  implementSalvagePct,
  machineCosts,
  plotEfficiency,
  realRate,
  repairPct,
  tractorSalvagePct,
} from './costs'

const ISU = 'AEE501 MGMT (ISU PM 710)'

describe(`${ISU} worked example: 180 PTO-hp diesel tractor`, () => {
  const c = machineCosts({
    list: 110000,
    purchase: 93500,
    years: 15,
    hoursPerYear: 400,
    salvagePct: tractorSalvagePct('150+', 15, 400),
    i: realRate(0.08, 0.03),
    repair: 'tractor2wd',
    ptoHp: 180,
    fuelPrice: 1,
    wage: 10,
    labourFactor: 1.1,
  })
  it('salvage 23 % = $25,300; depreciation $68,200; CRF(15 yr, 5 %) = .096', () => {
    expect(c.salvage).toBeCloseTo(25300, 6)
    expect(c.depreciation).toBeCloseTo(68200, 6)
    expect(c.crf).toBe(0.096)
  })
  it('capital recovery $7,812; TIH $935; ownership $8,747/yr = $21.87/h', () => {
    expect(c.capitalRecovery).toBeCloseTo(7812, 0)
    expect(c.tih).toBeCloseTo(935, 6)
    expect(c.ownershipYear).toBeCloseTo(8747, 0)
    expect(c.ownershipHour).toBeCloseTo(21.87, 2)
  })
  it('repairs 25 % at 6,000 h = $4.58/h; fuel 7.92 gal/h; lube $1.19; labour $11', () => {
    expect(repairPct('tractor2wd', 6000)).toBe(25)
    expect(c.repairHour).toBeCloseTo(4.58, 2)
    expect(c.fuelGal).toBeCloseTo(7.92, 9)
    expect(c.lubeHour).toBeCloseTo(1.19, 2)
    expect(c.labourHour).toBeCloseTo(11, 9)
  })
  it('operating $24.69/h (errata isu-operating: the text also says $18.09) and total $46.56/h', () => {
    expect(c.operatingHour).toBeCloseTo(24.69, 2)
    expect(c.totalHour).toBeCloseTo(46.56, 2)
  })
})

describe(`${ISU} worked example: used 28-ft tandem disk`, () => {
  const d = machineCosts({
    list: 30000,
    purchase: 11000,
    years: 8,
    hoursPerYear: 100,
    salvagePct: implementSalvagePct('otherTillage', 6 + 8),
    i: 0.05,
    repair: 'tandemDisk',
    hoursAtPurchase: 600,
  })
  it('salvage at 13 years is 24 % — Table 1b “other tillage” row 13', () => {
    expect(implementSalvagePct('otherTillage', 13)).toBe(24)
  })
  const disk = machineCosts({ ...{ list: 30000, purchase: 11000, years: 8, hoursPerYear: 100, i: 0.05, repair: 'tandemDisk' as const, hoursAtPurchase: 600 }, salvagePct: 24 })
  it('capital recovery .155 × $3,800 + $7,200 × .05 = $949; TIH $110; $10.59/h', () => {
    expect(disk.crf).toBe(0.155)
    expect(disk.capitalRecovery).toBeCloseTo(949, 0)
    expect(disk.tih).toBeCloseTo(110, 9)
    expect(disk.ownershipHour).toBeCloseTo(10.59, 2)
  })
  it('repairs (32 % − 8 %) × $30,000 over 800 h = $9.00/h; disk $19.59/h', () => {
    expect(disk.hoursEnd).toBe(1400)
    expect(disk.repairHour).toBeCloseTo(9.0, 9)
    expect(disk.totalHour).toBeCloseTo(19.59, 2)
  })
  it('with the tractor $66.15/h; 28 ft × 6.0 mph × 79 % / 8.25 = 16 ac/h → $4.13/acre', () => {
    expect(46.56 + disk.totalHour).toBeCloseTo(66.15, 2)
    const C = capacityAcres(28, 6, 0.79)
    expect(C).toBeCloseTo(16.09, 2)
    expect(66.15 / Math.round(C)).toBeCloseTo(4.13, 2)
  })
  it('the text reads Table 1b at 13 years; a 6-year-old disk kept 8 more years is 14 years old (23 %, $6,900)', () => {
    expect(d.salvage).toBeCloseTo(0.23 * 30000, 6)
  })
})

describe('AEE501 exam capacity problems (2019/20, 2023/24)', () => {
  it('5-ft slasher, FE 85 %: at 8 mph C_t = 1.96 ha/h, C_e = 1.67 ha/h (at 8 km/h: 1.22 and 1.04)', () => {
    const W = 5 * 0.3048
    expect(capacityHa(W, 8 * 1.609344, 1)).toBeCloseTo(1.962, 3)
    expect(capacityHa(W, 8 * 1.609344, 0.85)).toBeCloseTo(1.668, 3)
    expect(capacityHa(W, 8, 1)).toBeCloseTo(1.219, 3)
    expect(capacityHa(W, 8, 0.85)).toBeCloseTo(1.036, 3)
  })
  it('SI and imperial forms agree: ha/h = 0.4047 × ac/h', () => {
    expect(capacityHa(28 * 0.3048, 6 * 1.609344, 0.79)).toBeCloseTo(capacityAcres(28, 6, 0.79) * 0.40468564, 3)
  })
  it('SANDEL tractor (₦17 M after 5 % discount, 200 hp, 600 h/yr): after 10 years 31 % remains → depreciation ₦11.45 M', () => {
    const list = 17e6 / 0.95
    const salv = (tractorSalvagePct('150+', 10, 600) / 100) * list
    expect(tractorSalvagePct('150+', 10, 600)).toBe(31)
    expect((17e6 - salv) / 1e6).toBeCloseTo(11.45, 2)
  })
  it('CRF(7 yr, 6 %) = 0.179 (Table 2)', () => expect(crf(0.06, 7)).toBe(0.179))
})

describe('field-efficiency model', () => {
  it('no turns, overlap or delays → FE = 1 and C_e = W·S/10', () => {
    const r = plotEfficiency({ W: 3, S: 8, overlap: 0, L: 200, passes: 6, turnTimes: [], otherFrac: 0 })
    expect(r.FE).toBeCloseTo(1, 12)
    expect(r.Ce).toBeCloseTo(2.4, 12)
  })
  it('C_e = W·S·FE/10 for any losses', () => {
    const r = plotEfficiency({ W: 3, S: 8, overlap: 0.1, L: 200, passes: 6, turnTimes: [20, 25, 30, 35, 40], otherFrac: 0.1 })
    expect(r.FE).toBeLessThan(0.9)
    expect(r.Ce).toBeCloseTo(capacityHa(3, 8, r.FE), 12)
  })
})
