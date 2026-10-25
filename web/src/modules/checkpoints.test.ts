import { describe, expect, it } from 'vitest'
import { MODULES } from './catalog'
import type { TourCheck } from './types'

/** Every guided-tour checkpoint is a fair, well-formed question. */
describe('tour checkpoints', () => {
  const scenes = MODULES.flatMap((m) => m.scenes.filter((s) => s.load).map((s) => ({ m, s })))

  it('every scene loads, and every checkpoint is well formed', async () => {
    let checks = 0
    for (const { m, s } of scenes) {
      const def = (await s.load!()).default
      ;(def.tour ?? []).forEach((step, i) => {
        const c: TourCheck | undefined = step.check
        if (!c) return
        checks++
        const where = `${m.id}/${s.id} step ${i + 1}`
        expect(c.question.trim().length, `${where}: question`).toBeGreaterThan(10)
        expect(c.options.length, `${where}: 2–4 options`).toBeGreaterThanOrEqual(2)
        expect(c.options.length, `${where}: 2–4 options`).toBeLessThanOrEqual(4)
        expect(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < c.options.length, `${where}: answer index`).toBe(true)
        expect(new Set(c.options).size, `${where}: distinct options`).toBe(c.options.length)
        expect(c.explain.trim().length, `${where}: explanation`).toBeGreaterThan(20)
        // the right answer must not stand out as the only long, detailed option
        const lens = c.options.map((o) => o.length)
        const others = lens.filter((_, k) => k !== c.answer)
        expect(lens[c.answer], `${where}: the right answer is much longer than the others`).toBeLessThanOrEqual(Math.max(...others) * 1.8 + 12)
        // the platform serves many schools: no course codes in any visible text
        for (const t of [c.question, c.explain, ...c.options]) expect(t, `${where}: course code`).not.toMatch(/\bA[EG]E\s?\d{3}\b/)
      })
    }
    expect(checks).toBeGreaterThan(0)
  }, 300_000)
})
