import { describe, expect, it } from 'vitest'
import { governorRegulation } from './engine'
import {
  TYPICAL_CARB,
  TYPICAL_COOLING,
  TYPICAL_GOVERNED_ENGINE as E,
  TYPICAL_GOVERNOR as G,
  carburettor,
  coolingFlows,
  coolingSteady,
  designGovernor,
  dustConcentration,
  governorStability,
  governorSteady,
  governorStep,
  heatToCoolant,
  lubeOperatingPoint,
  oilViscosity,
  routh,
  type CoolingInputs,
} from './engineSystems'

describe('air intake — TB §4.3 dust above the dashboard', () => {
  it('0.565 g/m³ at the dashboard, 0.283 at +45 cm, 0.141 at +74 cm', () => {
    expect(dustConcentration(0)).toBeCloseTo(0.565, 3)
    expect(dustConcentration(0.45)).toBeCloseTo(0.283, 3)
    expect(dustConcentration(0.74)).toBeCloseTo(0.141, 3)
    expect(dustConcentration(0.2)).toBeLessThan(0.565)
  })
})

describe('governor — Supp regulation R = (N1 − N2)/((N1 + N2)/2)', () => {
  const d = designGovernor(G, E, { noLoadRpm: 1600, fullLoadRpm: 1500, fullLoadTorque: 220 })
  const set = { k: d.k, s0: d.s0, c: 200 }
  it('Supp example 1600 / 1500 rpm → 6.45 %', () => {
    expect(governorRegulation(1600, 1500)).toBeCloseTo(6.45, 2)
  })
  it('the designed flyweight governor holds 1600 rpm at no load and 1500 rpm at full load (6.45 %)', () => {
    const n1 = governorSteady(G, E, { ...set, load: 0 }).rpm
    const n2 = governorSteady(G, E, { ...set, load: 220 }).rpm
    expect(n1).toBeCloseTo(1600, 0)
    expect(n2).toBeCloseTo(1500, 0)
    expect(governorRegulation(n1, n2)).toBeCloseTo(6.45, 1)
  })
  it('ODE: a full-load step droops the speed and settles at the full-load speed', () => {
    let st = { w: (1600 * Math.PI) / 30, x: d.x1, v: 0 }
    let min = Infinity
    for (let t = 0; t < 3; t += 0.01) {
      st = governorStep(G, E, { ...set, load: 220 }, st, 0.01)
      min = Math.min(min, (st.w * 30) / Math.PI)
    }
    expect(min).toBeLessThan(1500)
    expect((st.w * 30) / Math.PI).toBeCloseTo(1500, 0)
  })
  it('low sleeve damping makes the loop unstable (hunting); Routh agrees with the critical damping', () => {
    const s = governorStability(G, E, { ...set, load: 0 })
    expect(s.stable).toBe(true)
    expect(governorStability(G, E, { ...set, c: 0.5 * s.cCrit, load: 0 }).stable).toBe(false)
    expect(governorStability(G, E, { ...set, c: 1.2 * s.cCrit, load: 0 }).stable).toBe(true)
  })
  it('ODE: below the critical damping the speed hunts (sustained swing of tens of rpm)', () => {
    const c = 0.15 * governorStability(G, E, { ...set, load: 0 }).cCrit
    let st = { w: (1600 * Math.PI) / 30 + 1, x: d.x1, v: 0 }
    let lo = Infinity
    let hi = 0
    for (let t = 0; t < 4; t += 0.005) {
      st = governorStep(G, E, { ...set, c, load: 0 }, st, 0.005)
      if (t > 3) {
        lo = Math.min(lo, (st.w * 30) / Math.PI)
        hi = Math.max(hi, (st.w * 30) / Math.PI)
      }
    }
    expect(hi - lo).toBeGreaterThan(20)
  })
  it('Routh–Hurwitz examples (AEE518 LN): D³+4D²+8D+12 stable; 2D³+4D²+4D+12 and 7D⁴+3D³+8D²+5D+9 unstable', () => {
    expect(routh([1, 4, 8, 12]).stable).toBe(true)
    expect(routh([2, 4, 4, 12]).stable).toBe(false)
    expect(routh([7, 3, 8, 5, 9]).stable).toBe(false)
    expect(routh([1, 6, 11, 6, 5]).stable).toBe(true)
    expect(routh([1, 6, 11, 6, 12]).stable).toBe(false)
  })
})

