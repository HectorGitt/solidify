import { describe, expect, it } from 'vitest'
import { FARMLAND, dynamicLoads } from '@/physics/chassis'
import { FARMLAND_ENGINE, FARMLAND_GEARS, engineEfficiency, idealPull, maxPower, powerLosses, torqueAt } from '@/physics/tractor'
import {
  CONCRETE,
  ETA_ENGINE_RATED,
  ETA_TRANSMISSION,
  UPPSALA,
  armPower,
  availableTorque,
  chassisDynoPoint,
  cylinderPressure,
  drawbarPoint,
  engineSpeedFor,
  fuelUse,
  highIdleFor,
  pullSpeedRun,
  slipForPull,
  springElongation,
  tractionAt,
  torquePower,
} from '@/physics/testing'
import { brixius, mobilityNumber } from '@/physics/traction'

const kmh = (v: number) => v * 3.6
const concrete = { kind: 'concrete' } as const

describe('MECH Fig 2.2 (ideal analysis, Farmland tractor)', () => {
  it('gear 3 at zero pull runs at high idle: 4.07 km/h', () => {
    const p = drawbarPoint({ P: 0, q: FARMLAND_GEARS[3], surface: concrete, ideal: true })
    expect(p.rpm).toBe(2390)
    expect(kmh(p.V)).toBeCloseTo(4.07, 2)
  })
  it('gear 3 at 38.31 kN lugs the engine to 1300 rpm and 2.21 km/h', () => {
    const P = idealPull(173, FARMLAND_GEARS[3], 1.26)
    expect(P / 1000).toBeCloseTo(38.31, 2)
    const p = drawbarPoint({ P, q: FARMLAND_GEARS[3], surface: concrete, ideal: true })
    expect(p.rpm).toBeCloseTo(1300, 0)
    expect(kmh(p.V)).toBeCloseTo(2.21, 2)
  })
  it('gear 7 at zero pull: 11.99 km/h (D ≈ 1.26 m is itself rounded, so ±0.02 km/h)', () => {
    expect(Math.abs(kmh(drawbarPoint({ P: 0, q: FARMLAND_GEARS[7], surface: concrete, ideal: true }).V) - 11.99)).toBeLessThan(0.02)
  })
  it('ideal: drawbar power equals engine power (eq 2.4), max ≈ 33.5 kW (notes 33.6 kW)', () => {
    const p = drawbarPoint({ P: 31440, q: FARMLAND_GEARS[3], surface: concrete, ideal: true })
    expect(p.Pd).toBeCloseTo(p.Pe, -1)
    expect(maxPower()).toBeCloseTo(33.46, 1)
  })
  it('at throttle 1 the governed curve is exactly the tabulated curve', () => {
    for (const [n, T] of FARMLAND_ENGINE) expect(availableTorque(n, 1)).toBeCloseTo(T, 9)
    expect(highIdleFor(1)).toBe(2390)
    expect(availableTorque(2000, 0.5)).toBeLessThan(torqueAt(FARMLAND_ENGINE, 2000))
    expect(engineSpeedFor(142)).toBeCloseTo(2250, 0)
  })
})

describe('MECH eqs 2.5–2.10 with losses', () => {
  const p = drawbarPoint({ P: 15000, q: FARMLAND_GEARS[5], surface: { kind: 'soil', CI: 860e3 } })
  it('H = P + R (eq 2.7) and Te = H·D/(2qηr), ηr = 0.98⁵', () => {
    expect(p.H).toBeCloseTo(p.P + p.R, 9)
    expect(ETA_TRANSMISSION).toBeCloseTo(0.904, 3)
    expect(p.Te).toBeCloseTo((p.H * 1.26) / (2 * FARMLAND_GEARS[5] * ETA_TRANSMISSION), 9)
  })
  it('V = V0(1 − i) (eq 2.6) and wheel power − drawbar power = H·V0·i + R·V (eq 2.8)', () => {
    expect(p.V).toBeCloseTo(p.V0 * (1 - p.slip), 12)
    const loss = powerLosses(p.H, p.R, p.V0, p.slip)
    expect(p.H * p.V0 - p.Pd).toBeCloseTo(loss.total, 6)
  })
  it('tractive efficiency ηt = (P/(P+R))(1 − i) (eq 2.10) and transmission loss', () => {
    expect(p.etaT).toBeCloseTo((p.P / (p.P + p.R)) * (1 - p.slip), 12)
    expect(p.H * p.V0).toBeCloseTo(p.Pe * ETA_TRANSMISSION, 3)
  })
  it('weight transfer: rear axle load rises by P·y′/x (Macmillan eq 6.4)', () => {
    expect(p.Vr - dynamicLoads(FARMLAND, 0).Vr).toBeCloseTo((15000 * 0.45) / 1.88, 6)
  })
})

