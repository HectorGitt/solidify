import { describe, expect, it } from 'vitest'
import {
  DENSITY,
  DRIVES,
  GREENHOUSE,
  HAZARD_SEPARATION,
  allocateOccupants,
  arealMass,
  bedroomMinArea,
  benchOk,
  checkRoom,
  doorAreaRange,
  driveVerdict,
  fansNeeded,
  ft,
  inPlume,
  lengthRange,
  liftingGear,
  needsSeparateStore,
  parkingBlock,
  riseFor,
  shedSize,
  solarLoad,
  turningPad,
  ventFlow,
  ventHeat,
  ventRateMid,
  windAxisAngle,
  windVerdict,
  zoneRadii,
  zoneWidthOk,
} from './structures'

describe('farmstead zones (AEE505 LN p8–9)', () => {
  it('zone rings are 10–30 m wide and nest tangent at the road', () => {
    expect(zoneWidthOk(10)).toBe(true)
    expect(zoneWidthOk(30)).toBe(true)
    expect(zoneWidthOk(35)).toBe(false)
    expect(zoneRadii([20, 15, 25, 30])).toEqual([20, 35, 60, 90])
  })
  it('livestock downwind of the dwelling (LN p10 air movement)', () => {
    expect(windAxisAngle(180, 0)).toBeCloseTo(0) // wind from the south, axis to the north
    expect(windVerdict(windAxisAngle(225, 0))).toBe('good')
    expect(windVerdict(windAxisAngle(90, 0))).toBe('crosswind')
    expect(windVerdict(windAxisAngle(0, 0))).toBe('bad')
  })
  it('odour plume reaches the dwelling only when it lies downwind of the livestock', () => {
    expect(inPlume([0, 100], 0, [0, 10])).toBe(true) // wind from the north blows the odour south onto the house
    expect(inPlume([0, 100], 180, [0, 10])).toBe(false)
  })
})

describe('drives and parking (LN p21–22, worked example 2)', () => {
  it('18 ft two-way drive = 5.5 m', () => {
    expect(ft(18)).toBeCloseTo(5.49, 2)
    expect(driveVerdict(ft(18))).toBe('two-way')
    expect(driveVerdict(ft(12))).toBe('one-way')
    expect(driveVerdict(3)).toBe('too narrow')
  })
  it('three 12 × 60 ft stalls = 11.0 × 18.3 m', () => {
    const p = parkingBlock(3)
    expect(p.w).toBeCloseTo(10.97, 2)
    expect(p.l).toBeCloseTo(18.29, 2)
  })
  it('45 ft turning radius = 13.7 m → cleared pad ≈ 27 m across', () => {
    expect(ft(45)).toBeCloseTo(13.7, 1)
    expect(turningPad(ft(45))).toBeCloseTo(27.4, 1)
    expect(DRIVES.turningRadius.min).toBeCloseTo(12.19, 2)
  })
})

describe('dwelling room rules (LN p17–19, worked example 3: family of 7)', () => {
  it('bedroom ≥ 9 m² and ≥ 3 m² per person', () => {
    expect(bedroomMinArea(3)).toBe(9) // boys' room for 3
    expect(bedroomMinArea(2)).toBe(9) // girls' room for 2
    expect(bedroomMinArea(4)).toBe(12)
  })
  it('family of 7 over master + two children’s rooms → 2, 3, 2', () => {
    expect(allocateOccupants(7, 3)).toEqual([2, 3, 2])
  })
  it('living room 12–15 m², wash slab ≥ 3 m²', () => {
    expect(checkRoom('living', 13)?.ok).toBe(true)
    expect(checkRoom('living', 10)?.ok).toBe(false)
    expect(checkRoom('living', 20, 0, true)?.ok).toBe(false)
    expect(checkRoom('wash', 3)?.ok).toBe(true)
    expect(checkRoom('kitchen', 5)).toBeNull()
  })
})

describe('workshop, machinery storage and hazardous stores (LN p23–27)', () => {
  it('workbench 1 m high, ≤ 800 mm deep, ≥ 3 m long', () => {
    expect(benchOk(1, 0.8, 3)).toBe(true)
    expect(benchOk(1, 0.9, 3)).toBe(false)
    expect(benchOk(1, 0.7, 2.5)).toBe(false)
  })
  it('timber lifting beam up to 3 m span, otherwise a truss or hoist', () => {
    expect(liftingGear(3)).toBe('timber beam')
    expect(liftingGear(4)).toBe('truss or portable hoist')
  })
  it('separate store ≥ 15 m away above 3 L thinner, 10 L petrol, 20 L kerosene or 50 L diesel', () => {
    expect(HAZARD_SEPARATION).toBe(15)
    expect(needsSeparateStore({ diesel: 50, petrol: 10 }).required).toBe(false)
    expect(needsSeparateStore({ diesel: 200 }).over).toEqual(['diesel'])
    expect(needsSeparateStore({ thinner: 4, kerosene: 25 }).over).toEqual(['thinner', 'kerosene'])
  })
  it('shed bays sized from machine envelopes plus clearance', () => {
    const s = shedSize(['tractor', 'trailer'], 0.5, 0.3)
    expect(s.bays[0]).toBeCloseTo(2.85, 6)
    expect(s.height).toBeCloseTo(2.75, 6)
    expect(s.depth).toBeCloseTo(4.8, 6)
  })
})

describe('greenhouse ventilation (LN p29–30, worked example 1)', () => {
  const A = 9.6 * 43
  it('3 × 3.2 m bays × 43 m: floor ≈ 413 m², length within 4–5 × span', () => {
    expect(A).toBeCloseTo(413, 0)
    const L = lengthRange(9.6)
    expect(43).toBeGreaterThanOrEqual(L.min)
    expect(43).toBeLessThanOrEqual(L.max)
  })
  it('glass: Q = 0.045 × 413 = 18.6 m³/s → 8 fans of 2.5 m³/s', () => {
    const Q = ventFlow(ventRateMid('glass'), A)
    expect(Q).toBeCloseTo(18.6, 1)
    expect(fansNeeded(Q, 2.5)).toBe(8)
  })
  it('polythene: Q = 0.035 × 413 = 14.5 m³/s', () => {
    expect(ventFlow(ventRateMid('polythene'), A)).toBeCloseTo(14.45, 1)
  })
  it('door area 3–7 % of floor = 12–29 m²', () => {
    const d = doorAreaRange(A)
    expect(d.min).toBeCloseTo(12.4, 1)
    expect(d.max).toBeCloseTo(28.9, 1)
  })
  it('heat removed at ΔT = 4 °C ≈ 90 kW (≈ 217 W/m²) [beyond notes]', () => {
    const q = ventHeat(18.6, 4)
    expect(q / 1000).toBeCloseTo(89.8, 0)
    expect(q / A).toBeCloseTo(217, -1)
  })
  it('the calibrated solar load keeps ΔT just under 4 °C at the mid rates [beyond notes]', () => {
    for (const c of ['glass', 'polythene'] as const) {
      const dT = riseFor(solarLoad(800, c) * A, ventFlow(ventRateMid(c), A))
      expect(dT).toBeLessThan(GREENHOUSE.maxRise)
      expect(dT).toBeGreaterThan(3.5)
    }
  })
  it('errata: 4 mm glass is ≈ 10 kg/m², not the printed 2.8 kg/m²', () => {
    expect(arealMass(DENSITY.glass, 0.004)).toBeCloseTo(10, 6)
    expect(GREENHOUSE.glassPane.printedMass).not.toBeCloseTo(arealMass(DENSITY.glass, 0.004), 0)
  })
})
