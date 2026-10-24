import { describe, expect, it } from 'vitest'
import { firingAngles, pistonFromTDC } from './engine'
import {
  LEAD_ACID,
  LEAD_ACID_AS_PRINTED,
  crankBalance,
  dominantStroke,
  enginePerformance,
  firingChart,
  firingGaps,
  impulseCoupling,
  lettersToOrder,
  petroilPercent,
  petroilRatio,
  pointsClosed,
  portDurations,
  portTiming,
  powerOverlap,
  reactionBalance,
  sparkAngles,
  tbPowerChain,
  throwAngles,
  trappedCompressionRatio,
  twoStrokeState,
  volumetricEfficiencyFromAir,
} from './engineExtra'
import { HEAT_BALANCE_SUPP } from './engine'
import { AIR, airStandardCycle, alphaFromPmax } from './thermo'

const firing = (order: number[]) => {
  const m = firingAngles(order)
  return order.map((_, i) => m.get(i + 1)!)
}

describe('two-stroke ports (TB Fig 2.4; timing computed from port heights — beyond notes)', () => {
  const sc = { r: 0.0255, l: 0.1 }
  const ports = { exhaustTop: pistonFromTDC(sc, (100 * Math.PI) / 180), exhaustHeight: 0.016, transferTop: pistonFromTDC(sc, (120 * Math.PI) / 180), transferHeight: 0.01, inletTravel: pistonFromTDC(sc, Math.PI / 3), inletHeight: 0.012 }
  it('port heights map back to their crank angles, symmetric about BDC / TDC', () => {
    const t = portTiming(sc, ports)
    expect(t.eo).toBeCloseTo(100, 6)
    expect(t.ec).toBeCloseTo(260, 6)
    expect(t.to).toBeCloseTo(120, 6)
    expect(t.io).toBeCloseTo(300, 6)
    const d = portDurations(t)
    expect(d.blowdown).toBeCloseTo(20, 6)
    expect(d.afterTransfer).toBeCloseTo(20, 6)
    expect(d.inlet).toBeCloseTo(120, 6)
  })
  it('trapped CR is below the geometric CR', () => {
    const Vs = 100e-6
    const Vc = Vs / 7
    expect(trappedCompressionRatio(Vs, Vc, ports.exhaustTop, 2 * sc.r)).toBeLessThan(8)
  })
  it('crankcase is pre-compressed before the transfer opens and in suction before the inlet opens', () => {
    expect(twoStrokeState(118, sc, ports).pCase).toBeGreaterThan(110)
    expect(twoStrokeState(298, sc, ports).pCase).toBeLessThan(95)
    expect(twoStrokeState(2, sc, ports).pCyl).toBeGreaterThan(2000)
  })
  it('Misc Ex 5: lawn-mower two-stroke, 27.36 kg/h air, 100 cc, 5500 rpm, 1 bar 298 K → ηv = 0.709', () => {
    expect(volumetricEfficiencyFromAir(1.824 * 15, 1e5 / (287 * 298), 100e-6, 5500, 2)).toBeCloseTo(0.709, 3)
  })
  it('petroil: TB §6.3.3 16:1 and 24:1; AddN 2–3 % ≙ 50:1–33:1', () => {
    expect(petroilPercent(16)).toBeCloseTo(6.25, 9)
    expect(petroilPercent(24)).toBeCloseTo(4.167, 3)
    expect(petroilRatio(2)).toBe(50)
    expect(petroilRatio(3)).toBeCloseTo(33.3, 1)
  })
})

