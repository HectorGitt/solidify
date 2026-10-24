import { describe, expect, it } from 'vitest'
import {
  ACRE_HA,
  FT,
  MILE_KM,
  SUCTION_CM,
  bladeRidgeHeight,
  bladeTip,
  biteLength,
  cellsForSpacing,
  centreOfDraftZ,
  correctedSetting,
  draftLineAboveV,
  drillCalibration,
  fieldCapacities,
  fieldCapacity,
  fieldCapacityAcres,
  fieldEfficiency,
  flutedRollerMass,
  flutedRollerRate,
  gangCutWidth,
  hitchStage,
  metricHp,
  perOpenerRate,
  plantPopulation,
  plateRatio,
  plateSpacing,
  ploughPerformance,
  ploughWork,
  rateFromCatch,
  suctionStatus,
  throughputCapacity,
  travelForArea,
} from './tillage'

const AM = 'AEE502 AGRICULTURAL MACHINERIES'
const G1819 = 'AEE502 2018/19 marking guide Q3(c)ii'
const MGMT = 'AEE501 Machinery Management MODULE 1 (PM 710) p8'

describe(`${AM} §12.4 plough draft worked example`, () => {
  it('150 mm wide × 60 mm deep, 2 N/cm²: 90 cm², 180 N', () => {
    const r = ploughPerformance(2, 0.15, 0.06, 1, 3.6)
    expect(r.A).toBeCloseTo(90, 9)
    expect(r.D).toBeCloseTo(180, 9)
  })
  it('errata plough-hp: at 3.6 km/h (1 m/s) the power is 180 W = 0.245 metric hp, not the 2.4 hp the notes give', () => {
    const r = ploughPerformance(2, 0.15, 0.06, 1, 3.6)
    expect(r.v).toBeCloseTo(1, 9)
    expect(r.P).toBeCloseTo(180, 9)
    expect(r.hp).toBeCloseTo(0.2448, 3)
  })
})

describe(`${G1819}: two-bottom 150 mm plough, 70 mm deep, 2.8 km/h, 2 N/cm²`, () => {
  const r = ploughPerformance(2, 0.15, 0.07, 2, 2.8)
  it('errata two-bottom: both bottoms give 210 cm² and 420 N (the guide uses one bottom: 105 cm², 210 N)', () => {
    expect(r.A).toBeCloseTo(210, 9)
    expect(r.D).toBeCloseTo(420, 9)
    expect(furrowOne()).toBeCloseTo(105, 9)
  })
  it('power 420 N × 0.778 m/s = 326.7 W = 0.444 metric hp (the guide divides 163.8 W by 0.78 instead of by 735.5 W/hp)', () => {
    expect(r.P).toBeCloseTo(326.67, 1)
    expect(r.hp).toBeCloseTo(0.4442, 3)
    // the guide's own power for one bottom, 210 N × 0.778 m/s
    expect(210 * (2.8 / 3.6)).toBeCloseTo(163.3, 1)
  })
  it('work to plough 1 ha = draft × distance = 420 N × 10 000 m²/0.30 m = 14.0 MJ (the guide gives a dimensionless 2 × 10⁸)', () => {
    expect(travelForArea(0.3, 1)).toBeCloseTo(33333.3, 1)
    expect(ploughWork(420, 0.3, 1)).toBeCloseTo(14.0e6, -4)
    // the one-bottom working gives the same work per hectare (half the draft, half the width)
    expect(ploughWork(210, 0.15, 1)).toBeCloseTo(ploughWork(420, 0.3, 1), 3)
  })
})
const furrowOne = () => ploughPerformance(2, 0.15, 0.07, 1, 2.8).A

describe(`${AM} §12.3 centre of draft`, () => {
  it('one bottom: 5 cm in from the landside', () => {
    expect(centreOfDraftZ([0.3])).toBeCloseTo(0.25, 9)
  })
  it('three 30 cm bottoms: the centre of draft lies on the middle bottom', () => {
    expect(centreOfDraftZ([0.3, 0.6, 0.9])).toBeCloseTo(0.55, 9)
  })
  it('two bottoms: halfway between the two bottoms’ centres', () => {
    expect(centreOfDraftZ([0.3, 0.6])).toBeCloseTo(0.4, 9)
  })
})

describe(`${AM} §12.2.1 mouldboard suction 0.48–1.25 cm`, () => {
  it('classifies clearances against the stated range', () => {
    expect(SUCTION_CM.min).toBe(0.48)
    expect(suctionStatus(0.3)).toBe('low')
    expect(suctionStatus(0.8)).toBe('ok')
    expect(suctionStatus(1.5)).toBe('high')
  })
})

