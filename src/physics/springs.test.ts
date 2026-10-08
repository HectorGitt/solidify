import { describe, expect, it } from 'vitest'
import {
  WELD_ALLOWABLE,
  activeCoils,
  barWeld,
  bracketWeld,
  filletParallel,
  filletThroat,
  filletTransverse,
  helicalDeflection,
  helicalStiffness,
  helicalStress,
  leafDeflection,
  leafNip,
  leafStressFull,
  leafStressGraduated,
  leafStressPrestressed,
  leafThickness,
  shearStressFactor,
  wahlFactor,
  wireDiameter,
  wireShear,
} from './springs'

describe('helical spring — AEE503 Module 10, 2021/22 marking guide Q4d', () => {
  const F = 500
  const y = 0.025
  const C = 8
  const tau = 350e6
  const G = 84e9
  it('k = F/y = 20 N/mm', () => {
    expect(F / y / 1000).toBeCloseTo(20, 12)
  })
  it('the guide uses K_s = 1 + 0.5/C = 1.0625 → d = 5.56 ≈ 6 mm, D = 48 mm, n = 6.15 coils', () => {
    const Ks = shearStressFactor(C)
    expect(Ks).toBeCloseTo(1.0625, 12)
    const d = wireDiameter(F, C, tau, Ks)
    expect(d * 1000).toBeCloseTo(5.56, 2)
    expect(activeCoils(y, F, C, 0.006, G)).toBeCloseTo(6.15, 2)
    expect(helicalStiffness(0.048, 0.006, activeCoils(y, F, C, 0.006, G), G)).toBeCloseTo(20000, 6)
  })
  it('the Wahl factor (M10 slide 12) for C = 8 is 1.184 → d = 5.87 mm, still rounds to 6 mm (errata: wahl)', () => {
    const K = wahlFactor(C)
    expect(K).toBeCloseTo(1.184, 3)
    expect(wireDiameter(F, C, tau, K) * 1000).toBeCloseTo(5.87, 2)
    // with d = 6 mm the Wahl stress is inside the 350 MPa limit
    expect(helicalStress(F, 0.048, 0.006, K) / 1e6).toBeLessThan(350)
  })
  it('stress = K·8FC/(πd²) and deflection = 8FD³n/(d⁴G) are consistent with k', () => {
    expect(helicalStress(F, 0.048, 0.006, 1)).toBeCloseTo((8 * F * 8) / (Math.PI * 0.006 ** 2), 3)
    expect(helicalDeflection(F, 0.048, 0.006, 6.15, G)).toBeCloseTo(y, 3)
  })
  it('torsion + direct shear is worst on the inside of the coil (beyond notes)', () => {
    expect(wireShear(F, 0.048, 0.006, 0.003)).toBeGreaterThan(wireShear(F, 0.048, 0.006, -0.003))
  })
})

describe('leaf spring — AEE503 Module 10, MG17 Q4c', () => {
  // 1 m cantilever, 8 graduated + 1 extra full-length leaf, b = 45 mm, F = 2000 N, y = 75 mm, E = 200 GPa
  const F = 2000
  const L = 1
  const b = 0.045
  const E = 200e9
  it('t = 12.3 mm (t³ = 1.87×10⁻⁶ m³)', () => {
    const t = leafThickness(F, L, b, 0.075, E, 1, 8)
    expect(t ** 3).toBeCloseTo(1.87e-6, 8)
    expect(t * 1000).toBeCloseTo(12.3, 1)
    expect(leafDeflection(F, L, b, t, E, 1, 8)).toBeCloseTo(0.075, 9)
  })
  it('pre-stressed 195 MN/m² vs 277 MN/m² in the full leaves without pre-stress; graduated = ⅔ of full', () => {
    const t = leafThickness(F, L, b, 0.075, E, 1, 8)
    expect(leafStressPrestressed(F, L, b, t, 9) / 1e6).toBeCloseTo(195, 0)
    expect(leafStressFull(F, L, b, t, 1, 8) / 1e6).toBeCloseTo(277, 0)
    expect(leafStressGraduated(F, L, b, t, 1, 8) / leafStressFull(F, L, b, t, 1, 8)).toBeCloseTo(2 / 3, 12)
    expect(leafNip(F, L, b, t, 9, E)).toBeGreaterThan(0)
  })
})

describe('fillet welds — AEE503 Module 11', () => {
  it('throat at 45° = 0.707w; at 67.5° = 0.765w', () => {
    expect(filletThroat(1, 45)).toBeCloseTo(0.7071, 4)
    expect(filletThroat(1, 67.5)).toBeCloseTo(0.765, 3)
  })
  it('transverse fillet carries 0.828 s w L; parallel 0.707 s w L', () => {
    expect(filletTransverse(1, 1, 1)).toBeCloseTo(0.828, 3)
    expect(filletParallel(1, 1, 1)).toBeCloseTo(0.707, 3)
  })
  it('15 mm leg parallel fillet → 997 kN per metre (MG16 Q6c)', () => {
    expect(filletParallel(WELD_ALLOWABLE, 0.015, 1) / 1000).toBeCloseTo(997, 0)
  })
  it('50 mm bar, 10 kN at 200 mm: Z_w = 1.964×10⁻³ m², f = 1.02 MN/m → w = 15.4 mm (MG15 Q6c, MG17, MG19, MG21)', () => {
    const r = barWeld(10e3, 0.2, 0.05)
    expect(r.Zw).toBeCloseTo(1.964e-3, 5)
    expect(r.fb / 1e6).toBeCloseTo(1.02, 2)
    expect(r.fs / 1e3).toBeCloseTo(63.7, 1)
    expect(r.f / 1e6).toBeCloseTo(1.02, 2)
    expect(r.w * 1000).toBeCloseTo(15.4, 1)
  })
  it('bracket, 35 kN at 570 mm, 120/240/120 weld: J_w = 5.328×10⁻³ m³, f = 0.609 MN/m → w = 9.2 mm (M11 Example 1)', () => {
    const r = bracketWeld(35e3, 0.57, 0.12, 0.24)
    expect(r.Ny * 1000).toBeCloseTo(30, 9)
    expect(r.Jw).toBeCloseTo(5.328e-3, 6)
    expect(r.fv0 / 1e3).toBeCloseTo(72.92, 2)
    expect(r.fh / 1e6).toBeCloseTo(0.45, 2)
    expect(r.fvT / 1e6).toBeCloseTo(0.337, 3)
    expect(r.f / 1e6).toBeCloseTo(0.609, 2) // 0.608 exact; the slide rounds f_h and f_v first
    expect(r.w * 1000).toBeCloseTo(9.2, 1)
  })
})
