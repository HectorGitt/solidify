import { describe, expect, it } from 'vitest'
import {
  acresFromGpm,
  augerStorage,
  blaneyCriddle,
  christiansen,
  designTerrace,
  designTrapezoid,
  hoursPerWeek,
  irrigableArea,
  jensenHaise,
  linearProfileEd,
  manningV,
  normalDepth,
  pondNeeds,
  pondStorage,
  requiredGpm,
  satVapourMb,
  sectionFromArea,
  storedFromMoisture,
  surfaceEvent,
  twoWellUnconfined,
  unconfinedHead,
  unconfinedQ,
  usle,
  usleM,
  usleS,
  wellDrawdown,
  windMode,
} from './water'

const near = (a: number, b: number, rel = 0.005) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(rel)

describe('consumptive use (IPP p12 Problem 1: Ile-Ife, July 1989, maize)', () => {
  const bc = blaneyCriddle({ T: 21.2, p: 8.75, kc: 1.06 })
  it('SCS Blaney–Criddle: K_t = 0.899, f = 156.5, ET ≈ 149 mm/month', () => {
    near(bc.Kt, 0.899, 0.001)
    near(bc.f, 156.5, 0.001)
    near(bc.ET, 149, 0.005)
  })
  it('adjusted form (1.49 − 0.01·84 = 0.65) gives ≈ 97 mm/month', () => {
    near(blaneyCriddle({ T: 21.2, p: 8.75, kc: 1.06, RH: 84 }).ET, 97, 0.005)
  })
  it('saturated vapour pressure formula gives ≈ 23.4 mb at 20 °C', () => near(satVapourMb(20), 23.4, 0.01))
  it('Jensen–Haise gives a plausible ET for the same month', () => {
    const jh = jensenHaise({ T: 21.2, Rs: 549, Tmax: 30.8, Tmin: 15.6, E: 540 })
    expect(jh.ETmm).toBeGreaterThan(4)
    expect(jh.ETmm).toBeLessThan(7)
  })
})

describe('irrigation efficiencies (S1 Q3c, S2 Q2c, IPP p12 #5)', () => {
  const ev = surfaceEvent({ Qsource: 0.175, Qfield: 0.105, hours: 8, area: 20000, Qrunoff: 0.05, runoffHours: 3, dHead: 1.8, dTail: 1.2, root: 1.8, whc: 0.2, depletion: 0.6 })
  it('E_c = 60 %, W_d = 3024 m³, runoff 540 m³', () => {
    near(ev.Ec, 0.6, 1e-6)
    near(ev.Wd, 3024, 1e-6)
    near(ev.runoff, 540, 1e-6)
  })
  it('W_s = 2484 m³ (no deep percolation), E_a = 82.1 %', () => {
    near(ev.Ws, 2484, 1e-6)
    near(ev.Ea, 0.821, 0.001)
  })
  it('W_n = 4320 m³, E_s = 57.5 % (60 % depletion); 69 % at 50 %', () => {
    near(ev.Wn, 4320, 1e-6)
    near(ev.Es, 0.575, 0.001)
    near(surfaceEvent({ Qsource: 0.175, Qfield: 0.105, hours: 8, area: 20000, Qrunoff: 0.05, runoffHours: 3, dHead: 1.8, dTail: 1.2, root: 1.8, whc: 0.2, depletion: 0.5 }).Es, 0.69, 0.001)
  })
  it('linear 1.8 → 1.2 m profile: E_d = 90 %', () => near(ev.Ed, 0.9, 1e-6))
})

describe('auger problem (S1 Q5d; IPP p12 #4)', () => {
  const depths = [0.82, 0.98, 1.1, 1.22, 1.07, 0.9, 0.85, 1.1]
  it('x̄ = 1.005, Σ|dev| = 0.94, E_d = 88.3 %', () => {
    const c = christiansen(depths)
    near(c.mean, 1.005, 1e-6)
    near(c.sumDev, 0.94, 1e-6)
    near(c.Ed, 0.883, 0.001)
  })
  it('stored mean 0.99 m, E_s = 90 %', () => {
    const s = augerStorage(depths, 1.1)
    near(s.meanStored, 0.99, 1e-6)
    near(s.Es, 0.9, 1e-6)
  })
})