describe('Macmillan Ch 6 Fig 6.5 virtual hitch point', () => {
  const P = { x: -1.2, y: -0.12 }
  const back = { x: -1, y: -0.2 }
  it('(a) V below ground with the line of draft above it: the plough is pulled in', () => {
    const d = draftLineAboveV({ x: 2.5, y: -0.9 }, P, back)
    expect(d).toBeGreaterThan(0)
    expect(hitchStage(d, false)).toBe('penetrating')
  })
  it('(b) line of draft through V: free-link equilibrium', () => {
    const V = { x: P.x + 3 * back.x * -1, y: P.y + 3 * back.y * -1 }
    const d = draftLineAboveV(V, P, back)
    expect(d).toBeCloseTo(0, 9)
    expect(hitchStage(d, true)).toBe('free-link')
  })
  it('(c) at working depth with the line still above V: restrained by the linkage', () => {
    expect(hitchStage(draftLineAboveV({ x: 2.5, y: 0.1 }, P, back), true)).toBe('restrained')
  })
  it('V above the line: the soil force lifts the implement out', () => {
    expect(hitchStage(draftLineAboveV({ x: 2.5, y: 1.2 }, P, back), true)).toBe('lifting')
  })
  it('sign does not depend on which way the direction vector points', () => {
    const V = { x: 2, y: -0.5 }
    expect(draftLineAboveV(V, P, back)).toBeCloseTo(draftLineAboveV(V, P, { x: 1, y: 0.2 }), 9)
  })
})

describe(`${MGMT} field capacity C = W·S·FE/8.25`, () => {
  it('28 ft × 6.0 mph × 79 % / 8.25 = 16 ac/h', () => {
    expect(fieldCapacityAcres(28, 6, 0.79)).toBeCloseTo(16.09, 2)
  })
  it('2015 revision: 25 ft × 4.5 mph × 81 % / 8.25 = 11 ac/h', () => {
    expect(fieldCapacityAcres(25, 4.5, 0.81)).toBeCloseTo(11.05, 2)
  })
  it('the SI form W(m)·S(km/h)·FE/10 ha/h gives the same capacity', () => {
    const ha = fieldCapacity(28 * FT, 6 * MILE_KM, 0.79)
    expect(ha / ACRE_HA).toBeCloseTo(fieldCapacityAcres(28, 6, 0.79), 1)
  })
  it('field efficiency = theoretical time ÷ actual time', () => {
    expect(fieldEfficiency(0.79, 1)).toBeCloseTo(0.79, 9)
    const c = fieldCapacities(3, 6, 0.8)
    expect(c.Ce / c.Ct).toBeCloseTo(0.8, 9)
  })
})

describe('AEE501 2019/20 exam: 5-ft slasher, FE 85 % (speed "8 m/h" is ambiguous)', () => {
  it('read as 8 km/h: Ct = 1.22 ha/h, Ce = 1.04 ha/h', () => {
    const c = fieldCapacities(5 * FT, 8, 0.85)
    expect(c.Ct).toBeCloseTo(1.219, 3)
    expect(c.Ce).toBeCloseTo(1.036, 3)
  })
  it('read as 8 mph: Ct = 1.96 ha/h, Ce = 1.67 ha/h', () => {
    const c = fieldCapacities(5 * FT, 8 * MILE_KM, 0.85)
    expect(c.Ct).toBeCloseTo(1.962, 3)
    expect(c.Ce).toBeCloseTo(1.668, 3)
  })
  it('throughput capacity: 10 000 t (75 % grain) over 85 % of 600 h → 14.7 t/h commodity, 19.6 t/h total', () => {
    const h = 0.85 * 600
    expect(throughputCapacity(7500, h)).toBeCloseTo(14.71, 2)
    expect(throughputCapacity(10000, h)).toBeCloseTo(19.61, 2)
  })
})

