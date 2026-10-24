import { describe, expect, it } from 'vitest'
import {
  HEAT_BALANCE_SUPP,
  HEAT_BALANCE_TB,
  airDensity,
  bmepFromTorque,
  brakeThermalEfficiency,
  crankAngleForTravel,
  cylinderCycleAngle,
  displacementForTorque,
  frictionPower,
  fuelRateForPower,
  heatBalance,
  imepFromBmep,
  indicatedFromBrake,
  indicatedThermalEfficiency,
  lubeCircuit,
  sfc,
  squareBore,
  strokeAt,
  throwAngle,
  torqueFromPower,
  type LubeInput,
  TYPICAL_DIESEL_TIMING,
  bmep,
  brakePower,
  compressionRatio,
  firingAngles,
  firingInterval,
  governorRegulation,
  pinHeight,
  pistonFromTDC,
  pistonVelocity,
  sweptVolume,
  valveLifts,
  valveOverlapDeg,
  volumeFraction,
} from './engine'

describe('engine geometry — textbook extract (509) p9', () => {
  it('100 × 124 mm engine, CV = PD/6 → PD = 973 400 mm³, TCV = 1 135 633 mm³, CR = 7.0', () => {
    const PD = sweptVolume(100, 124) // mm³
    expect(PD).toBeCloseTo(973_850, -3) // π/4·100²·124 = 973 894 (notes round π)
    const CV = PD / 6
    expect(PD + CV).toBeCloseTo(1_136_210, -3)
    expect(compressionRatio(PD, CV)).toBeCloseTo(7.0, 9)
  })
})

describe('slider-crank', () => {
  const sc = { r: 0.062, l: 0.22 }
  it('TDC/BDC positions and stroke', () => {
    expect(pinHeight(sc, 0)).toBeCloseTo(0.282, 9)
    expect(pinHeight(sc, Math.PI)).toBeCloseTo(0.158, 9)
    expect(pistonFromTDC(sc, Math.PI)).toBeCloseTo(0.124, 9)
  })
  it('volume fraction spans 1/r … 1', () => {
    expect(volumeFraction(sc, 0, 17)).toBeCloseTo(1 / 17, 9)
    expect(volumeFraction(sc, Math.PI, 17)).toBeCloseTo(1, 9)
  })
  it('velocity matches numerical derivative', () => {
    const w = 100
    const th = 1.1
    const h = 1e-6
    const num = ((pistonFromTDC(sc, th + h) - pistonFromTDC(sc, th - h)) / (2 * h)) * w
    expect(pistonVelocity(sc, th, w)).toBeCloseTo(num, 6)
  })
})

describe('performance — Misc. Exercises', () => {
  it('BP = 2πNT/60: 2000 rpm × 65 N·m = 13.6 kW (AEE510 2022/23 Q3c)', () => {
    expect(brakePower(2000, 65) / 1000).toBeCloseTo(13.6, 1)
  })
  it('Ex 4: 8-cyl 100×120 mm, 3000 rpm, BP 167.3 kW → bmep ≈ 887 kPa', () => {
    const A = (Math.PI / 4) * 0.1 ** 2
    expect(bmep(167_300, 0.12, A, 3000, 8, 4) / 1000).toBeCloseTo(887.5, -1)
  })
  it('governor regulation 1600/1500 rpm = 6.45 % (Supp.)', () => {
    expect(governorRegulation(1600, 1500)).toBeCloseTo(6.45, 2)
  })
})