describe('IPP p12 #2 and #3', () => {
  it('#2: 18 → 24 % over 0.6 m at 1201 kg/m³ stores 43.2 mm; E_a = 56.9 % of 76 mm', () => {
    const s = storedFromMoisture(0.18, 0.24, 1201, 600)
    near(s, 43.2, 0.002)
    near(s / 76, 0.569, 0.002)
  })
  it('#3: E_a = 75.3 %, E_d = 87.3 %', () => {
    const ev = surfaceEvent({ Qsource: 0.085, Qfield: 0.085, hours: 2, area: 1e4, Qrunoff: 0.042, runoffHours: 1, dHead: 1.68, dTail: 1.0, root: 1.68, whc: 0.2, depletion: 0.5 })
    near(ev.Ea, 0.753, 0.002)
    near(linearProfileEd(1.68, 1.0).Ed, 0.873, 0.001)
  })
})

describe('SG water budget exercises', () => {
  it('Ex 1: drip, 0.15 in/day on 1 acre = 28,516 gal/week; 6446 gal/h → 4.4 h/week', () => {
    const r = hoursPerWeek(0.15, 1, 0.74 * 145.2 * 60)
    near(r.gal, 28516, 0.001)
    near(r.hours, 4.4, 0.01)
  })
  it('Ex 2: sprinkler 19,800 gal/h → 1.4 h/week', () => near(hoursPerWeek(0.15, 1, 19800).hours, 1.44, 0.01))
  it('Ex 5: 10 acres, 0.30 in/day, 12 h → 141 gpm', () => near(requiredGpm(0.3, 10, 12), 141, 0.005))
  it('Ex 6: 15 gpm well, 0.20 in/day, 12 h → 1.6 acres', () => near(acresFromGpm(15, 0.2, 12), 1.6, 0.01))
})

describe('farm pond storage (WRD Table 1)', () => {
  const herd = { fire: true, steers: 1000, milkCows: 500, horses: 0, turkeys: 0, chickens: 10000, swine: 100, sheep: 0, irrDepth: 0.7 }
  it('S1 Q5c: needs 11.25 ha-m, storage 14.06 ha-m with 20 % loss', () => {
    const nd = pondNeeds({ ...herd, persons: 10, irrHa: 10 })
    near(nd.total, 11.25, 1e-6)
    near(pondStorage(nd.total, 0.2), 14.06, 0.001)
  })
  it('S2 Q5c: 7.73 → 9.66 ha-m', () => {
    const nd = pondNeeds({ ...herd, persons: 8, irrHa: 5 })
    near(nd.total, 7.73, 1e-6)
    near(pondStorage(nd.total, 0.2), 9.66, 0.001)
  })
  it('WRD PS VI 1b: 9.87 ha-m, 60 % loss, 0.61 m → 6.47 ha', () => near(irrigableArea(9.87, 0.6, 0.61), 6.47, 0.001))
})

describe('well hydraulics (WRD p6–9)', () => {
  it('S1 Q3d: Q = 324 m³/day', () => near(unconfinedQ(1.824, 24.38, 15.24, 183, 0.305), 324, 0.003))
  it('S1 Q2d: Q = 1.256 m³/s; doubling r_w gives 1.375 m³/s (+9.5 %)', () => {
    const q1 = unconfinedQ(0.05, 10, 6, 300, 0.1)
    const q2 = unconfinedQ(0.05, 10, 6, 300, 0.2)
    near(q1, 1.256, 0.001)
    near(q2, 1.375, 0.001)
    near(q2 / q1 - 1, 0.095, 0.02)
  })
  it('S1 Q4d / S2 Q4d: K = 13.5 m/day, T = 243 m²/day, s_w ≈ 8.9 m', () => {
    const r = twoWellUnconfined(1440, 18, 14, 2.62, 40, 1.5)
    near(r.K, 13.47, 0.003)
    near(r.T, 243, 0.003)
    const w = wellDrawdown(1440, r.K, 18, 14, r.h1, 0.15)
    near(w.sw, 8.93, 0.005)
  })
  it('WRD PS VI 2a: Q = 1385 m³/day', () => near(unconfinedQ(21, 15, 9, 180, 0.19), 1385, 0.002))
  it('the water-table curve reaches H at R', () => near(unconfinedHead(unconfinedQ(21, 15, 9, 180, 0.19), 21, 9, 0.19, 180), 15, 1e-6))
})

