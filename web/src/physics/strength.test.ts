import { describe, expect, it } from 'vitest'
import { TEST_MATERIALS, allowedAmplitude, axialStress, basquinLife, basquinStress, bulkModulus, circleArea, compositeBar, creepStrain, criticalCrack, criticalStress, cycleStresses, directStrain, directStress, eulerLimitSlenderness, eulerLoad, extension, griffithStress, hoopStress, isThinWall, larsonMiller, larsonMillerLife, minerDamage, parisLife, percentElongation, percentReduction, polarTube, principal, principalStrains, railGapAt, railStressAt, railsTouchAt, rosette, rotateStress, secondMomentCircle, secondMomentTube, shaftTorque, shearModulus, solidShaftForStress, stressAt, stressFromStrain, stressIntensity, thermalChange, toughness, trescaEquivalent, tubeArea, twist, vonMisesEquivalent, shaftStress } from './strength'

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

describe('past-paper direct stress', () => {
  it('50 mm square bar under 400 kN: 160 MPa', () => expect(directStress(400e3, 0.05 * 0.05) / 1e6).toBeCloseTo(160, 6))
  it('tie rod 4 cm², 10 kN, E = 200 GPa: 25 MPa, strain 1.25×10⁻⁴', () => {
    const s = directStress(10e3, 4e-4)
    expect(s / 1e6).toBeCloseTo(25, 6)
    expect(directStrain(s, 200e9)).toBeCloseTo(1.25e-4, 9)
  })
  it('100 mm rod Ø15, 100 kN, 200 GPa: 0.283 mm', () => expect(extension(100e3, 0.1, circleArea(0.015), 200e9) * 1e3).toBeCloseTo(0.283, 3))
  it('6700 N at 138 MPa: 48.6 mm²', () => expect((6700 / 138e6) * 1e6).toBeCloseTo(48.6, 1))
  it('hollow cast-iron cylinder 4 m, Ø300 × 50, 75 MPa, 150 GPa: 2945 kN, strain 5×10⁻⁴, 2 mm', () => {
    const A = tubeArea(0.3, 0.2)
    expect((75e6 * A) / 1e3).toBeCloseTo(2945, 0)
    expect(directStrain(75e6, 150e9)).toBeCloseTo(5e-4, 9)
    expect(directStrain(75e6, 150e9) * 4 * 1e3).toBeCloseTo(2, 6)
  })
})

describe('past-paper thermal problems', () => {
  it('5 m aluminium pole, 20 °C to −5 °C, α = 23×10⁻⁶: 2.875 mm shorter', () => expect(thermalChange(23e-6, 5, -25) * 1e3).toBeCloseTo(-2.875, 6))
  const r = { alpha: 11.7e-6, L: 18, gap: 3.2e-3, T0: 15, E: 207e9 }
  it('crane rails touch at 30.2 °C', () => expect(railsTouchAt(r)).toBeCloseTo(30.2, 1))
  it('the gap at −10 °C is 8.47 mm', () => expect(railGapAt(r, -10) * 1e3).toBeCloseTo(8.465, 3))
  it('the stress at 45 °C is about 36 MPa compression', () => {
    expect(railStressAt(r, 45) / 1e6).toBeCloseTo(35.9, 0)
    expect(railStressAt(r, 20)).toBe(0)
  })
})

describe('past-paper composite bar', () => {
  it('Ø50 steel in a 50/75 brass tube, 254 mm, 300 kN', () => {
    const c = compositeBar({ A1: circleArea(0.05), E1: 200e9, A2: tubeArea(0.075, 0.05), E2: 97e9 }, 300e3, 0.254)
    expect(c.s1 / 1e6).toBeCloseTo(95.1, 0)
    expect(c.s2 / 1e6).toBeCloseTo(46.1, 0)
    expect(c.P1 + c.P2).toBeCloseTo(300e3, 3)
    expect(c.delta * 1e3).toBeCloseTo(0.121, 2)
  })
})