describe('lubrication — TB Fig 6.2 force-feed circuit (numbers beyond notes)', () => {
  const base = { grade: 'SAE30' as const, reliefBar: 3.5, filterClog: 1, wear: 1 }
  it('oil thins as it warms; a multigrade is thinner cold than a straight 50', () => {
    expect(oilViscosity('SAE30', 40)).toBeCloseTo(100, 0)
    expect(oilViscosity('SAE30', 100)).toBeCloseTo(11.2, 1)
    expect(oilViscosity('20W50', 0)).toBeLessThan(oilViscosity('SAE50', 0))
  })
  it('relief valve opens above its setting and returns oil to the sump', () => {
    const low = lubeOperatingPoint({ ...base, rpm: 800, tempC: 90 })
    const high = lubeOperatingPoint({ ...base, rpm: 2200, tempC: 90 })
    expect(low.reliefFlow).toBe(0)
    expect(high.reliefFlow).toBeGreaterThan(0)
    expect(high.pumpBar).toBeLessThan(3.5 + 0.6)
  })
  it('hot thin oil at idle gives low pressure; worn bearings lower it further', () => {
    const hot = lubeOperatingPoint({ ...base, rpm: 600, tempC: 120 })
    expect(hot.galleryBar).toBeLessThan(1.2)
    expect(lubeOperatingPoint({ ...base, rpm: 600, tempC: 120, wear: 2 }).galleryBar).toBeLessThan(hot.galleryBar)
  })
})

describe('cooling — L4 operating range 60–93 °C; Supp heat balance 40/30/30', () => {
  const inp: CoolingInputs = { mode: 'forced', load: 0.8, rpm: 2000, ambientC: 30, capKPa: 90, thermostat: 'none', beltSlip: 0, scale: 0, fan: true }
  it('30 % to the coolant with 30 % useful work: coolant heat equals brake + friction power', () => {
    expect(heatToCoolant(TYPICAL_COOLING, 1, 2000)).toBeCloseTo(44e3, -2)
  })
  it('forced circulation and thermosiphon settle inside 60–93 °C, heat in = heat out', () => {
    for (const mode of ['forced', 'thermosiphon'] as const) {
      const s = coolingSteady(TYPICAL_COOLING, { ...inp, mode })
      expect(s.Te).toBeGreaterThan(60)
      expect(s.Te).toBeLessThan(93)
      const f = coolingFlows(TYPICAL_COOLING, { ...inp, mode }, s)
      expect(f.toAir).toBeCloseTo(f.heat, -2)
    }
  })
  it('faults: stuck-shut thermostat boils at the cap temperature; scale and a slack belt run hotter', () => {
    const ok = coolingSteady(TYPICAL_COOLING, inp).Te
    expect(coolingSteady(TYPICAL_COOLING, { ...inp, thermostat: 'stuck-shut' }).Te).toBeCloseTo(118.9, 0)
    expect(coolingSteady(TYPICAL_COOLING, { ...inp, scale: 0.8 }).Te).toBeGreaterThan(ok + 10)
    expect(coolingSteady(TYPICAL_COOLING, { ...inp, beltSlip: 0.5 }).Te).toBeGreaterThan(ok)
  })
})

describe('carburettor — TB §4.4: about 1 : 15 by weight (venturi model beyond notes)', () => {
  it('part and full throttle give ≈ 15 : 1; full choke is very rich', () => {
    for (const throttle of [0.3, 0.5, 1]) {
      const r = carburettor(TYPICAL_CARB, { rpm: 2000, throttle, choke: 0 })
      expect(r.af).toBeGreaterThan(14)
      expect(r.af).toBeLessThan(16)
    }
    expect(carburettor(TYPICAL_CARB, { rpm: 200, throttle: 0.1, choke: 1 }).strength).toBe('very rich')
  })
  it('a low float level (more lift) leans the mixture', () => {
    const a = carburettor(TYPICAL_CARB, { rpm: 2000, throttle: 0.5, choke: 0 })
    const b = carburettor(TYPICAL_CARB, { rpm: 2000, throttle: 0.5, choke: 0, levelError: -0.004 })
    expect(b.af).toBeGreaterThan(a.af)
  })
})