describe('waterway design by Manning (VW Fig 7.1, Eq 7.1)', () => {
  it('S1 Q2b / S2 Q2b: 5.67 m³/s → b = 2.64, d = 0.63, D = 0.73, t = 7.67, T = 8.47 m', () => {
    const r = designTrapezoid({ Q: 5.67, v: 1.75, n: 0.055, s: 0.03, Z: 4 })
    if (!r.ok) throw new Error('no solution')
    near(r.a, 3.24, 0.001)
    near(r.R, 0.414, 0.002)
    near(r.d, 0.629, 0.003)
    near(r.b, 2.64, 0.005)
    near(r.t, 7.67, 0.003)
    near(r.T, 8.47, 0.003)
  })
  it('S2 Q5d: 7.26 m³/s at 1.15 m/s → d = 0.23, b = 26.7 m', () => {
    const r = designTrapezoid({ Q: 7.26, v: 1.15, n: 0.055, s: 0.03, Z: 4 })
    if (!r.ok) throw new Error('no solution')
    near(r.d, 0.2285, 0.01)
    near(r.b, 26.7, 0.005)
  })
  it('diversion terrace (S1 Q1c): d = 0.269, D = 0.369 m, s = 1.44 %', () => {
    const r = designTerrace({ Q: 0.85, v: 0.9, n: 0.046, b: 2.44, Z: 4 })
    near(r.d, 0.269, 0.002)
    near(r.D, 0.369, 0.002)
    near(r.R, 0.203, 0.003)
    near(r.s, 0.0144, 0.005)
  })
  it('S1 Q2c: same a and d — trapezoid 2.17 m/s, parabola 1.93 m/s', () => {
    const tr = sectionFromArea('trapezoidal', 2.55, 0.4)
    const pa = sectionFromArea('parabolic', 2.55, 0.4)
    near(tr.b!, 4.78, 0.002)
    near(manningV(tr.R, 0.035, 0.04), 2.17, 0.003)
    near(manningV(pa.R, 0.035, 0.04), 1.93, 0.003)
  })
  it('S2 Q3d: parabolic 1.71, triangular 1.41, trapezoidal 1.98 m/s', () => {
    near(manningV(sectionFromArea('parabolic', 1.86, 0.3).R, 0.04, 0.04), 1.71, 0.003)
    near(manningV(sectionFromArea('triangular', 1.86, 0.3).R, 0.04, 0.04), 1.41, 0.003)
    near(manningV(sectionFromArea('trapezoidal', 1.86, 0.3).R, 0.04, 0.04), 1.98, 0.003)
  })
  it('normal depth inverts Manning', () => {
    const r = normalDepth('trapezoidal', 5.67, 0.03, 0.055, { b: 2.635, Z: 4 })
    near(r.d, 0.629, 0.005)
  })
})

describe('USLE (CS-B p4–6)', () => {
  it('S1 Q1b: m = 0.433, L = 1.37, S = 0.677, A = 14.7 Mg/ha; strip 7.4, terrace 2.9', () => {
    near(usleM(6), 0.433, 0.003)
    const r = usle({ R: 135, K: 0.47, l: 45.66, sPct: 6, C: 0.5, P: 0.5 })
    near(r.L, 1.37, 0.003)
    near(r.S, 0.677, 0.003)
    near(r.A, 14.7, 0.005)
    near((r.A * 0.25) / 0.5, 7.4, 0.005)
    near((r.A * 0.1) / 0.5, 2.9, 0.02)
  })
  it('S2 Q1b: RKLS = 179.2 → contour 13.4, strip 6.7, terrace 3.2 Mg/ha (−76 %)', () => {
    const rkls = 44.8 / 0.25
    near(rkls * 0.15 * 0.5, 13.4, 0.003)
    near(rkls * 0.15 * 0.25, 6.7, 0.003)
    near(rkls * 0.15 * 0.12, 3.2, 0.01)
    near(1 - 0.12 / 0.5, 0.76, 1e-6)
  })
  it('S uses the steep form at 9 % and above', () => expect(usleS(10)).toBeCloseTo(16.8 * Math.sin(Math.atan(0.1)) - 0.5, 9))
})

describe('wind erosion transport modes (WE s7–10)', () => {
  it('< 0.05 mm suspension, 0.05–0.5 saltation, 0.5–1 creep, > 1 mm stays', () => {
    expect(windMode(0.02)).toBe('suspension')
    expect(windMode(0.2)).toBe('saltation')
    expect(windMode(0.8)).toBe('creep')
    expect(windMode(2)).toBe('pavement')
  })
})
