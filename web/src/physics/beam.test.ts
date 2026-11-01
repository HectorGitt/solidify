import { describe, expect, it } from 'vitest'
import { bendingStress, curves, extremes, eye, firstMoment, maxShearStress, moment, reactions, rect, sectionProps, shear, shearStress, tee, type Beam } from './beam'

const simple = (L: number, loads: Beam['loads'], a = 0, b = L): Beam => ({ L, support: { kind: 'simple', a, b }, loads })

describe('past-paper beams', () => {
  it('20 kN and 40 kN at the third points of a 6 m span', () => {
    const b = simple(6, [{ kind: 'point', x: 2, P: 20e3 }, { kind: 'point', x: 4, P: 40e3 }])
    const r = reactions(b)
    expect(r.Ra).toBeCloseTo(26667, 0)
    expect(r.Rb).toBeCloseTo(33333, 0)
    expect(moment(b, 2)).toBeCloseTo(53333, 0)
    expect(moment(b, 4)).toBeCloseTo(66667, 0)
    expect(shear(b, 1)).toBeCloseTo(26667, 0)
    expect(shear(b, 3)).toBeCloseTo(6667, 0)
    expect(shear(b, 5)).toBeCloseTo(-33333, 0)
  })
  it('1 N/m over 40 m with 5 N at 8 m from B', () => {
    const r = reactions(simple(40, [{ kind: 'udl', x0: 0, x1: 40, w: 1 }, { kind: 'point', x: 32, P: 5 }]))
    expect(r.Ra).toBeCloseTo(21, 9)
    expect(r.Rb).toBeCloseTo(24, 9)
  })
  it('a T-section beam limited by shear: 150×10 flange, 90×10 web, span 1.5 m, τ ≤ 3 MPa', () => {
    const s = tee(0.15, 0.01, 0.09, 0.01)
    const p = sectionProps(s)
    expect(p.ybar * 1e3).toBeCloseTo(76.25, 6)
    expect(p.I * 1e12).toBeCloseTo(2026250, 0)
    // τ = V Q / (I b) at the neutral axis, with V = w L / 2
    const Q = firstMoment(s, p.ybar, p)
    expect(Q * 1e9).toBeCloseTo(29070, 0)
    const V = (3e6 * p.I * 0.01) / Q
    const w = V / 0.75
    expect(w / 1e3).toBeCloseTo(2.79, 2)
    const b = simple(1.5, [{ kind: 'udl', x0: 0, x1: 1.5, w }])
    expect(maxShearStress(shear(b, 0), s, p) / 1e6).toBeCloseTo(3, 2)
    const Mmax = moment(b, 0.75)
    expect(Mmax).toBeCloseTo((w * 1.5 ** 2) / 8, 6)
    // the largest bending stress is in the far fibre, at the bottom of the web
    expect(bendingStress(Mmax, 0, p) / 1e6).toBeCloseTo(29.5, 1)
  })
})

describe('standard deflections', () => {
  const EI = 2e5
  it('central point load, PL³/48EI', () => {
    const c = curves(simple(4, [{ kind: 'point', x: 2, P: 1000 }]), EI, 800)
    expect(extremes(c).ymax).toBeCloseTo(-(1000 * 4 ** 3) / (48 * EI), 5)
    expect(extremes(c).xY).toBeCloseTo(2, 6)
  })
  it('uniform load, 5wL⁴/384EI', () => {
    const c = curves(simple(4, [{ kind: 'udl', x0: 0, x1: 4, w: 500 }]), EI, 800)
    expect(extremes(c).ymax).toBeCloseTo(-(5 * 500 * 4 ** 4) / (384 * EI), 5)
  })
  it('cantilever with an end load, PL³/3EI and moment −PL at the wall', () => {
    const b: Beam = { L: 2, support: { kind: 'cantilever' }, loads: [{ kind: 'point', x: 2, P: 300 }] }
    const c = curves(b, EI, 800)
    expect(c.y[800]).toBeCloseTo(-(300 * 8) / (3 * EI), 5)
    expect(c.M[0]).toBeCloseTo(-600, 6)
    expect(shear(b, 1)).toBeCloseTo(300, 6)
  })
  it('both supports stay at zero, also with an overhang', () => {
    const c = curves(simple(5, [{ kind: 'point', x: 5, P: 100 }], 0, 3), EI, 500)
    expect(c.y[0]).toBeCloseTo(0, 9)
    expect(c.y[300]).toBeCloseTo(0, 9)
    // the overhang's end goes down and the span lifts
    expect(c.y[500]).toBeLessThan(0)
    expect(c.y[150]).toBeGreaterThan(0)
  })
  it('dM/dx = V', () => {
    const b = simple(6, [{ kind: 'udl', x0: 1, x1: 5, w: 700 }, { kind: 'point', x: 2.5, P: 900 }])
    for (const x of [0.5, 1.7, 3.3, 4.6, 5.5]) expect((moment(b, x + 1e-5) - moment(b, x - 1e-5)) / 2e-5).toBeCloseTo(shear(b, x), 2)
  })
})

describe('sections', () => {
  it('rectangle: bh³/12, and τmax is 1.5 V/A', () => {
    const s = rect(0.05, 0.1)
    const p = sectionProps(s)
    expect(p.I).toBeCloseTo((0.05 * 0.1 ** 3) / 12, 12)
    expect(maxShearStress(1000, s, p)).toBeCloseTo((1.5 * 1000) / p.A, 3)
    expect(shearStress(1000, s, p.depth, p)).toBeCloseTo(0, 6)
  })
  it('sagging compresses the top', () => {
    const p = sectionProps(rect(0.05, 0.1))
    expect(bendingStress(100, 0.1, p)).toBeLessThan(0)
    expect(bendingStress(100, 0, p)).toBeGreaterThan(0)
    expect(bendingStress(100, p.ybar, p)).toBeCloseTo(0, 9)
  })
  it('an I section is symmetric, and shear jumps where the width changes', () => {
    const s = eye(0.1, 0.01, 0.1, 0.006)
    const p = sectionProps(s)
    expect(p.ybar).toBeCloseTo(0.06, 9)
    const inFlange = shearStress(1000, s, 0.1099, p)
    const inWeb = shearStress(1000, s, 0.1101 - 0.0102, p)
    expect(inWeb).toBeGreaterThan(inFlange)
  })
})
