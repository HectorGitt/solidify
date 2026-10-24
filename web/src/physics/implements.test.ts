import { describe, expect, it } from 'vitest'
import {
  METRIC_HP,
  UNIT_DRAFT,
  applicationRate,
  biteLength,
  boomCalibLength,
  calibrationLength,
  discCutWidth,
  discHalfChord,
  discNormal,
  drawbarPower,
  drillCalibration,
  dropletsPerCm2,
  fieldCapacity,
  furrowAreaCm2,
  kmhToMs,
  nozzleFlow,
  ploughDraft,
  plateSeedSpacing,
  pressureForFlow,
  tipSpeedRatio,
  ulvCapacity,
  wheelRevs,
} from './implements'

const AM = 'AEE502 AGRICULTURAL MACHINERIES'

describe(`${AM} §12 plough draft = unit draft × furrow area`, () => {
  it('150 mm × 60 mm furrow in clay (2 N/cm²): 90 cm², 180 N', () => {
    expect(furrowAreaCm2(0.15, 0.06)).toBeCloseTo(90, 6)
    expect(ploughDraft(UNIT_DRAFT.clay, 0.15, 0.06)).toBeCloseTo(180, 6)
  })
  it('errata plough-hp: 180 N at 1 m/s is 180 W ≈ 0.245 metric hp, not 2.4 hp', () => {
    const P = drawbarPower(180, 1)
    expect(P).toBeCloseTo(180, 6)
    expect(P / METRIC_HP).toBeCloseTo(0.245, 3)
    // the notes' 2.4 hp comes from treating 180 N as 180 kgf: 180 × 1 / 75
    expect((180 * 1) / 75).toBeCloseTo(2.4, 6)
  })
  it('errata two-bottom (2018/19 guide): two 150 × 70 mm bottoms, 2 N/cm², 2.8 km/h → 210 cm², 420 N, ≈ 327 W', () => {
    expect(furrowAreaCm2(0.15, 0.07, 2)).toBeCloseTo(210, 6)
    const D = ploughDraft(2, 0.15, 0.07, 2)
    expect(D).toBeCloseTo(420, 6)
    expect(drawbarPower(D, kmhToMs(2.8))).toBeCloseTo(326.7, 1)
  })
  it('sand (1 N/cm²) needs half the draft of clay', () => {
    expect(ploughDraft(UNIT_DRAFT.sand, 0.3, 0.2, 3) * 2).toBeCloseTo(ploughDraft(UNIT_DRAFT.clay, 0.3, 0.2, 3), 6)
  })
})

describe('disc geometry (beyond notes)', () => {
  it('chord: a vertical disc cut to its centre gives the full radius', () => {
    expect(discHalfChord(0.33, 0.33, 0)).toBeCloseTo(0.33, 9)
  })
  it('cut width grows with disc angle across the 42–45° range (AEE502 §12)', () => {
    const r = (a: number) => discCutWidth(0.33, 0.2, (a * Math.PI) / 180, (20 * Math.PI) / 180)
    expect(r(45)).toBeGreaterThan(r(42))
  })
  it('the concave-face normal is a unit vector facing forward, right and down', () => {
    const n = discNormal(Math.PI / 4, (20 * Math.PI) / 180)
    expect(Math.hypot(...n)).toBeCloseTo(1, 9)
    expect(n[0]).toBeGreaterThan(0)
    expect(n[1]).toBeLessThan(0)
    expect(n[2]).toBeLessThan(0)
  })
})

describe('rotavator bite length (beyond notes: l = v/(nZ))', () => {
  it('1 m/s, 200 rpm, 3 blades per flange → 0.1 m', () => {
    expect(biteLength(1, 200, 3)).toBeCloseTo(0.1, 9)
  })
  it('doubling forward speed doubles the bite; λ > 1 for a 0.25 m rotor at 200 rpm and 1 m/s', () => {
    expect(biteLength(2, 200, 3)).toBeCloseTo(0.2, 9)
    expect(tipSpeedRatio(1, 200, 0.25)).toBeCloseTo(5.236, 3)
  })
})

describe(`${AM} §13 seed drill calibration N = L/(πD), L = 10000·A/W`, () => {
  const c = drillCalibration(5, 0.15, 80, 1, 0.1)
  it('5 × 150 mm drill → W = 0.75 m', () => expect(c.W).toBeCloseTo(0.75, 9))
  it('L = 10000 × 0.1 / 0.75 = 1333 m', () => expect(c.L).toBeCloseTo(1333.3, 1))
  it('N = 1333/(π × 1) = 424.4, i.e. 425 revolutions (rounded up in the notes)', () => {
    expect(c.N).toBeCloseTo(424.4, 1)
    expect(Math.ceil(c.N)).toBe(425)
  })
  it('80 kg/ha × 0.1 ha = 8 kg, 1.6 kg per tube', () => {
    expect(c.total).toBeCloseTo(8, 9)
    expect(c.perTube).toBeCloseTo(1.6, 9)
  })
  it('helpers agree', () => {
    expect(wheelRevs(calibrationLength(0.1, 0.75), 1)).toBeCloseTo(c.N, 9)
  })
  it('planter plate spacing (beyond notes): 0.5 m wheel, 1:1, 16 cells → 98 mm', () => {
    expect(plateSeedSpacing(0.5, 1, 16)).toBeCloseTo(0.0982, 4)
  })
})

describe(`${AM} §15 sprayer`, () => {
  it('flow ∝ √p: four times the pressure doubles the flow', () => {
    expect(nozzleFlow(0.8, 2, 8)).toBeCloseTo(1.6, 9)
    expect(pressureForFlow(0.8, 2, 1.6)).toBeCloseTo(8, 9)
  })
  it('doubling the speed from 4 to 8 km/h halves the application rate', () => {
    expect(applicationRate(10, 6, 8)).toBeCloseTo(applicationRate(10, 6, 4) / 2, 9)
  })
  it('boom calibration: 10 nozzles at 200 mm (W = 2 m) → L = 1000/W = 500 m per 0.1 ha, 2500 m for 0.5 ha', () => {
    expect(boomCalibLength(2)).toBeCloseTo(500, 9)
    expect(boomCalibLength(10 * 0.2, 0.5)).toBeCloseTo(2500, 9)
  })
  it('ULV: 1 m/s × 10 m swath = 3.6 ha/h', () => {
    expect(ulvCapacity(1, 10)).toBeCloseTo(3.6, 9)
  })
  it('ULV: 1 L/ha as 70 µm droplets gives about 50 droplets/cm² (56 exactly)', () => {
    const n = dropletsPerCm2(1, 70e-6)
    expect(n).toBeGreaterThan(50)
    expect(n).toBeLessThan(60)
  })
})

describe('AEE501 MGMT p8 field capacity C = W·S·FE/10', () => {
  it('3 × 0.3 m plough at 5 km/h, FE 80 % → 0.36 ha/h', () => {
    expect(fieldCapacity(0.9, 5, 0.8)).toBeCloseTo(0.36, 9)
  })
})
