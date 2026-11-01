import { describe, expect, it } from 'vitest'
import { classify, crankRange, rockerSwing, solve, sweep, transmissionLimits, type FourBar } from './fourbar'

const deg = (r: number) => (r * 180) / Math.PI
const L = (frame: number, crank: number, coupler: number, rocker: number): FourBar => ({ frame, crank, coupler, rocker })

describe("Grashof's law: the lab's three length sets", () => {
  it('4, 8, 10, 12: S + L < P + Q', () => {
    const c = classify(L(8, 4, 12, 10))
    expect(c.sumSL).toBe(16)
    expect(c.sumPQ).toBe(18)
    expect(c.grashof).toBe(true)
  })
  it('shortest link as crank: crank-rocker', () => expect(classify(L(8, 4, 12, 10)).kind).toBe('crank-rocker'))
  it('shortest link fixed: double crank', () => expect(classify(L(4, 8, 10, 12)).kind).toBe('double-crank'))
  it('shortest link opposite the fixed link: double rocker', () => expect(classify(L(12, 8, 4, 10)).kind).toBe('double-rocker'))
  it('4, 6, 9, 12: S + L > P + Q, no link turns fully whichever is fixed', () => {
    for (const l of [L(6, 4, 12, 9), L(4, 6, 12, 9), L(12, 6, 4, 9)]) {
      expect(classify(l).grashof).toBe(false)
      expect(classify(l).kind).toBe('double-rocker')
    }
  })
  it('4, 6, 10, 12: S + L = P + Q is the change-point case', () => expect(classify(L(6, 4, 12, 10)).kind).toBe('change-point'))
  it('a link as long as the other three together cannot close', () => expect(classify(L(10, 2, 3, 5)).kind).toBe('impossible'))
})

describe('transmission angle against crank radius (lab 2: frame 8, coupler 12, output lever 10 cm)', () => {
  // the worked cosine-rule values for each crank hole. The r = 4 write-up has 240 cos θ = 100, then
  // carries on with 102/240 and gets 63.4°; 100/240 gives 65.4°, which is what is asserted here
  const cases: [number, number, number][] = [
    [1, 35.7, 47.2],
    [2, 29.9, 53.1],
    [3, 24.1, 59.2],
    [4, 18.2, 65.4],
  ]
  for (const [r, min, max] of cases) {
    it(`r = ${r} cm: γ from ${min}° to ${max}°`, () => {
      const lim = transmissionLimits(L(8, r, 12, 10))
      expect(deg(lim.min)).toBeCloseTo(min, 1)
      expect(deg(lim.max)).toBeCloseTo(max, 1)
    })
  }
  it('the extremes really are the extremes of a full revolution', () => {
    const l = L(8, 4, 12, 10)
    const g = sweep(l, 721).map((s) => s.gamma)
    expect(Math.min(...g)).toBeCloseTo(18.2, 1)
    expect(Math.max(...g)).toBeCloseTo(65.4, 1)
  })
  it('the output swing grows with crank radius', () => {
    const s = [1, 2, 3, 4].map((r) => deg(rockerSwing(L(8, r, 12, 10))))
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1])
    // the lab's readings were 11, 31, 50 and 70°, about what the geometry gives
    expect(s[3]).toBeGreaterThan(45)
    expect(s[3]).toBeLessThan(75)
  })
  it('a crank of zero radius gives no swing', () => expect(rockerSwing(L(8, 0, 12, 10))).toBeCloseTo(0, 9))
})

describe('the solved pose', () => {
  const l = L(8, 4, 12, 10)
  it('closes: every link keeps its length, all the way round', () => {
    for (let t = 0; t < 2 * Math.PI; t += 0.2) {
      const p = solve(l, t)!
      expect(Math.hypot(p.B[0], p.B[1])).toBeCloseTo(4, 9)
      expect(Math.hypot(p.C[0] - p.B[0], p.C[1] - p.B[1])).toBeCloseTo(12, 9)
      expect(Math.hypot(p.C[0] - 8, p.C[1])).toBeCloseTo(10, 9)
    }
  })
  it('both branches close, and open is above the frame', () => {
    const a = solve(l, 1)!
    const b = solve(l, 1, -1)!
    expect(a.C[1]).toBeGreaterThan(0)
    expect(b.C[1]).toBeLessThan(a.C[1])
    expect(Math.hypot(b.C[0] - 8, b.C[1])).toBeCloseTo(10, 9)
  })
  it('the velocity ratio matches a numerical derivative of the rocker', () => {
    const h = 1e-6
    for (const t of [0.4, 1.7, 3, 4.5, 5.8]) {
      const dn = (solve(l, t + h)!.theta4 - solve(l, t - h)!.theta4) / (2 * h)
      expect(solve(l, t)!.velocityRatio).toBeCloseTo(dn, 5)
    }
  })
  it('mechanical advantage is the manual’s R_CD sin γ / (R_BA sin β) in size', () => {
    for (const t of [0.4, 1.7, 3, 4.5]) {
      const p = solve(l, t)!
      expect(Math.abs(p.mechanicalAdvantage)).toBeCloseTo((10 * Math.sin(p.gamma)) / (4 * Math.sin(p.beta)), 6)
    }
  })
  it('with crank and coupler in line (toggle) the advantage runs away', () => {
    // crank extended along the coupler: BD diagonal such that C, B and A are collinear
    let best = 0
    for (let t = 0; t < 2 * Math.PI; t += 0.001) best = Math.max(best, Math.abs(solve(l, t)!.mechanicalAdvantage))
    expect(best).toBeGreaterThan(100)
  })
})

describe('crank range', () => {
  it('a crank-rocker turns fully', () => expect(crankRange(L(8, 4, 12, 10))).toBeNull())
  it('a non-Grashof linkage has limits, and it closes right up to them', () => {
    const l = L(6, 4, 12, 9)
    const r = crankRange(l)!
    expect(r).not.toBeNull()
    expect(solve(l, r.hi - 1e-6)).not.toBeNull()
    expect(solve(l, r.hi + 1e-3)).toBeNull()
  })
})