describe('firing order & valve timing', () => {
  it('firing interval 720/n', () => {
    expect(firingInterval(4)).toBe(180)
    expect(firingInterval(6)).toBe(120)
  })
  it('1-5-3-6-2-4 assigns 120° steps', () => {
    const m = firingAngles([1, 5, 3, 6, 2, 4])
    expect(m.get(1)).toBe(0)
    expect(m.get(3)).toBe(240)
    expect(m.get(4)).toBe(600)
  })
  it('valve events', () => {
    const vt = TYPICAL_DIESEL_TIMING
    expect(valveLifts(90, vt).inlet).toBeGreaterThan(0.009)
    expect(valveLifts(90, vt).exhaust).toBe(0)
    expect(valveLifts(400, vt).inlet).toBe(0)
    expect(valveLifts(400, vt).exhaust).toBe(0)
    expect(valveLifts(630, vt).exhaust).toBeGreaterThan(0.009)
    // overlap around TDC: both slightly open
    expect(valveLifts(0, vt).inlet).toBeGreaterThan(0)
    expect(valveLifts(0, vt).exhaust).toBeGreaterThan(0)
    expect(valveOverlapDeg(vt)).toBe(30)
  })
})

/* ---------------------- additions: performance worked examples (Misc. Exercises) ---------------------- */