describe('past-paper torsion', () => {
  it('hollow shaft Ø146/125, 3 m, 25 kN·m, G = 85 GPa: 2.45°', () => {
    expect(deg(twist(25e3, 3, 85e9, polarTube(0.146, 0.125)))).toBeCloseTo(2.45, 2)
    expect(shaftStress(25e3, 0.073, polarTube(0.146, 0.125)) / 1e6).toBeCloseTo(88.4, 0)
  })
  it('80 kW at 3 rev/s, τ = 70 MPa, peak 4 % over mean: Ø68.5 mm', () => {
    const T = shaftTorque(80e3, 3) * 1.04
    expect(solidShaftForStress(T, 70e6) * 1e3).toBeCloseTo(68.5, 0)
  })
})

describe('past-paper columns', () => {
  it('Ø50 steel fixed both ends, proportional limit 210 MPa, 200 GPa: L = 2.42 m, 412 kN', () => {
    const d = 0.05
    const k = d / 4
    const lam = eulerLimitSlenderness(200e9, 210e6)
    expect(lam).toBeCloseTo(96.95, 1)
    const L = 2 * lam * k
    expect(L).toBeCloseTo(2.424, 2)
    expect(eulerLoad(200e9, secondMomentCircle(d), L, 'fixed-fixed') / 1e3).toBeCloseTo(412.3, 0)
  })
  it('hollow cast iron Ø150 × 20, 6 m, fixed both ends, 80 GPa: about 1549 kN', () => {
    expect(eulerLoad(80e9, secondMomentTube(0.15, 0.11), 6, 'fixed-fixed') / 1e3).toBeCloseTo(1549, -1)
  })
  it('end fixity: fixed-fixed is 4 times pinned, fixed-free a quarter', () => {
    const p = eulerLoad(1e9, 1e-6, 1, 'pinned-pinned')
    expect(eulerLoad(1e9, 1e-6, 1, 'fixed-fixed')).toBeCloseTo(4 * p, 3)
    expect(eulerLoad(1e9, 1e-6, 1, 'fixed-free')).toBeCloseTo(p / 4, 3)
  })
})

describe('tensile test curves', () => {
  for (const m of TEST_MATERIALS) {
    it(`${m.name} starts on the elastic line, peaks at the UTS and breaks at its strain`, () => {
      const eY = m.yield / m.E
      expect(stressAt(m, eY / 2)).toBeCloseTo((m.E * eY) / 2, 3)
      let peak = 0
      for (let i = 1; i <= 2000; i++) peak = Math.max(peak, stressAt(m, (m.eF * i) / 2000))
      expect(peak / m.uts).toBeCloseTo(1, 2)
      expect(stressAt(m, m.eF * 1.01)).toBe(0)
    })
  }
  it('ductile metals absorb far more energy before breaking than brittle ones', () => {
    const by = (id: string) => TEST_MATERIALS.find((m) => m.id === id)!
    expect(toughness(by('mild'))).toBeGreaterThan(50 * toughness(by('cast')))
  })
  it('percent elongation and reduction', () => {
    expect(percentElongation(50, 66)).toBeCloseTo(32, 9)
    expect(percentReduction(100, 40)).toBeCloseTo(60, 9)
  })
  it('elastic constants', () => {
    expect(shearModulus(200e9, 0.3) / 1e9).toBeCloseTo(76.9, 1)
    expect(bulkModulus(200e9, 0.3) / 1e9).toBeCloseTo(166.7, 1)
  })
})