describe('firing chart — TB §2.6.4, Table 2.3, Q12; 509 Lecture 4', () => {
  it('TB Table 2.3: cylinder 1 runs Power, Exhaust, Intake, Compression; Q12 fills 1-3-4-2', () => {
    const rows = firingChart(firing([1, 3, 4, 2]), 180)
    expect(rows.map((r) => dominantStroke(r.cells[0]))).toEqual(['power', 'exhaust', 'intake', 'compression'])
    expect(rows[0].cells.map(dominantStroke)).toEqual(['power', 'exhaust', 'compression', 'intake'])
    expect(rows.map((r) => r.fires)).toEqual([[1], [3], [4], [2]])
  })
  it('6-cyl 1-6-3-5-2-4 (exam 2021/22 Q3b): 120° interval, 1–2 cylinders on power, cells split at 60°', () => {
    const f = firing([1, 6, 3, 5, 2, 4])
    expect(firingGaps(f)).toEqual([120, 120, 120, 120, 120, 120])
    expect(powerOverlap(f)).toEqual({ min: 1, max: 2 })
    const rows = firingChart(f, 120)
    expect(rows[0].cells[0]).toEqual([{ stroke: 'power', from: 0, to: 120 }])
    expect(rows[1].cells[0].map((s) => s.stroke)).toEqual(['power', 'exhaust'])
  })
  it('exam 2017/18: A-D-C-B-F-E = 1-4-3-2-6-5', () => {
    expect(lettersToOrder('A-D-C-B-F-E')).toEqual([1, 4, 3, 2, 6, 5])
  })
  it('8-cyl 1-7-5-3-8-6-2-4 (exam 2022/23 Q2): always two on power', () => {
    expect(powerOverlap(firing([1, 7, 5, 3, 8, 6, 2, 4]))).toEqual({ min: 2, max: 2 })
  })
  it('balance (beyond notes): 6-cyl 1-5-3-6-2-4 fully balanced; 4-cyl flat crank leaves secondary force', () => {
    const z6 = [0, 1, 2, 3, 4, 5].map((i) => -i * 0.1)
    const b6 = crankBalance(throwAngles(firing([1, 5, 3, 6, 2, 4])), z6, 0.1)
    for (const v of Object.values(b6)) expect(v).toBeLessThan(1e-9)
    const b4 = crankBalance(throwAngles(firing([1, 3, 4, 2])), [0, -0.1, -0.2, -0.3], 0.1)
    expect(b4.primaryForce).toBeLessThan(1e-9)
    expect(b4.primaryCouple).toBeLessThan(1e-9)
    expect(b4.secondaryForce).toBeCloseTo(1, 9)
  })
})

describe('ignition — L4, TB ch.5', () => {
  it('sparks 25° BTDC (TB §5.5) in firing order 1-3-4-2', () => {
    expect(sparkAngles(firing([1, 3, 4, 2]), 25)).toEqual([695, 515, 155, 335])
  })
  it('4-corner breaker cam (L4): points open every 90° of cam', () => {
    expect(pointsClosed(80, 4, 0.6)).toBe(true)
    expect(pointsClosed(10, 4, 0.6)).toBe(false)
    expect(pointsClosed(170, 4, 0.6)).toBe(true)
  })
  it('impulse coupling (TB Fig 5.3): rotor held, snaps, then follows — continuous', () => {
    let prev = impulseCoupling(0, 100).rotorDeg
    for (let d = 0.25; d < 400; d += 0.25) {
      const r = impulseCoupling(d, 100).rotorDeg
      expect(r).toBeGreaterThanOrEqual(prev - 1e-9)
      expect(r - prev).toBeLessThan(15)
      prev = r
    }
    expect(impulseCoupling(10, 100).phase).toBe('wind-up')
    expect(impulseCoupling(10, 1000).phase).toBe('solid')
  })
  it('TB p31 battery reaction as printed (… = 2PbSO4 + H2O) is unbalanced; 2H2O balances it', () => {
    expect(reactionBalance(LEAD_ACID_AS_PRINTED.lhs, LEAD_ACID_AS_PRINTED.rhs).balanced).toBe(false)
    expect(reactionBalance(LEAD_ACID.lhs, LEAD_ACID.rhs).balanced).toBe(true)
  })
})

