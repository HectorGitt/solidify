import { describe, expect, it } from 'vitest'
import { ERRATA } from '@/content/errata'
import { MODULES } from '@/modules/catalog'
import { COURSES, checkAnswer } from '../types'
import { QUESTIONS } from './index'

describe('exam question bank', () => {
  it('has at least 40 questions with unique ids, covering all the courses', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(40)
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
    expect(new Set(QUESTIONS.map((q) => q.course)).size).toBe(COURSES.length)
  })

  for (const q of QUESTIONS) {
    describe(`${q.id}: ${q.title}`, () => {
      const r = q.solve()
      for (const a of q.answers) {
        it(`${a.key} reproduces the stated answer ${a.expected} ${a.unit}`, () => {
          expect(Number.isFinite(r[a.key])).toBe(true)
          // the stated answer must be accepted by the checker against the computed value
          expect(checkAnswer(a, r[a.key], a.expected)).toBe(true)
        })
      }
      it('links to a real scene and errata entry; working renders', () => {
        const m = MODULES.find((x) => x.id === q.moduleId)
        expect(m?.scenes.some((s) => s.id === q.sceneId)).toBe(true)
        if (q.errata) expect(ERRATA.some((e) => e.id === q.errata)).toBe(true)
        expect(q.working(r).length).toBeGreaterThan(0)
      })
    })
  }
})
