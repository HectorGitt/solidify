import { describe, expect, it } from 'vitest'
import {
  beltCapacity,
  beltMassPerMetre,
  beltSpeed,
  beltsRequired,
  centreForSmallWrap,
  correctedPowerPerBelt,
  crossedBeltLength,
  crossedBeltWrap,
  fennerBeltLength,
  fennerCentreDistance,
  flatBeltWidth,
  governingFactor,
  maxPowerSpeed,
  openBeltLength,
  openBeltWrap,
  tensionFactor,
} from './belts'

const deg = (r: number) => (r * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180

describe('belt wrap angles — AEE503 Module 4', () => {
  it('crossed belt 250/500 mm, C = 1.25 m → α = 214.9° on both pulleys (MG15 Q2c, MG19 Q2c, T19)', () => {
    expect(deg(crossedBeltWrap(0.25, 0.125, 1.25).wrap)).toBeCloseTo(214.9, 1)
  })
  it('open belt: α₁ = 180° − 2β (small), α₂ = 180° + 2β (large), sin β = (R − r)/C', () => {
    const w = openBeltWrap(0.25, 0.125, 1.25)
    expect(w.small + w.large).toBeCloseTo(2 * Math.PI, 12)
    expect(Math.sin(w.beta)).toBeCloseTo(0.1, 12)
  })
  it('fan, 350/1370 mm pulleys at C = 1370 mm → α₁ = 136.3° (Q2017/18, E2021/22; calc)', () => {
    expect(deg(openBeltWrap(0.685, 0.175, 1.37).small)).toBeCloseTo(136.3, 1)
  })
  it('V-belt 250/800 sheaves with 140° on the small sheave → C = 804 mm, α₂ = 220° (MG19 Q3a)', () => {
    const C = centreForSmallWrap(0.4, 0.125, rad(140))
    expect(C * 1000).toBeCloseTo(804.05, 0)
    expect(deg(openBeltWrap(0.4, 0.125, C).large)).toBeCloseTo(220, 6)
  })
  it('exact lengths reduce to the textbook forms', () => {
    // equal pulleys: open belt length = 2C + πD
    expect(openBeltLength(0.2, 0.2, 1)).toBeCloseTo(2 + Math.PI * 0.4, 12)
    // crossed belt is always longer than open
    expect(crossedBeltLength(0.25, 0.125, 1.25)).toBeGreaterThan(openBeltLength(0.25, 0.125, 1.25))
  })
})

describe('flat belt by calculation — AEE503 Module 4', () => {
  it('crossed leather belt, 7.5 kW at 1000 rpm, f = 0.3, s₁ = 1.7 MPa, t = 6 mm → b = 92 mm (MG15 Q2c / MG19)', () => {
    const alpha = crossedBeltWrap(0.25, 0.125, 1.25).wrap
    const k = tensionFactor(0.3, alpha)
    // the guide rounds e^(fα) to 3.10; the exact value is 3.08 (see errata)
    expect(k).toBeCloseTo(3.08, 2)
    const v = beltSpeed(0.25, 1000)
    expect(v).toBeCloseTo(13.1, 1)
    const r = flatBeltWidth(7500, v, 1.7e6, 970, k, 0.006)
    expect(r.centrifugalStress).toBeCloseTo(1.665e5, -3)
    expect(r.s2 / 1e5).toBeCloseTo(6.64, 1) // guide 6.613e5 with k = 3.10
    expect(r.dT).toBeCloseTo(572.5, 0)
    expect(r.b * 1000).toBeCloseTo(92, 0)
  })

  it('compressor drive: 10 × 250 belt, 300/1500 pulleys, wraps 220°/270°, f 0.3/0.25 → P = 43.6 kW (MG16 Q2b)', () => {
    const g = governingFactor([
      { f: 0.3, alpha: rad(220) },
      { f: 0.25, alpha: rad(270) },
    ])
    expect(g.index).toBe(0) // the small pulley governs
    expect(g.all[0]).toBeCloseTo(3.16, 2)
    expect(g.all[1]).toBeCloseTo(3.25, 2) // guide: 3.2
    const T1 = 2e6 * 0.01 * 0.25
    expect(T1).toBeCloseTo(5000, 6)
    const m = beltMassPerMetre(0.25, 0.01, 970)
    expect(m).toBeCloseTo(2.425, 6)
    const v = beltSpeed(0.3, 900)
    expect(v).toBeCloseTo(14.14, 2)
    const c = beltCapacity(T1, m, v, g.k)
    expect(c.T2).toBeCloseTo(1914, -1)
    expect(Math.abs(c.P / 1000 - 43.6)).toBeLessThan(0.1) // 43.66 exact; the guide rounds e^(fα) to 3.16
  })

  it('motor–compressor example: 6 × 200 belt, wraps 4/3.5 rad, f 0.3/0.25, T₁ = 2.7 kN, 900 rpm → P ≈ 17.4 kW (M4 slides 13–14; calc)', () => {
    const g = governingFactor([
      { f: 0.3, alpha: 4 },
      { f: 0.25, alpha: 3.5 },
    ])
    expect(g.index).toBe(1) // here the large pulley governs
    const c = beltCapacity(2700, beltMassPerMetre(0.2, 0.006, 970), beltSpeed(0.25, 900), g.k)
    expect(c.P / 1000).toBeCloseTo(17.4, 1)
  })

  it('fan, double-ply leather 8 × 250 mm, s = 2.4 MPa, f = 0.35, 880 rpm → P ≈ 39 kW (Q2017/18, E2021/22; calc)', () => {
    const alpha = openBeltWrap(0.685, 0.175, 1.37).small
    const c = beltCapacity(2.4e6 * 0.25 * 0.008, beltMassPerMetre(0.25, 0.008, 970), beltSpeed(0.35, 880), tensionFactor(0.35, alpha))
    expect(c.P / 1000).toBeCloseTo(39.1, 0)
  })
})

describe('V-belts — AEE503 Module 4 and MG19 Q3a', () => {
  it('36° groove, 140° wrap, f = 0.2 → e^(fα/sin 18°) = 4.86', () => {
    expect(tensionFactor(0.2, rad(140), rad(36))).toBeCloseTo(4.86, 2)
  })
  it('26 kW, T₁ = 900 N, m = 0.523 kg/m, 1150 rpm: T₂ = 279 N, 9.34 kW per belt → 3 belts (guide: 2.06 — errata)', () => {
    const v = beltSpeed(0.25, 1150)
    expect(v).toBeCloseTo(15.05, 2)
    const c = beltCapacity(900, 0.523, v, tensionFactor(0.2, rad(140), rad(36)))
    expect(c.T2).toBeCloseTo(279, 0)
    expect(c.P / 1000).toBeCloseTo(9.34, 2)
    const n = beltsRequired(26000, c.P)
    expect(n.exact).toBeCloseTo(2.78, 2)
    expect(n.n).toBe(3)
  })
  it('a flat belt (θ = 180°) is the special case of the V-belt formula', () => {
    expect(tensionFactor(0.3, 3)).toBeCloseTo(Math.exp(0.9), 12)
  })
  it('maximum power occurs where centrifugal tension is T₁/3 (beyond notes)', () => {
    const T1 = 900
    const m = 0.523
    const k = 4.86
    const vStar = maxPowerSpeed(T1, m)
    const P = (v: number) => beltCapacity(T1, m, v, k).P
    expect(P(vStar)).toBeGreaterThan(P(vStar * 0.95))
    expect(P(vStar)).toBeGreaterThan(P(vStar * 1.05))
  })
})

describe('V-belt selection from the Fenner catalogue — AEE503 Module 2', () => {
  it('fan, 7.5 kW at 1500 rpm, ratio 3, C = 1000 mm → d = 250, D = 750, L = 3632.5 mm (M2 Example 1, MG15, MG16)', () => {
    // C = 2√((D + d)d) with D = 3d → C = 4d
    expect(fennerCentreDistance(0.75, 0.25)).toBeCloseTo(1.0, 12)
    expect(fennerBeltLength(750, 250, 1000)).toBeCloseTo(3632.5, 6)
  })
  it('A section: (2.70 + 0.18) × 1.17 × 0.93 = 3.13 kW → 9/3.13 → 3 belts; B section 6.57 kW → 2 belts', () => {
    const a = correctedPowerPerBelt(2.7, 0.18, 1.17, 0.93)
    expect(a).toBeCloseTo(3.13, 2)
    expect(beltsRequired(9, a).n).toBe(3)
    const b = correctedPowerPerBelt(6.06, 0.48, 1.08, 0.93)
    expect(b).toBeCloseTo(6.57, 2)
    expect(beltsRequired(9, b).n).toBe(2)
  })
  it('palm fruit digester: d = 85, D = 425 → C = 416.4 mm, L = 1702.9 mm, 1.10 kW/belt → 3 belts (MG17, MG21, T21)', () => {
    expect(fennerCentreDistance(425, 85)).toBeCloseTo(416.4, 1)
    expect(fennerBeltLength(425, 85, 416.4)).toBeCloseTo(1702.9, 1)
    const p = correctedPowerPerBelt(1.21, 0.18, 0.99, 0.8)
    expect(p).toBeCloseTo(1.1, 2)
    expect(beltsRequired(3.3, p).n).toBe(3)
  })
})