describe('plane stress', () => {
  const p = { sx: 80e6, sy: -40e6, txy: 25e6 }
  it('principal stresses and the invariant', () => {
    const q = principal(p)
    expect(q.s1 + q.s2).toBeCloseTo(p.sx + p.sy, 3)
    expect(q.tauMax).toBeCloseTo(65e6, 3)
    expect(q.s1).toBeCloseTo(85e6, 3)
    expect(q.s2).toBeCloseTo(-45e6, 3)
  })
  it('there is no shear on a principal plane, and it gives σ₁', () => {
    const q = principal(p)
    const r = rotateStress(p, q.thetaP)
    expect(r.tn).toBeCloseTo(0, 3)
    expect(r.sn).toBeCloseTo(q.s1, 3)
  })
  it('turning by 180° changes nothing', () => {
    const a = rotateStress(p, 0.3)
    const b = rotateStress(p, 0.3 + Math.PI)
    expect(a.sn).toBeCloseTo(b.sn, 3)
  })
  it('the largest shear is 45° from the principal planes', () => {
    const q = principal(p)
    expect(Math.abs(rotateStress(p, q.thetaP + rad(45)).tn)).toBeCloseTo(q.tauMax, 3)
  })
})

describe('strain gauges', () => {
  it('a rectangular rosette gets back the strains it was given', () => {
    const [ex, ey, g] = [500e-6, -200e-6, 300e-6]
    const at = (a: number) => ex * Math.cos(a) ** 2 + ey * Math.sin(a) ** 2 + g * Math.sin(a) * Math.cos(a)
    const r = rosette([at(0), at(rad(45)), at(rad(90))], [0, rad(45), rad(90)])
    expect(r.ex).toBeCloseTo(ex, 12)
    expect(r.ey).toBeCloseTo(ey, 12)
    expect(r.gxy).toBeCloseTo(g, 12)
    // the classic shortcut: γ = 2 ε_b − ε_a − ε_c
    expect(2 * at(rad(45)) - at(0) - at(rad(90))).toBeCloseTo(g, 12)
  })
  it('a delta rosette too', () => {
    const [ex, ey, g] = [100e-6, 400e-6, -250e-6]
    const at = (a: number) => ex * Math.cos(a) ** 2 + ey * Math.sin(a) ** 2 + g * Math.sin(a) * Math.cos(a)
    const r = rosette([at(0), at(rad(60)), at(rad(120))], [0, rad(60), rad(120)])
    expect(r.ey).toBeCloseTo(ey, 12)
  })
  it('principal strains and stress', () => {
    const q = principalStrains(500e-6, -200e-6, 0)
    expect(q.e1).toBeCloseTo(500e-6, 12)
    const s = stressFromStrain(1e-3, -0.3e-3, 0, 200e9, 0.3)
    expect(s.sx / 1e6).toBeCloseTo(200, 6)
    expect(s.sy).toBeCloseTo(0, 3)
  })
})

describe('pressure vessels', () => {
  it('hoop is twice axial', () => {
    expect(hoopStress(2e6, 0.5, 0.01) / 1e6).toBeCloseTo(100, 6)
    expect(axialStress(2e6, 0.5, 0.01) / 1e6).toBeCloseTo(50, 6)
    expect(isThinWall(0.5, 0.01)).toBe(true)
    expect(isThinWall(0.05, 0.01)).toBe(false)
  })
})

describe('yield criteria', () => {
  it('uniaxial tension gives σ under both', () => {
    expect(trescaEquivalent(100, 0, 0)).toBeCloseTo(100, 9)
    expect(vonMisesEquivalent(100, 0, 0)).toBeCloseTo(100, 9)
  })
  it('pure shear: Tresca 2τ, von Mises √3 τ', () => {
    expect(trescaEquivalent(50, 0, -50)).toBeCloseTo(100, 9)
    expect(vonMisesEquivalent(50, 0, -50)).toBeCloseTo(50 * Math.sqrt(3), 9)
  })
  it('hydrostatic stress does not yield', () => {
    expect(trescaEquivalent(70, 70, 70)).toBeCloseTo(0, 9)
    expect(vonMisesEquivalent(70, 70, 70)).toBeCloseTo(0, 9)
  })
  it('Tresca is always the more cautious', () => {
    for (const [a, b, c] of [[100, 30, -20], [80, 80, 0], [10, -50, -90]]) expect(trescaEquivalent(a, b, c)).toBeGreaterThanOrEqual(vonMisesEquivalent(a, b, c) - 1e-9)
  })
})