describe('performance calculator — exam papers, Misc Exercises, TB', () => {
  const base = { cylinders: 1, cycle: 4 as const, rpm: 2000, hv: 44e6, pAmb: 100e3, TAmb: 300, output: { kind: 'bp' as const, value: 60e3 } }
  it('exam 2017/18 Q2b Mahindra 100 × 124 mm, CV = PD/6 → PD 973 894 mm³ (notes 973 400 with π = 3.14), CR 7', () => {
    const r = enginePerformance({ ...base, bore: 0.1, stroke: 0.124, clearance: { kind: 'pdFraction', value: 1 / 6 } })
    expect(r.PD * 1e9).toBeCloseTo(973_894, -1)
    expect(r.TCV * 1e9).toBeCloseTo(1_136_210, -1)
    expect(r.CR).toBeCloseTo(7, 9)
  })
  it('exam 2021/22 Q3b: 6-cyl SI, 100 × 125 mm, CV = Vs/8 → CR 9, Otto ASE 58.5 %', () => {
    const r = enginePerformance({ ...base, cylinders: 6, bore: 0.1, stroke: 0.125, clearance: { kind: 'pdFraction', value: 1 / 8 } })
    expect(r.PD * 1e6).toBeCloseTo(981.7, 1)
    expect(r.TCV * 1e6).toBeCloseTo(1104.5, 1)
    expect(r.CR).toBeCloseTo(9, 9)
    expect(1 - 1 / Math.pow(r.CR, 0.4)).toBeCloseTo(0.585, 3)
  })
  it('TB Q9: two-cylinder 100 × 130 mm, CV = TCV/5 → CR 5', () => {
    const r = enginePerformance({ ...base, cylinders: 2, bore: 0.1, stroke: 0.13, clearance: { kind: 'tcvFraction', value: 0.2 } })
    expect(r.Vd * 1e6).toBeCloseTo(2042, 0)
    expect(r.CR).toBeCloseTo(5, 9)
  })
  it('exam 2022/23 Q2 genset (A 0.25 m², L 0.3 m, TCV 0.1 m³, 3000 kW, 2000 rpm, ηm 75 %) → Vc 0.025 m³, bmep 300 kPa, imep 400 kPa', () => {
    const r = enginePerformance({ ...base, cylinders: 8, bore: 0, area: 0.25, stroke: 0.3, clearance: { kind: 'tcv', value: 0.1 }, output: { kind: 'bp', value: 3000e3 }, losses: { kind: 'etaM', value: 0.75 } })
    expect(r.CV).toBeCloseTo(0.025, 9)
    expect(r.bmep! / 1000).toBeCloseTo(300, 6)
    expect(r.imep! / 1000).toBeCloseTo(400, 6)
    expect(r.fp! / 1000).toBeCloseTo(1000, 6)
  })
  it('Misc Ex 4 (air → fuel → BP path): 8-cyl 100 × 120, 3000 rpm, ηv 0.85, A/F 15, ηbth 0.3, 45 MJ/kg → 167.3 kW, 887.5 kPa', () => {
    const r = enginePerformance({ ...base, cylinders: 8, bore: 0.1, stroke: 0.12, rpm: 3000, hv: 45e6, clearance: { kind: 'cr', value: 8 }, output: { kind: 'fuel', etaBth: 0.3 }, air: { kind: 'etaV', value: 0.85 }, fuel: { kind: 'fromAir' }, airFuel: 15 })
    expect(r.bp! / 1000).toBeCloseTo(167.3, 0)
    expect(r.bmep! / 1000).toBeCloseTo(887.5, -1)
    expect(r.missing).toEqual([])
  })
  it('Misc Ex 7 (torque path): 8-cyl 100 × 120, Vc 90 cc, 160 N·m at 4500 rpm, 20 kg/h, 44 MJ/kg → CR 11.47, 75.4 kW, 2.667 bar, 30.85 %', () => {
    const r = enginePerformance({ ...base, cylinders: 8, bore: 0.1, stroke: 0.12, rpm: 4500, clearance: { kind: 'cv', value: 90e-6 }, output: { kind: 'torque', value: 160 }, fuel: { kind: 'rate', kgPerH: 20 } })
    expect(r.CR).toBeCloseTo(11.47, 2)
    expect(r.bp! / 1000).toBeCloseTo(75.4, 1)
    expect(r.bmep! / 1e5).toBeCloseTo(2.667, 3)
    expect(r.etaBth!).toBeCloseTo(0.3085, 3)
  })
  it('exam 2022/23 Q3 orchard tractor: 4-cyl 100 × 120, 300 rpm, 160 N·m; Otto mep → IP, BP 5.03 kW, FP', () => {
    const r = 10
    const c = airStandardCycle({ kind: 'otto', r, P1: 105, T1: 295, alpha: alphaFromPmax(8902, r, 105, AIR), delta: 1 })
    const res = enginePerformance({ ...base, cylinders: 4, bore: 0.1, stroke: 0.12, rpm: 300, clearance: { kind: 'cr', value: r }, output: { kind: 'torque', value: 160 }, losses: { kind: 'imep', value: c.mep * 1000 }, shares: HEAT_BALANCE_SUPP })
    expect(res.bp! / 1000).toBeCloseTo(5.027, 3)
    expect(c.mep).toBeCloseTo(1048, -1) // errata 'otto-cv': the notes' Cv = 0.778 gives 1135.7 kPa
    expect(res.ip! / 1000).toBeCloseTo(9.88, 1)
    expect(res.fp! / 1000).toBeCloseTo(4.85, 1)
  })
  it('Misc Ex 6 (bmep path): 4-cyl SI, D = L = 87.65 mm, 825 kPa at 5000 rpm → 72.7 kW', () => {
    const r = enginePerformance({ ...base, cylinders: 4, bore: 0.08765, stroke: 0.08765, rpm: 5000, clearance: { kind: 'cr', value: 9 }, output: { kind: 'bmep', value: 825e3 } })
    expect(r.Vd * 1e3).toBeCloseTo(2.116, 2) // D rounded to 87.65 mm in the notes
    expect(r.bp! / 1000).toBeCloseTo(72.73, 1)
  })
  it('TB §3.3: 100 − 76.5 = 23.5 % at the PTO, 19 % at the drawbar', () => {
    expect(tbPowerChain()).toEqual({ pto: 23.5, drawbar: 19 })
  })
})
