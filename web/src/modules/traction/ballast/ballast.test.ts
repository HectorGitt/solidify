import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { chalkMarkSlip } from '@/physics/traction'
import { slipFromRevs, slipVerdict } from '@/physics/tyres'
import { annulusBelow, cavityFill } from './liquid'
import { DEFAULTS, REAR_FIELD_PSI, derive, ntrForSlip, slipForNTR } from './model'

function openEdges(g: THREE.BufferGeometry, eps = 1e-6) {
  const pos = g.getAttribute('position')
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`
  const edges = new Map<string, number>()
  for (let t = 0; t < pos.count / 3; t++) {
    const k = [key(3 * t), key(3 * t + 1), key(3 * t + 2)]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue
    for (let e = 0; e < 3; e++) {
      const a = k[e]
      const b = k[(e + 1) % 3]
      const id = a < b ? `${a}|${b}` : `${b}|${a}`
      edges.set(id, (edges.get(id) ?? 0) + 1)
    }
  }
  let open = 0
  for (const c of edges.values()) if (c !== 2) open++
  return open
}

function volume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  let v = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

describe('chalk-mark slip test — Tires and Tracks p9–10', () => {
  it('% slip = (R2 − R1)/R2: 10 loaded vs 9 no-load = 10 %, 8½ = 15 %, 7 = 30 %', () => {
    expect(chalkMarkSlip(9, 10)).toBeCloseTo(0.1, 12)
    expect(chalkMarkSlip(8.5, 10)).toBeCloseTo(0.15, 12)
    expect(chalkMarkSlip(7, 10)).toBeCloseTo(0.3, 12)
    expect(chalkMarkSlip(9, 10)).toBe(slipFromRevs(9, 10))
  })
  it('verdicts: 9½ revs remove ballast, 9 and 8½ proper, 8 add', () => {
    expect(slipVerdict(chalkMarkSlip(9.5, 10))).toBe('remove ballast')
    expect(slipVerdict(chalkMarkSlip(9, 10))).toBe('proper ballast')
    expect(slipVerdict(chalkMarkSlip(8.5, 10))).toBe('proper ballast')
    expect(slipVerdict(chalkMarkSlip(8, 10))).toBe('add ballast')
  })
})

describe('slip from the pull (L27 Fig 17 regression NTR = 0.664(1 − e^(−0.098·s%)))', () => {
  it('slipForNTR inverts ntrForSlip', () => {
    for (const s of [0.02, 0.1, 0.15, 0.3]) expect(slipForNTR(ntrForSlip(s))).toBeCloseTo(s, 9)
  })
  it('10 % slip ≈ NTR 0.416 on this soil', () => {
    expect(ntrForSlip(0.1)).toBeCloseTo(0.664 * (1 - Math.exp(-0.98)), 9)
  })
  it('caps at 60 % when the pull exceeds the soil limit', () => {
    expect(slipForNTR(0.7)).toBe(0.6)
    expect(slipForNTR(0)).toBe(0)
  })
})

describe('ballast bookkeeping', () => {
  it('more ballast → more rear weight → less slip for the same pull', () => {
    const light = derive({ ...DEFAULTS, fill: 0, weights: 0 })
    const heavy = derive({ ...DEFAULTS, fill: 0.75, weights: 3 })
    expect(heavy.rearKg - light.rearKg).toBeCloseTo(2 * heavy.liquid.massKg + 2 * 3 * 40, 6)
    expect(heavy.slip).toBeLessThan(light.slip)
  })
  it('front ballast: ½ the rear weight for integral, ⅓ for towed (TT p10)', () => {
    const i = derive({ ...DEFAULTS, implement: 'integral' })
    const t = derive({ ...DEFAULTS, implement: 'towed' })
    expect(i.frontNeedKg / i.rearKg).toBeCloseTo(0.5, 9)
    expect(t.frontNeedKg / t.rearKg).toBeCloseTo(1 / 3, 9)
  })
  it('TT p11 example: 120 PTO hp at 5.3 mph, semi-integral, firm → 84–100 lb/hp ≈ 10,100–12,000 lb', () => {
    const d = derive({ ...DEFAULTS, ptoHp: 120, mph: 5.3, implement: 'semi-integral', soil: 'firm' })
    expect(d.rangeLb.lo).toBeGreaterThan(9700)
    expect(d.rangeLb.lo).toBeLessThan(10500)
    expect(d.rangeLb.hi).toBeGreaterThan(11600)
    expect(d.rangeLb.hi).toBeLessThan(12400)
  })
})

describe('inflation (TT p6–7, TTS p14)', () => {
  it('rear field guide 0.8 bar ≈ 11.6 psi', () => {
    expect(REAR_FIELD_PSI).toBeCloseTo(11.6, 1)
  })
  it('under/over states and the patch: lower pressure gives a larger contact area (A = W/p)', () => {
    const under = derive({ ...DEFAULTS, psi: 7 })
    const ok = derive({ ...DEFAULTS, psi: 12 })
    const over = derive({ ...DEFAULTS, psi: 24 })
    expect([under.inflation, ok.inflation, over.inflation]).toEqual(['under', 'correct', 'over'])
    expect(under.patch.area).toBeGreaterThan(ok.patch.area)
    expect(ok.patch.area / over.patch.area).toBeCloseTo(2, 9)
  })
  it('liquid head above a bottom valve is about ½ psi per foot (TT p7)', () => {
    const d = derive({ ...DEFAULTS, fill: 0.75, mix: 'water' })
    expect(d.headPsi / d.headFt).toBeCloseTo(0.433, 2)
    expect(derive({ ...DEFAULTS, fill: 0 }).headPsi).toBeCloseTo(0, 3)
  })
})

describe('liquid and air geometry (watertight slabs)', () => {
  const cavity: [number, number][] = [
    [0.45, -0.18],
    [0.62, -0.17],
    [0.72, -0.08],
    [0.74, 0],
    [0.72, 0.08],
    [0.62, 0.17],
    [0.45, 0.18],
  ]
  it('annulus below the level is a valid shape; none when the level is under the tyre', () => {
    expect(annulusBelow(0.4, 0.7, -0.8)).toBeNull()
    expect(annulusBelow(0.4, 0.7, 0.1)).not.toBeNull()
  })
  for (const level of [-0.5, 0, 0.3]) {
    it(`liquid and air slabs at level ${level} are closed with positive volume`, () => {
      for (const below of [true, false]) {
        const g = cavityFill(cavity, 0.45, level, below, 6)
        expect(g).not.toBeNull()
        expect(openEdges(g!)).toBe(0)
        expect(volume(g!)).toBeGreaterThan(0)
      }
    })
  }
  it('liquid + air fill the whole annular cavity', () => {
    const l = volume(cavityFill(cavity, 0.45, 0.1, true, 6)!)
    const a = volume(cavityFill(cavity, 0.45, 0.1, false, 6)!)
    const all = volume(cavityFill(cavity, 0.45, 2, true, 6)!)
    expect((l + a) / all).toBeCloseTo(1, 2)
  })
})
