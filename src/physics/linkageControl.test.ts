import { describe, expect, it } from 'vitest'
import { DEFAULT_LINKAGE, phiForHitchHeight, solveLinkage } from '@/tractor/linkage'
import {
  PTO_STANDARDS,
  ackermannOuter,
  doubleHooke,
  doubleHookeRange,
  draftAboutV,
  hitchToWorld,
  linkageWith,
  simulateControl,
  seriesStats,
  toeAB,
  toeForRod,
  trackRodNominal,
  trailedJoints,
  worldToHitch,
  wrapPerSecond,
  type DraftPlant,
} from './linkageControl'

const deg = Math.PI / 180
const cross = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.y - a.y * b.x

describe('virtual hitch point V (Macmillan Figs 6.4–6.5)', () => {
  it('V lies on both the lower-link line AL and the top-link line BU', () => {
    for (const top of [0.5, 0.58, 0.7]) {
      const g = linkageWith(top)
      const p = solveLinkage(phiForHitchHeight(0.4, g), g)
      const V = p.V!
      expect(cross({ x: p.L.x - g.A.x, y: p.L.y - g.A.y }, { x: V.x - g.A.x, y: V.y - g.A.y })).toBeCloseTo(0, 9)
      expect(cross({ x: p.U.x - g.B.x, y: p.U.y - g.B.y }, { x: V.x - g.B.x, y: V.y - g.B.y })).toBeCloseTo(0, 9)
    }
  })
  it("a longer top link lowers V (plough near the surface, h = 0.5 m)", () => {
    const at = (t: number) => solveLinkage(phiForHitchHeight(0.5, linkageWith(t)), linkageWith(t)).V!.y
    expect(at(0.7)).toBeLessThan(at(0.55))
  })
  it('hitch frame round-trips', () => {
    const p = solveLinkage(phiForHitchHeight(0.5))
    const q = worldToHitch(p, hitchToWorld(p, { x: -0.7, y: -0.3 }))
    expect(q.x).toBeCloseTo(-0.7, 12)
    expect(q.y).toBeCloseTo(-0.3, 12)
  })
  it('Fig 6.5: draft line above V pulls the implement in, below V lifts it out', () => {
    const V = { x: 2, y: 0.5 }
    const P = { x: -1.5, y: -0.1 }
    expect(draftAboutV(V, P, 15 * deg)!.pullIn).toBe(true) // line at V.x ≈ 0.84 > 0.5
    expect(draftAboutV(V, P, 5 * deg)!.pullIn).toBe(false) // ≈ 0.21 < 0.5
    expect(draftAboutV(null, P, 10 * deg)).toBeNull()
    expect(DEFAULT_LINKAGE.top).toBeGreaterThan(0)
  })
})

describe('draft vs position control (Tractor Hydraulic System Fig 41)', () => {
  const plant: DraftPlant = { depth: (h) => 0.55 - h, compression: (_h, D) => 0.5 * D - 1500, hMin: 0.2, hMax: 0.8 }
  const base = { setC: 0.5 * 50e3 * 0.7 * 0.2 - 1500, setH: 0.35, response: 0.5, k0: 50e3, variability: 0.6, speed: 1.5, width: 0.7, length: 50, h0: 0.35 }
  const pos = simulateControl({ ...base, mode: 'position' }, plant)
  const dr = simulateControl({ ...base, mode: 'draft' }, plant)
  it('position control holds the depth constant while the draft varies', () => {
    expect(seriesStats(pos.x, pos.depth).range).toBeLessThan(1e-6)
    expect(seriesStats(pos.x, pos.draft).range).toBeGreaterThan(2000)
  })
  it('draft control keeps the draft steadier, letting the depth vary', () => {
    expect(seriesStats(dr.x, dr.draft, 3).range).toBeLessThan(0.75 * seriesStats(pos.x, pos.draft, 3).range)
    expect(seriesStats(dr.x, dr.depth, 3).range).toBeGreaterThan(0.02)
  })
})

describe("PTO drive shaft (Culpin Fig A2.7; Hooke's joint notes; TTS p10)", () => {
  it('standards: 540 rpm 6 splines Ø35 mm, 1000 rpm 21 splines Ø44 mm', () => {
    expect(PTO_STANDARDS['540']).toMatchObject({ rpm: 540, splines: 6, diameter: 0.035 })
    expect(PTO_STANDARDS['1000']).toMatchObject({ rpm: 1000, splines: 21, diameter: 0.044 })
  })
  it('single joint at 20°, 1000 rpm: 939.7–1064 rpm (2016/17 guide)', () => {
    const r = doubleHookeRange(20 * deg, 0)
    expect(1000 * r.lo).toBeCloseTo(939.7, 1)
    expect(1000 * r.hi).toBeCloseTo(1064.2, 1)
  })
  it('equal angles with yokes in line give uniform output', () => {
    for (let i = 0; i < 24; i++) expect(doubleHooke(i * 0.27, 25 * deg, 25 * deg).rOut).toBeCloseTo(1, 10)
  })
  it('BS 1495: pin midway gives equal angles γ/2; otherwise unequal', () => {
    const t = trailedJoints(0.3, 0.3, 50 * deg)
    expect(t.beta1).toBeCloseTo(25 * deg, 10)
    expect(t.beta2).toBeCloseTo(25 * deg, 10)
    const u = trailedJoints(0.3, 0.6, 50 * deg)
    expect(Math.abs(u.beta1 - u.beta2)).toBeGreaterThan(5 * deg)
  })
  it('a 75 mm guard-size shaft at 540 rpm wraps about 7 ft (2.13 m) of string per second', () => {
    expect(wrapPerSecond(0.075, 540) / 0.3048).toBeCloseTo(7, 0)
  })
})

describe('track rod and toe-in (Tractor Steering Figs 44, 47)', () => {
  const ax = { zk: 0.62, arm: 0.16, beta: Math.atan(0.62 / 1.88), wheelbase: 1.88 }
  it('nominal track rod gives zero toe; lengthening a rear track rod gives toe-in', () => {
    expect(toeForRod(ax, 0)).toBeCloseTo(0, 9)
    expect(toeForRod(ax, 0.002)).toBeGreaterThan(0)
    expect(trackRodNominal(ax)).toBeCloseTo(2 * (0.62 - 0.16 * Math.sin(ax.beta)), 12)
  })
  it('3–6 mm of toe-in corresponds to a fraction of a degree per wheel', () => {
    const e = toeForRod(ax, 0.0017)
    const d = toeAB(1.3, 0.203, e, -e).diff * 1000
    expect(d).toBeGreaterThan(3)
    expect(d).toBeLessThan(6)
  })
  it('Ackermann: cot δo − cot δi = t/l (beyond notes)', () => {
    const i = 35 * deg
    const o = ackermannOuter(i, ax)
    expect(1 / Math.tan(o) - 1 / Math.tan(i)).toBeCloseTo((2 * 0.62) / 1.88, 10)
  })
})