describe('fatigue', () => {
  it('fully reversed stress: R = −1, no mean', () => {
    const c = cycleStresses(100, -100)
    expect(c.R).toBeCloseTo(-1, 9)
    expect(c.mean).toBeCloseTo(0, 9)
    expect(c.amplitude).toBeCloseTo(100, 9)
  })
  it('mean-stress lines: Se at no mean, nothing at the limit', () => {
    expect(allowedAmplitude('goodman', 200, 600, 400, 0)).toBeCloseTo(200, 9)
    expect(allowedAmplitude('goodman', 200, 600, 400, 600)).toBeCloseTo(0, 9)
    expect(allowedAmplitude('gerber', 200, 600, 400, 300)).toBeGreaterThan(allowedAmplitude('goodman', 200, 600, 400, 300))
    expect(allowedAmplitude('soderberg', 200, 600, 400, 300)).toBeLessThan(allowedAmplitude('goodman', 200, 600, 400, 300))
  })
  it('S–N: below the endurance limit it lasts for ever; the line inverts', () => {
    expect(basquinLife(150, 600, 200)).toBe(Infinity)
    const N = basquinLife(300, 600, 200)
    expect(basquinStress(N, 600, 200)).toBeCloseTo(300, 6)
    expect(basquinStress(1e6, 600, 200)).toBeCloseTo(200, 6)
    expect(basquinStress(1e3, 600, 200)).toBeCloseTo(540, 6)
  })
  it('Miner adds up the life used', () => expect(minerDamage([[1e4, 1e5], [5e4, 1e6]])).toBeCloseTo(0.15, 9))
})

describe('fracture', () => {
  it('K = Yσ√(πa), and the critical values invert', () => {
    const K = stressIntensity(1, 100e6, 0.01)
    expect(K / 1e6).toBeCloseTo(17.72, 2)
    expect(criticalStress(1, K, 0.01)).toBeCloseTo(100e6, 0)
    expect(criticalCrack(1, K, 100e6)).toBeCloseTo(0.01, 9)
  })
  it('doubling the crack takes √2 off the strength', () => expect(criticalStress(1, 50e6, 0.02)).toBeCloseTo(criticalStress(1, 50e6, 0.01) / Math.SQRT2, 3))
  it('Griffith falls with crack size', () => expect(griffithStress(70e9, 1, 1e-6)).toBeGreaterThan(griffithStress(70e9, 1, 1e-4)))
  it('Paris: most of the life is spent while the crack is small', () => {
    const early = parisLife(1e-11, 3, 1, 100e6, 0.001, 0.002)
    const late = parisLife(1e-11, 3, 1, 100e6, 0.01, 0.011)
    expect(early).toBeGreaterThan(late)
  })
})

describe('creep', () => {
  it('three stages: a falling rate, a steady one, then a rising one', () => {
    const e = (t: number) => creepStrain(0.001, 0.002, 50, 1e-5, t, 1000)
    const rate = (t: number) => (e(t + 1) - e(t)) / 1
    expect(rate(5)).toBeGreaterThan(rate(300))
    expect(rate(300)).toBeCloseTo(rate(500), 6)
    expect(rate(950)).toBeGreaterThan(rate(500))
  })
  it('Larson–Miller inverts', () => {
    const P = larsonMiller(800, 1000)
    expect(P).toBeCloseTo(18400, 6)
    expect(larsonMillerLife(P, 800)).toBeCloseTo(1000, 6)
    // the same P at a hotter temperature means a shorter life
    expect(larsonMillerLife(P, 850)).toBeLessThan(1000)
  })
})
