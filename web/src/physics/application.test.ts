import { describe, expect, it } from 'vitest'
import {
  applicationRate,
  apronSpeedForRate,
  beaterRpm,
  boomCV,
  boomDistribution,
  boomWidth,
  broadcastRate,
  discExit,
  dragFreeRange,
  dragK,
  dropletsPerCm2,
  gateFlowForRate,
  granuleFlight,
  granuleRangeApprox,
  landingPoint,
  linePressure,
  manureRate,
  nozzleFlow,
  nozzleFlowForRate,
  nozzleK,
  nozzlePattern,
  orificeFlow,
  orificeForFlow,
  overlapPattern,
  ratchetApronSpeed,
  ratePerHa,
  rateForDropletDensity,
  reliefBypass,
  speedForRate,
  spinnerCalibLength,
  spinnerRateFromRefill,
  sprayerRateFromRefill,
  spreadPattern,
  tankCoverage,
  testRunLength,
  ulvRateKmh,
  type SpinnerSpec,
} from './application'

const AM = 'AEE502 AGRICULTURAL MACHINERIES'
const MG = 'AEE502 2018/19 marking guide'

describe(`${AM} §15.12 / ${MG} Q4(e) boom calibration`, () => {
  it('10 nozzles at 200 mm: W = 2 m, 0.5 ha needs 2500 m of travel', () => {
    const W = boomWidth(10, 0.2)
    expect(W).toBeCloseTo(2, 12)
    expect(testRunLength(W, 0.5)).toBeCloseTo(2500, 9)
  })
  it('0.1 ha run: L = 1000/W; litres used × 10 = L/ha', () => {
    expect(testRunLength(2, 0.1)).toBeCloseTo(500, 9)
    expect(sprayerRateFromRefill(20)).toBeCloseTo(200, 9)
    expect(ratePerHa(20, 0.1)).toBeCloseTo(200, 9)
  })
})

describe(`${AM} §15.6.1, §15.8 nozzle flow and speed`, () => {
  it('flow ∝ √pressure — the orifice law gives it: 4× the pressure doubles the flow', () => {
    const q1 = orificeFlow(1.2e-3, 2e5)
    const q2 = orificeFlow(1.2e-3, 8e5)
    expect(q2 / q1).toBeCloseTo(2, 9)
    expect(nozzleFlow(0.8, 2, 8)).toBeCloseTo(1.6, 9)
    expect(orificeForFlow(q1, 2e5)).toBeCloseTo(1.2e-3, 9)
  })
  it('spraying at 8 km/h instead of 4 km/h halves the application rate', () => {
    expect(applicationRate(12, 6, 8) / applicationRate(12, 6, 4)).toBeCloseTo(0.5, 12)
  })
  it('per-nozzle flow for a rate and its inverse (beyond notes): 200 L/ha, 6 km/h, 0.5 m → 1 L/min', () => {
    expect(nozzleFlowForRate(200, 6, 0.5)).toBeCloseTo(1, 12)
    expect(applicationRate(1 * 12, 6, 6)).toBeCloseTo(200, 9)
    expect(speedForRate(200, 12, 6)).toBeCloseTo(6, 9)
  })
  it('relief valve returns the pump flow the nozzles do not take, and caps the line pressure', () => {
    expect(reliefBypass(60, 24)).toBe(36)
    expect(reliefBypass(20, 24)).toBe(0)
    const K = nozzleK(1.6, 3)
    expect(linePressure(60, K, 12, 3)).toBe(3) // nozzles could only pass 60 L/min at > 3 bar → valve holds 3 bar
    expect(linePressure(10, K, 12, 3)).toBeCloseTo((10 / (12 * K)) ** 2, 9)
  })
  it('tank coverage: 600 L at 200 L/ha over 6 m covers 3 ha in 5 km', () => {
    const c = tankCoverage(600, 200, 6)
    expect(c.ha).toBeCloseTo(3, 12)
    expect(c.distance).toBeCloseTo(5000, 9)
  })
})

describe(`${AM} §15.10–15.11 ULV / CDA`, () => {
  it('walking 3.6 km/h with a 10 m swath covers 3.6 ha/h; the question’s 15 m swath gives 5.4 ha/h', () => {
    expect(ulvRateKmh(3.6, 10)).toBeCloseTo(3.6, 12)
    expect(ulvRateKmh(3.6, 15)).toBeCloseTo(5.4, 12)
  })
  it('1 L/ha of 70 µm droplets ≈ 50 droplets/cm² (56); 64 L/ha of 275 µm gives a similar density', () => {
    expect(dropletsPerCm2(1, 70e-6)).toBeCloseTo(55.7, 1)
    expect(dropletsPerCm2(64, 275e-6)).toBeGreaterThan(50)
    expect(dropletsPerCm2(64, 275e-6)).toBeLessThan(65)
  })
  it('errata: 100 µm droplets need only ≈ 2.9 L/ha for the same density, not 1000 L/ha (1000 L/ha ↔ ≈ 700 µm)', () => {
    const N = dropletsPerCm2(1, 70e-6)
    expect(rateForDropletDensity(N, 100e-6)).toBeCloseTo(2.92, 2)
    // cube law: 1000× the volume per droplet → 10× the diameter
    expect(rateForDropletDensity(N, 700e-6)).toBeCloseTo(1000, 6)
  })
})