describe(`${AM} §13.5 seed drill calibration worked example (5 × 150 mm, 80 kg/ha, D = 1000 mm)`, () => {
  const c = drillCalibration(5, 0.15, 80, 1.0, 0.1)
  it('width 0.75 m; 13 333.3 m per ha; 1333.3 m for 0.1 ha', () => {
    expect(c.W).toBeCloseTo(0.75, 9)
    expect(travelForArea(0.75, 1)).toBeCloseTo(13333.3, 1)
    expect(c.L).toBeCloseTo(1333.3, 1)
  })
  it('N = L/(πD) = 424.4 wheel revolutions (the notes print 425, rounding up)', () => {
    expect(c.N).toBeCloseTo(424.4, 1)
    expect(Math.ceil(c.N)).toBe(425)
  })
  it('16 kg per tube per hectare, 1.6 kg per tube for 0.1 ha; 8 kg in total', () => {
    expect(perOpenerRate(80, 5)).toBeCloseTo(16, 9)
    expect(c.perTube).toBeCloseTo(1.6, 9)
    expect(c.total).toBeCloseTo(8, 9)
  })
  it('§13.5: 40 kg/ha from five openers is 8 kg per opener', () => {
    expect(perOpenerRate(40, 5)).toBeCloseTo(8, 9)
  })
  it('step 8: the catch from 0.1 ha × 10 gives the rate per hectare', () => {
    expect(rateFromCatch(8, 0.1)).toBeCloseTo(80, 9)
  })
})

describe('fluted-roller metering (beyond notes) reproduces the calibration', () => {
  it('rate ∝ exposed length; correcting the setting by target/measured hits the target', () => {
    const m = flutedRollerMass(12, 2e-5, 0.03, 780, 0.9)
    const r1 = flutedRollerRate(m, 0.5, 1.0, 0.15)
    const m2 = flutedRollerMass(12, 2e-5, 0.06, 780, 0.9)
    expect(flutedRollerRate(m2, 0.5, 1.0, 0.15)).toBeCloseTo(2 * r1, 9)
    const e = correctedSetting(0.03, r1, 80)
    expect(flutedRollerRate(flutedRollerMass(12, 2e-5, e, 780, 0.9), 0.5, 1.0, 0.15)).toBeCloseTo(80, 9)
  })
  it('one wheel revolution per opener covers πD × spacing, so 424.4 revs deliver the 1.6 kg per tube', () => {
    const m = flutedRollerMass(12, 2e-5, 0.03, 780, 0.9)
    const rate = flutedRollerRate(m, 0.5, 1.0, 0.15)
    const perTube = m * 0.5 * drillCalibration(5, 0.15, rate, 1.0).N
    expect(perTube).toBeCloseTo((rate * 0.1) / 5, 9)
  })
})

describe('planter seed plate (Fig 13.8; spacing relation beyond notes)', () => {
  it('a 1:1 drive with 16 cells on a 0.5 m wheel spaces seeds πD/16 ≈ 98 mm', () => {
    expect(plateSpacing(0.5, plateRatio(15, 15), 16)).toBeCloseTo(0.0982, 4)
  })
  it('halving the plate speed doubles the spacing; cellsForSpacing inverts it', () => {
    const s = plateSpacing(0.5, plateRatio(10, 20), 16)
    expect(s).toBeCloseTo(2 * plateSpacing(0.5, 1, 16), 9)
    expect(cellsForSpacing(0.5, 0.5, s)).toBeCloseTo(16, 9)
  })
  it('maize at 75 cm × 25 cm, one seed per hill: 53 333 plants/ha', () => {
    expect(plantPopulation(0.75, 0.25)).toBeCloseTo(53333.3, 0)
  })
})

describe('disc gang and rotavator kinematics (beyond notes)', () => {
  it('gang width shrinks with gang angle: 8 discs at 230 mm, 18° → 1.75 m', () => {
    expect(gangCutWidth(8, 0.23, (18 * Math.PI) / 180)).toBeCloseTo(1.75, 2)
  })
  it('bite length l = v/(nZ): 1 m/s, 200 rpm, 3 blades → 100 mm', () => {
    expect(biteLength(1, 200, 3)).toBeCloseTo(0.1, 9)
  })
  it('blade tip starts at the bottom and has returned to the bottom one revolution later, advanced v·T', () => {
    const T = 60 / 200
    const a = bladeTip(0, 1, 0.25, 200)
    const b = bladeTip(T, 1, 0.25, 200)
    expect(a.y).toBeCloseTo(-0.25, 9)
    expect(b.y).toBeCloseTo(-0.25, 9)
    expect(b.x - a.x).toBeCloseTo(0.3, 9)
  })
  it('ridge height between bites is small for a short bite', () => {
    expect(bladeRidgeHeight(0.1, 0.25)).toBeCloseTo(0.25 - Math.sqrt(0.0625 - 0.0025), 9)
  })
  it('metric hp helper: 735.5 W = 1 hp', () => {
    expect(metricHp(735.49875)).toBeCloseTo(1, 6)
  })
})
