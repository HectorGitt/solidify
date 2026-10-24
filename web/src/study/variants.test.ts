import { describe, expect, it } from 'vitest'
import { QUESTIONS } from './questions'
import { drawValues, instantiate, num, prng, snap } from './variants'

describe('variant engine', () => {
  it('snaps without floating-point dust', () => {
    expect(snap(0.35000000000000003, 0.05)).toBe(0.35)
    expect(snap(2083.4, 1)).toBe(2083)
    expect(snap(7.24, 0.5)).toBe(7)
  })
  it('draws values inside each range, on the step grid, deterministically', () => {
    const inputs = [{ key: 'a', value: 1, min: 0.4, max: 0.9, step: 0.05 }, { key: 'b', value: 1, min: 1200, max: 2600, step: 50 }]
    for (let s = 1; s < 300; s++) {
      const v = drawValues(inputs, s)
      expect(v.a).toBeGreaterThanOrEqual(0.4)
      expect(v.a).toBeLessThanOrEqual(0.9)
      expect(Math.abs(v.b / 50 - Math.round(v.b / 50))).toBeLessThan(1e-9)
      expect(drawValues(inputs, s)).toEqual(v)
    }
    expect(prng(7)()).toBe(prng(7)())
  })
  it('formats statement numbers cleanly', () => {
    expect(num(2083)).toBe('2083')
    expect(num(20000)).toBe('20 000')
    expect(num(0.85)).toBe('0.85')
  })
})

const SEEDS = 200

for (const q of QUESTIONS.filter((x) => x.vary)) {
  describe(`variants of ${q.id}`, () => {
    const inputs = q.vary!.inputs
    it('the past-paper values sit inside the variant ranges', () => {
      for (const i of inputs) {
        expect(i.value).toBeGreaterThanOrEqual(i.min)
        expect(i.value).toBeLessThanOrEqual(i.max)
      }
    })
    it(`${SEEDS} variants: valid, finite, fully templated, with working`, () => {
      const statements = new Set<string>()
      let changed = 0
      for (let s = 1; s <= SEEDS; s++) {
        const v = instantiate(q, s)
        const r = v.solve()
        for (const a of q.answers) expect(Number.isFinite(r[a.key]), `${a.key} for seed ${s}`).toBe(true)
        if (v.variant === 'original') continue // no valid draw found: falls back, allowed but rare
        changed++
        if (q.vary!.valid) expect(q.vary!.valid(v.values!, r)).toBe(true)
        // every input value must appear in the statement, so no number is left hard-coded
        for (const i of inputs) expect(v.statement, `${i.key}=${v.values![i.key]} (seed ${s})`).toContain(num(v.values![i.key]))
        expect(v.working(r).length).toBeGreaterThan(0)
        expect(instantiate(q, s).statement).toBe(v.statement)
        statements.add(v.statement)
      }
      expect(changed).toBeGreaterThan(SEEDS * 0.9)
      expect(statements.size).toBeGreaterThan(SEEDS * 0.5)
    })
  })
}