describe('performance — Misc. Exercises p4–7 (handwritten pages 4–6)', () => {
  it('Ex 1: 2500 kW, ηth 0.30, HV 40 MJ/kg → ṁf = 12.5 kg/min, ṁa = 187.5 kg/min, sfc 0.3 kg/kWh, sac 4.5 kg/kWh', () => {
    const mf = fuelRateForPower(2500e3, 40e6, 0.3) // kg/s
    expect(mf * 60).toBeCloseTo(12.5, 6)
    expect(mf * 60 * 15).toBeCloseTo(187.5, 6)
    const s = sfc(mf * 3600, 2500)
    expect(s).toBeCloseTo(0.3, 6)
    expect(s * 15).toBeCloseTo(4.5, 6)
  })
  it('Ex 2: same engine, Vs = 0.07 m³ at 2000 rpm, ηm 0.8 → bmep 2142.9 kPa, imep 2678.6 kPa', () => {
    const T = torqueFromPower(2500e3, 2000)
    const b = bmepFromTorque(T, 0.07, 4)
    expect(b / 1000).toBeCloseTo(2142.9, 1)
    expect(imepFromBmep(b, 0.8) / 1000).toBeCloseTo(2678.6, 1)
  })
  it('Ex 3: η 0.25, 195 kg/min air, F/A = 0.9 stoichiometric → BP ≈ 1950 kW', () => {
    const mf = 195 / (15 / 0.9) / 60 // kg/s
    expect(mf * 60).toBeCloseTo(11.7, 1)
    expect((0.25 * mf * 40e6) / 1000).toBeCloseTo(1950, -1)
  })
  it('Ex 4: 8-cyl SI 100 × 120 mm, 3000 rpm, ηv 0.85, ηbth 0.3, A/F 15, 45 MJ/kg, 100 kPa 300 K → BP 167.3 kW, bmep 887.5 kPa', () => {
    const rho = airDensity(100e3, 300)
    expect(rho).toBeCloseTo(1.16, 2)
    const Vd = 8 * (Math.PI / 4) * 0.1 ** 2 * 0.12
    const swept = (Vd * 3000) / 2 // m³/min
    expect(swept).toBeCloseTo(11.31, 2)
    const ma = rho * swept * 0.85 // kg/min
    expect(ma).toBeCloseTo(11.15, 1)
    const bp = (0.3 * (ma / 15) * 45e6) / 60
    expect(bp / 1000).toBeCloseTo(167.3, 0)
    expect((bp * 60) / swept / 1000).toBeCloseTo(887.5, -1)
  })
  it('Ex 5: two-stroke mower 4.68 kW, ηm 0.85, 2.4 L/h petrol (760 kg/m³), 44 MJ/kg → IP 5.506 kW, ηith 24.7 %, ηv 0.709', () => {
    const ip = indicatedFromBrake(4.68e3, 0.85)
    expect(ip / 1000).toBeCloseTo(5.506, 3)
    const mf = (2.4e-3 * 760) / 3600
    expect(mf * 3600).toBeCloseTo(1.824, 3)
    expect(indicatedThermalEfficiency(ip, mf, 44e6)).toBeCloseTo(0.247, 3)
    // one cycle per revolution: air volume per cycle at 1 bar, 298 K
    const maPerMin = (mf * 3600 * 15) / 60
    const vPerCycle = maPerMin / 5500 / airDensity(1e5, 298)
    expect(vPerCycle * 1e6).toBeCloseTo(70.9, 1)
    expect(vPerCycle / 100e-6).toBeCloseTo(0.709, 3)
  })
  it('Ex 6: 4-cyl SI, 160 N·m at bmep 950 kPa → Vs = 2.116 L, D = L = 87.65 mm; 825 kPa at 5000 rpm → 72.7 kW', () => {
    const Vd = displacementForTorque(160, 950e3, 4)
    expect(Vd * 1e3).toBeCloseTo(2.116, 3)
    expect(squareBore(Vd / 4) * 1000).toBeCloseTo(87.65, 1)
    expect((825e3 * Vd * 5000) / 120 / 1000).toBeCloseTo(72.73, 1)
  })
  it('Ex 7: 8-cyl 100 × 120 mm, Vc 90 cc, 20 kg/h, 160 N·m at 4500 rpm, 44 MJ/kg → CR 11.47, BP 75.4 kW, bmep 2.667 bar, ηbth 30.85 %', () => {
    const Vs = (Math.PI / 4) * 10 ** 2 * 12 // cm³
    expect(Vs).toBeCloseTo(942.5, 1)
    expect(compressionRatio(Vs, 90)).toBeCloseTo(11.47, 2)
    const bp = brakePower(4500, 160)
    expect(bp / 1000).toBeCloseTo(75.4, 1)
    const A = (Math.PI / 4) * 0.1 ** 2
    expect(bmep(bp, 0.12, A, 4500, 8, 4) / 1e5).toBeCloseTo(2.667, 3)
    expect(brakeThermalEfficiency(bp, 20 / 3600, 44e6)).toBeCloseTo(0.3085, 3)
  })
  it('Exam 2022/23 Q2 genset: 8-cyl, A 0.25 m², L 0.3 m, TCV 0.1 m³, 3000 kW at 2000 rpm, ηm 75 % → Vc 0.025 m³, bmep 300 kPa, imep 400 kPa', () => {
    const Vs = 0.25 * 0.3
    expect(0.1 - Vs).toBeCloseTo(0.025, 9)
    const b = bmep(3000e3, 0.3, 0.25, 2000, 8, 4)
    expect(b / 1000).toBeCloseTo(300, 6)
    expect(imepFromBmep(b, 0.75) / 1000).toBeCloseTo(400, 6)
    expect(frictionPower(indicatedFromBrake(3000e3, 0.75), 3000e3) / 1000).toBeCloseTo(1000, 6)
  })
  it('heat balance shares — Supp (40/30/30) and TB §3.3 (31/40/5.5/23.5)', () => {
    const hb = heatBalance(100, 30, 30, HEAT_BALANCE_SUPP)
    expect(hb.exhaust).toBeCloseTo(40, 9)
    expect(hb.cooling).toBeCloseTo(30, 9)
    const tb = heatBalance(100, 23.5, 29, HEAT_BALANCE_TB)
    expect(tb.exhaust + tb.cooling + tb.brake + tb.friction).toBeCloseTo(100, 9)
    expect(tb.exhaust / tb.cooling).toBeCloseTo(31 / 40, 9)
  })
})

describe('slider-crank inverse (two-stroke port timing)', () => {
  const sc = { r: 0.025, l: 0.1 }
  it('crankAngleForTravel inverts pistonFromTDC', () => {
    for (const th of [0.3, 1.2, 1.83, 2.6]) expect(crankAngleForTravel(sc, pistonFromTDC(sc, th))).toBeCloseTo(th, 8)
    expect(crankAngleForTravel(sc, 0)).toBe(0)
    expect(crankAngleForTravel(sc, 0.06)).toBeCloseTo(Math.PI, 9)
  })
})

