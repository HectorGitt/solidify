import { describe, expect, it } from 'vitest'
import { ackermannOuter, toeAB } from '@/physics/linkageControl'
import { AXLE, BOX, DEFAULTS, axleFor, rodForToeMM, solveSteer, toeVerdict } from './model'

const deg = Math.PI / 180
const toeMM = (p: Partial<typeof DEFAULTS>) => {
  const s = solveSteer({ ...DEFAULTS, ...p, wheel: 0 })
  return (s.B - s.A) * 1000
}

describe('Tractor Steering p5, Fig 47: toe-in A is 3–6 mm less than B', () => {
  it('the default track-rod setting gives toe-in inside 3–6 mm', () => {
    const d = toeMM({})
    expect(d).toBeGreaterThanOrEqual(3)
    expect(d).toBeLessThanOrEqual(6)
    expect(toeVerdict(d).tone).toBe('accent')
  })
  it('rodForToeMM sets exactly the asked toe-in', () => {
    expect(toeMM({ rodMM: rodForToeMM(4.5) })).toBeCloseTo(4.5, 2)
    expect(toeMM({ rodMM: 0 })).toBeCloseTo(0, 6)
  })
  it('a shorter track rod (behind the axle) gives toe-out', () => {
    expect(toeMM({ rodMM: -3 })).toBeLessThan(0)
    expect(toeVerdict(toeMM({ rodMM: -3 })).text).toBe('toe-out')
  })
  it('toeAB: equal and opposite toe angles give B − A = 4r·sinε', () => {
    const r = 0.2
    const e = 0.5 * deg
    expect(toeAB(1, r, e, -e).diff).toBeCloseTo(4 * r * Math.sin(e), 12)
  })
})

describe('Tractor Steering p2: the track rod must be reset after changing track width', () => {
  it('widening 80 mm without resetting the rod gives heavy toe-out', () => {
    expect(toeMM({ trackMM: 80, rodReset: false })).toBeLessThan(-50)
  })
  it('narrowing without resetting gives heavy toe-in', () => {
    expect(toeMM({ trackMM: -80, rodReset: false })).toBeGreaterThan(50)
  })
  it('resetting the rod by the same amount restores the toe-in', () => {
    expect(toeMM({ trackMM: 80, rodReset: true })).toBeCloseTo(toeMM({}), 0)
    expect(axleFor({ trackMM: 80, rodMM: 0, rodReset: true }).Lt - axleFor({ trackMM: 0, rodMM: 0, rodReset: true }).Lt).toBeCloseTo(0.08, 9)
  })
})

describe('Manual linkage kinematics (Fig 44)', () => {
  it('straight ahead: wheels symmetric about the toe-in, drop arm vertical', () => {
    const s = solveSteer({ ...DEFAULTS, wheel: 0 })
    expect(s.alpha).toBe(0)
    expect(s.dPlus).toBeCloseTo(-s.dMinus, 6)
  })
  it('steering box: about 1¼ turns swing the drop arm through its ±30° (Fig 46)', () => {
    expect(solveSteer({ ...DEFAULTS, wheel: 450 }).alpha / deg).toBeCloseTo(30, 6)
    expect(BOX.ratio).toBe(15)
  })
  it('both wheels turn the same way, the inner more than the outer (half lock)', () => {
    for (const w of [200, -200]) {
      const s = solveSteer({ ...DEFAULTS, wheel: w })
      expect(Math.sign(s.dPlus)).toBe(Math.sign(w))
      expect(Math.sign(s.dMinus)).toBe(Math.sign(w))
      expect(Math.abs(s.inner)).toBeGreaterThan(Math.abs(s.outer))
    }
  })
  it('the trapezoid stays within 3° of Ackermann up to 30° inner angle', () => {
    for (const w of [120, 200, 280]) {
      const s = solveSteer({ ...DEFAULTS, rodMM: 0, wheel: w })
      if (s.inner / deg > 30) continue
      expect(Math.abs(s.outer - s.ideal) / deg).toBeLessThan(3)
    }
  })
  it('Ackermann (beyond notes): cot δo − cot δi = track/wheelbase', () => {
    const i = 30 * deg
    const o = ackermannOuter(i, AXLE)
    expect(1 / Math.tan(o) - 1 / Math.tan(i)).toBeCloseTo((2 * AXLE.zk) / AXLE.wheelbase, 9)
  })
})