describe('L27 traction (Zoz & Grisso)', () => {
  it('concrete model passes through L27 p37: 5 % slip, 2 % MR → TE = 92.5 %', () => {
    const t = tractionAt(concrete, 10000, 0.05)
    expect(t.MRR).toBe(0.02)
    expect(t.TE).toBeCloseTo(0.925, 6)
    expect(CONCRETE.c).toBeGreaterThan(0)
  })
  it('soil: slip found by iteration reproduces the Brixius NTR (eqs 14–16)', () => {
    const W = 10000
    const s = slipForPull({ kind: 'soil', CI: 860e3 }, W, 0.4)
    const Bn = mobilityNumber(860e3, 0.378, 1.32, W, 0.045, (1.32 - 0.7112) / 2)
    expect(brixius(Bn, s).NTR).toBeCloseTo(0.4, 6)
    expect(Number.isNaN(slipForPull({ kind: 'soil', CI: 200e3 }, W, 0.95))).toBe(true)
  })
})

describe('fuel (MECH eq 2.13)', () => {
  it('Willans model gives ηe = 0.30 at the rated point and agrees with eq 2.13', () => {
    const P = torquePower(142, 2250) * 1000
    const f = fuelUse(P, 2250)
    expect(f.etaE).toBeCloseTo(ETA_ENGINE_RATED, 9)
    // eq 2.13 with FC in kg/min and C in kJ/kg (HSD 10 550 kcal/kg)
    expect(engineEfficiency(142, 2250, f.kgh / 60, 10550 * 4.1868)).toBeCloseTo(0.3, 9)
  })
})

describe('TESTS §15.9–15.10 drawbar dynamometers', () => {
  it('test-car cylinder: 20 kN on a 100 mm bore is 2.55 MPa', () => {
    expect(cylinderPressure(20000, 0.1) / 1e6).toBeCloseTo(2.546, 3)
  })
  it('spring dial: x = P/k', () => {
    expect(springElongation(10000, 500000)).toBeCloseTo(0.02, 12)
  })
  it('a pull–speed run in gear 5 ends at stall or slip limit and speed falls with pull', () => {
    const run = pullSpeedRun(FARMLAND_GEARS[5], concrete)
    expect(run.length).toBeGreaterThan(10)
    for (let i = 1; i < run.length; i++) expect(run[i].V).toBeLessThanOrEqual(run[i - 1].V + 1e-9)
  })
})

describe('TESTS §15.13 chassis dynamometer (Fig 15.10)', () => {
  const d = chassisDynoPoint(FARMLAND_GEARS[5], 4, 0.6)
  it('absorber speed = drum speed × 18 × range ratio', () => {
    expect(d.nAbsorber).toBeCloseTo(d.nDrum * 18 * 4, 9)
  })
  it('the scale power (eq 3) equals the drum power P·V', () => {
    expect(d.scalePowerkW * 1000).toBeCloseTo(d.P * d.V, 3)
    expect(armPower(UPPSALA.arm, d.scaleF, d.nDrum)).toBeCloseTo(d.scalePowerkW, 12)
  })
  it('the engine runs on its governed curve at the balance point', () => {
    expect(d.stalled).toBe(false)
    expect(Math.abs(availableTorque(d.rpm) - d.Te)).toBeLessThan(2)
    expect(d.R).toBeCloseTo(0.02 * d.Vr, 6) // no front rolling resistance on the rig
  })
})