describe('firing chart — TB §2.6.4, Table 2.3; 509 Lecture 4', () => {
  it('4-cyl 1-3-4-2: pistons 1 & 4 and 2 & 3 share throws 180° apart', () => {
    const a = firingAngles([1, 3, 4, 2])
    expect(throwAngle(a.get(1)!)).toBe(throwAngle(a.get(4)!))
    expect(throwAngle(a.get(2)!)).toBe(throwAngle(a.get(3)!))
    expect(Math.abs(throwAngle(a.get(1)!) - throwAngle(a.get(2)!))).toBe(180)
  })
  it('as cylinder 1 fires, 1-3-4-2 puts 3 on compression, 4 on intake, 2 on exhaust', () => {
    const a = firingAngles([1, 3, 4, 2])
    const s = (c: number) => strokeAt(cylinderCycleAngle(0.5, a.get(c)!))
    expect(s(1)).toBe('power')
    expect(s(3)).toBe('compression')
    expect(s(4)).toBe('intake')
    expect(s(2)).toBe('exhaust')
  })
  it('6-cyl 1-5-3-6-2-4: throws 1&6, 2&5, 3&4 paired', () => {
    const a = firingAngles([1, 5, 3, 6, 2, 4])
    expect(throwAngle(a.get(1)!)).toBe(throwAngle(a.get(6)!))
    expect(throwAngle(a.get(2)!)).toBe(throwAngle(a.get(5)!))
    expect(throwAngle(a.get(3)!)).toBe(throwAngle(a.get(4)!))
  })
  it('8-cyl 1-7-5-3-8-6-2-4 (exam 2022/23 Q2): 90° interval, power strokes overlap two at a time', () => {
    expect(firingInterval(8)).toBe(90)
    const a = firingAngles([1, 7, 5, 3, 8, 6, 2, 4])
    for (let th = 1; th < 720; th += 7) {
      const power = [...a.values()].filter((f) => strokeAt(cylinderCycleAngle(th, f)) === 'power').length
      expect(power).toBe(2)
    }
  })
})

describe('force-feed lubrication circuit — TB Fig 6.2', () => {
  const base: LubeInput = {
    rpm: 2000,
    pumpDisp: 10e-6,
    pumpRatio: 0.5,
    pumpEff: 0.9,
    bearingG: 2.6e-10,
    viscosity: 1,
    filterR: 2e8,
    filterClog: 1,
    reliefCrack: 400e3,
    reliefK: 2e-9,
    reliefFull: 120e3,
  }
  it('flow is conserved: pump = bearings + relief', () => {
    for (const rpm of [600, 1500, 2500]) {
      const s = lubeCircuit({ ...base, rpm, viscosity: 3 })
      expect((s.bearingFlow + s.reliefFlow) / s.pumpFlow).toBeCloseTo(1, 8)
    }
  })
  it('relief valve shut at idle with hot oil; gallery pressure = Q / G', () => {
    const s = lubeCircuit({ ...base, rpm: 700 })
    expect(s.reliefFlow).toBe(0)
    expect(s.reliefOpen).toBe(0)
    expect(s.galleryPressure).toBeCloseTo(s.bearingFlow / base.bearingG, 3)
  })
  it('cold oil: the relief valve opens and caps the pump pressure near its setting', () => {
    const s = lubeCircuit({ ...base, viscosity: 4, rpm: 2500 })
    expect(s.reliefFlow).toBeGreaterThan(0)
    expect(s.pumpPressure).toBeGreaterThan(base.reliefCrack)
    expect(s.pumpPressure).toBeLessThan(base.reliefCrack + 120e3)
    const higher = lubeCircuit({ ...base, viscosity: 4, rpm: 2500, reliefCrack: 500e3 })
    expect(higher.pumpPressure).toBeGreaterThan(s.pumpPressure)
  })
  it('a clogged filter lowers gallery pressure', () => {
    expect(lubeCircuit({ ...base, filterClog: 8 }).galleryPressure).toBeLessThan(lubeCircuit(base).galleryPressure)
  })
})