describe('boom spray distribution (beyond notes)', () => {
  it('each nozzle pattern integrates to 1', () => {
    for (const kind of ['flat-fan', 'hollow-cone'] as const) {
      let s = 0
      const h = 0.5
      const a = (110 * Math.PI) / 180
      const dx = 1e-4
      for (let x = -2; x <= 2; x += dx) s += nozzlePattern(kind, x, h, a) * dx
      expect(s).toBeCloseTo(1, 2)
    }
  })
  it('flat fans at 0.5 m, 110°, 0.5 m high overlap evenly; too low a boom gives stripes', () => {
    const a = (110 * Math.PI) / 180
    expect(boomCV('flat-fan', 12, 0.5, 0.5, a)).toBeLessThan(0.05)
    expect(boomCV('flat-fan', 12, 0.5, 0.2, a)).toBeGreaterThan(0.2)
    const { ys } = boomDistribution('flat-fan', 12, 0.5, 0.5, a)
    expect(ys[120]).toBeCloseTo(1, 1)
  })
})

describe(`${AM} §14.4.1, §14.7 spinning-disc broadcaster`, () => {
  it('calibration run for 0.04 ha is 400/W; the refill × 25 gives kg/ha', () => {
    expect(spinnerCalibLength(8)).toBeCloseTo(50, 12)
    expect(testRunLength(8, 0.04)).toBeCloseTo(50, 12)
    expect(spinnerRateFromRefill(6)).toBeCloseTo(150, 12)
    expect(ratePerHa(6, 0.04)).toBeCloseTo(150, 9)
  })
  it('faster forward speed → less fertilizer per hectare (rate ∝ 1/v)', () => {
    expect(broadcastRate(0.5, 9, 2) / broadcastRate(0.5, 9, 1)).toBeCloseTo(0.5, 12)
    expect(gateFlowForRate(broadcastRate(0.5, 9, 2), 9, 2)).toBeCloseTo(0.5, 12)
  })
  it('frictionless vane: exit speed ω√(2R² − r0²)', () => {
    const e = discExit(50, 0.25, 0.05)
    expect(e.v).toBeCloseTo(50 * Math.sqrt(2 * 0.0625 - 0.0025), 9)
  })
  it('granule flight: no drag gives v0√(2h/g); drag shortens it, close to the horizontal-drag estimate', () => {
    expect(granuleFlight(10, 0.8, 0).range).toBeCloseTo(dragFreeRange(10, 0.8), 3)
    const k = dragK(3e-3, 1400)
    const f = granuleFlight(15, 0.8, k)
    expect(f.range).toBeLessThan(dragFreeRange(15, 0.8))
    expect(f.range).toBeCloseTo(granuleRangeApprox(15, 0.8, k), 0)
  })
  it('typical settings throw granules about 4–5 m each side: a 6–9 m spread width as in the notes', () => {
    const s: SpinnerSpec = { rpm: 540, R: 0.22, r0: 0.06, h: 0.8, d: 3e-3, rhoP: 1400, arc: [-1.4, 1.4] }
    const p = landingPoint(s, 0)
    const reach = Math.hypot(p.x, p.z)
    expect(reach).toBeGreaterThan(3)
    expect(reach).toBeLessThan(6)
    const pat = spreadPattern(s, 81, 8)
    const dz = pat.zs[1] - pat.zs[0]
    expect(pat.ys.reduce((a, b) => a + b, 0) * dz).toBeCloseTo(1, 6)
  })
  it('overlapping passes at the right bout width evens the deposit (normalised mean ≈ 1)', () => {
    const s: SpinnerSpec = { rpm: 540, R: 0.22, r0: 0.06, h: 0.8, d: 3e-3, rhoP: 1400, arc: [-1.4, 1.4] }
    const pat = spreadPattern(s, 161, 8)
    const o = overlapPattern(pat.zs, pat.ys, 6)
    const mean = o.ys.reduce((a, b) => a + b, 0) / o.ys.length
    expect(mean).toBeCloseTo(1, 1)
  })
})

describe(`${AM} §14.3.1 manure spreader`, () => {
  it('lower beater runs 6–7× wheel speed', () => {
    expect(beaterRpm(40)).toBeCloseTo(260, 9)
    expect(beaterRpm(40, 6)).toBe(240)
    expect(beaterRpm(40, 7)).toBe(280)
  })
  it('apron speed sets the rate: 700 kg/m³, 1.2 × 0.8 m load, 4 m spread, 6 km/h → 20 t/ha needs ≈ 1.19 m/min', () => {
    const v = 6 / 3.6
    const u = apronSpeedForRate(20000, 700, 1.2, 0.8, 4, v)
    expect(u * 60).toBeCloseTo(1.19, 2)
    expect(manureRate(700, 1.2, 0.8, u, 4, v).tHa).toBeCloseTo(20, 9)
    // doubling apron speed doubles the rate
    expect(manureRate(700, 1.2, 0.8, 2 * u, 4, v).tHa).toBeCloseTo(40, 9)
  })
  it('ratchet-and-pawl drive: 60 strokes/min, 2 of 40 teeth, Ø0.2 m sprocket → u = π·0.2/20 m/s', () => {
    expect(ratchetApronSpeed(60, 2, 40, 0.2)).toBeCloseTo((Math.PI * 0.2) / 20, 12)
  })
})
