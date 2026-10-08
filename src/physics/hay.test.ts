import { describe, expect, it } from 'vitest'
import {
  NOTES_BALE,
  advancePerStroke,
  baleDensity,
  baleMass,
  baleVolume,
  balerFeed,
  balesPerHour,
  crankTorque,
  cutterBarLead,
  hayDrying,
  knifeDisplacement,
  knifeSpeedRatio,
  knifeStroke,
  knifeVelocity,
  meanKnifeSpeed,
  mowerCapacity,
  peakKnifeSpeed,
  pickupRatio,
  ramStroke,
  registrationError,
  sectionTrack,
  sliceThickness,
  strokesPerBale,
  type Pitman,
} from './hay'

const AM = 'AEE502 AGRICULTURAL MACHINERIES'

describe(`${AM} §16.2.2 mower alignment and drying`, () => {
  it('lead of 6 mm per metre: a 2 m cutter bar is given 12 mm', () => {
    expect(cutterBarLead(2) * 1000).toBeCloseTo(12, 9)
    expect(cutterBarLead(1.5) * 1000).toBeCloseTo(9, 9)
  })
  it('hay cut at about 80 % and stored at about 20 % moisture: 1 t of fresh grass → 250 kg hay, 750 kg water removed', () => {
    const d = hayDrying(1000)
    expect(d.dryMatter).toBeCloseTo(200, 9)
    expect(d.hay).toBeCloseTo(250, 9)
    expect(d.water).toBeCloseTo(750, 9)
  })
})

describe(`${AM} §16.2.1 crank and pitman (kinematics beyond notes)`, () => {
  const p: Pitman = { r: 0.0381, l: 0.9 }
  it('in-line crank: stroke = 2r (76.2 mm, one guard spacing)', () => {
    expect(knifeStroke(p)).toBeCloseTo(0.0762, 9)
    expect(knifeDisplacement(p, Math.PI)).toBeCloseTo(0, 9)
    expect(knifeDisplacement(p, 0)).toBeCloseTo(0.0762, 9)
  })
  it('an offset crank lengthens the stroke slightly', () => {
    expect(knifeStroke({ ...p, e: 0.1 })).toBeGreaterThan(0.0762)
  })
  it('mean knife speed 2SN/60; peak ≈ ωr for a long pitman', () => {
    expect(meanKnifeSpeed(0.0762, 900)).toBeCloseTo(2.286, 3)
    const w = (2 * Math.PI * 900) / 60
    const vmax = Math.max(...Array.from({ length: 361 }, (_, i) => Math.abs(knifeVelocity(p, (i * Math.PI) / 180, w))))
    expect(vmax).toBeCloseTo(peakKnifeSpeed(p.r, 900), 1)
    expect(Math.PI / 2).toBeCloseTo(peakKnifeSpeed(1, 60) / 4, 9) // ω r with ω = 2π, r = 1 → 2π
  })
  it('advance per stroke and knife/forward speed ratio: 900 rpm at 8 km/h → 74 mm per stroke, ratio ≈ 1.03', () => {
    const v = 8 / 3.6
    expect(advancePerStroke(v, 900) * 1000).toBeCloseTo(74.07, 1)
    expect(knifeSpeedRatio(0.0762, 900, v)).toBeCloseTo(1.0287, 3)
  })
  it('registration: stroke = guard spacing puts the section centre on a guard centre at both ends', () => {
    const r = registrationError(p, 0.0762)
    expect(r.inner).toBeCloseTo(0, 12)
    expect(r.outer).toBeCloseTo(0, 9)
    const bad = registrationError(p, 0.0762, 0.01)
    expect(bad.inner).toBeCloseTo(0.01, 12)
  })
  it('section track over the ground: x = vt, zero lateral motion at dead centres', () => {
    const t = sectionTrack(p, 900, 2, 1 / 30) // half a revolution
    expect(t.x).toBeCloseTo(2 / 30, 12)
    expect(t.y).toBeCloseTo(0, 6)
  })
  it('crank torque is zero at the dead centres', () => {
    expect(crankTorque(p, 0, 500)).toBeCloseTo(0, 6)
    expect(crankTorque(p, Math.PI / 2, 500)).toBeCloseTo(500 * p.r, 1)
  })
  it('field capacity of a 2 m mower at 8 km/h, FE 0.8: 1.28 ha/h (AEE501 MGMT C = WS·FE/10)', () => {
    expect(mowerCapacity(2, 8, 0.8)).toBeCloseTo(1.28, 12)
  })
})

describe(`${AM} §16.2.3 baler (throughput beyond notes)`, () => {
  it('the notes’ 35 × 45 × 90 cm bale has a volume of 0.14175 m³; 20 kg → 141 kg/m³', () => {
    expect(baleVolume(NOTES_BALE)).toBeCloseTo(0.14175, 9)
    expect(baleDensity(20, NOTES_BALE)).toBeCloseTo(141.1, 1)
    expect(baleMass(141.1, NOTES_BALE)).toBeCloseTo(20, 2)
  })
  it('feed, slice and bale count: 3 kg/m windrow at 1.5 m/s, ram 80 strokes/min, 140 kg/m³', () => {
    const feed = balerFeed(3, 1.5)
    expect(feed).toBeCloseTo(4.5, 12)
    const t = sliceThickness(feed, 80, 140, NOTES_BALE)
    expect(t).toBeCloseTo(4.5 / ((80 / 60) * 140 * 0.35 * 0.45), 12)
    expect(strokesPerBale(NOTES_BALE, t)).toBeCloseTo(0.9 / t, 12)
    expect(balesPerHour(feed, baleMass(140, NOTES_BALE))).toBeCloseTo((4.5 * 3600) / (140 * 0.14175), 9)
  })
  it('pick-up tine tip must outrun the ground: 100 rpm at 0.25 m gives 2.6 m/s', () => {
    const r = pickupRatio(100, 0.25, 1.5)
    expect(r.tip).toBeCloseTo(2.618, 3)
    expect(r.ratio).toBeGreaterThan(1)
  })
  it('ram slider-crank: travel 2r from front to back dead centre', () => {
    expect(ramStroke(0.38, 1.0, 0)).toBeCloseTo(0, 12)
    expect(ramStroke(0.38, 1.0, Math.PI)).toBeCloseTo(0.76, 12)
  })
})
