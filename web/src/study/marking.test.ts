import { describe, expect, it } from 'vitest'
import { SLIPS, SLIP_TOL, diagnose, markAnswers } from './marking'
import type { AnswerField } from './types'

const f = (key: string, unit = 'kW'): AnswerField => ({ key, label: key, unit, expected: 0 })

describe('mistake diagnosis', () => {
  it('recognises the classic slips in both directions', () => {
    const cases: [number, number, string][] = [
      [13.6, 13600, 'kilo'], // W instead of kW
      [13.6, 0.0136, 'kilo'],
      [1800, 30, 'per-min'], // rev/s instead of rpm
      [6.808, 6.808 * 2 * Math.PI, '2pi'],
      [209.4, 2000, 'rpm-rads'], // rad/s expected, rpm given
      [0.75, 1.5, 'two'], // diameter for radius
      [19.63, 78.54, 'four'], // πd² instead of πd²/4
      [5.65, 5.65 / 3.6, 'kmh'], // m/s instead of km/h
      [12, 1200, 'percent'],
      [2000, 2000 * 9.81, 'g'],
      [0.5236, 30, 'deg-rad'],
      [100, 134.1, 'hp-kw'],
      [38, 965.2, 'inch-mm'],
    ]
    for (const [correct, given, slip] of cases) {
      const d = diagnose(f('x'), correct, given)
      expect(d, `${given} vs ${correct}`).not.toBeNull()
      expect(d!.kind === 'slip' && d!.slip, `${given} vs ${correct}`).toBe(slip)
    }
  })

  it('spots a wrong sign, a swapped box and early rounding', () => {
    expect(diagnose(f('dW'), 3.34, -3.34)?.kind).toBe('sign')
    expect(diagnose(f('front', 'kN'), 5.66, 22.84, [{ field: f('rear', 'kN'), value: 22.84 }])).toMatchObject({ kind: 'swap', message: expect.stringContaining('rear') })
    expect(diagnose(f('x'), 657.8, 670)?.kind).toBe('rounding')
  })

  it('says nothing about right answers, blanks, or unrelated numbers', () => {
    expect(diagnose(f('x'), 13.6, 13.62)).toBeNull()
    expect(diagnose(f('x'), 13.6, NaN)).toBeNull()
    expect(diagnose(f('x'), 13.6, 7.3)).toBeNull()
  })

  it('an exact slip is always named correctly (no factor lies within another’s tolerance)', () => {
    const fs = SLIPS.flatMap((s) => [{ id: s.id, f: s.factor }, { id: s.id, f: 1 / s.factor }])
    for (const a of fs)
      for (const b of fs) if (a !== b) expect(Math.abs(a.f / b.f - 1), `${a.id} vs ${b.id}`).toBeGreaterThan(SLIP_TOL)
    for (const s of SLIPS) for (const k of [s.factor, 1 / s.factor]) expect((diagnose(f('x'), 7.3, 7.3 * k) as { slip?: string })?.slip).toBe(s.id)
  })

  it('marks each box separately with feedback', () => {
    const m = markAnswers([f('bp'), f('t', 'N·m')], { bp: 13.6, t: 65 }, { bp: 13600, t: 65 })
    expect(m.map((x) => x.ok)).toEqual([false, true])
    expect(m[0].diagnosis?.kind).toBe('slip')
    expect(m[1].diagnosis).toBeNull()
  })
})
