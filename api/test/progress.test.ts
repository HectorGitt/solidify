import { describe, expect, it } from 'vitest'
import { emptyProgress, mergeProgress, progressSchema } from '../src/progress.js'

describe('progress merge', () => {
  it('keeps the earliest open and the latest tour of a scene', () => {
    const a = { ...emptyProgress(), scenes: { 'four-stroke-diesel': { opened: 100, tour: 300 } } }
    const b = { ...emptyProgress(), scenes: { 'four-stroke-diesel': { opened: 50 }, belts: { opened: 70 } } }
    expect(mergeProgress(a, b).scenes).toEqual({ 'four-stroke-diesel': { opened: 50, tour: 300 }, belts: { opened: 70 } })
  })

  it('takes the larger question counts instead of adding them, so repeated syncs never double count', () => {
    const a = { ...emptyProgress(), questions: { q1: { attempts: 3, correct: 1, last: 10 } } }
    const b = { ...emptyProgress(), questions: { q1: { attempts: 2, correct: 2, last: 20 } } }
    const m = mergeProgress(a, b)
    expect(m.questions.q1).toEqual({ attempts: 3, correct: 2, last: 20 })
    expect(mergeProgress(m, m)).toEqual(m)
  })

  it('never reports more correct answers than attempts', () => {
    const a = { ...emptyProgress(), questions: { q: { attempts: 1, correct: 1 } } }
    const b = { ...emptyProgress(), questions: { q: { attempts: 0, correct: 0 } } }
    expect(mergeProgress(a, b).questions.q.correct).toBeLessThanOrEqual(mergeProgress(a, b).questions.q.attempts)
  })

  it('keeps the better challenge score in the challenge direction', () => {
    const hi = mergeProgress(
      { ...emptyProgress(), challenges: { dyno: { done: 5, best: 30, better: 'higher' } } },
      { ...emptyProgress(), challenges: { dyno: { done: 2, best: 33 } } },
    )
    expect(hi.challenges.dyno).toEqual({ done: 2, best: 33, better: 'higher' })
    const lo = mergeProgress(
      { ...emptyProgress(), challenges: { fuel: { done: 5, best: 3.1, better: 'lower' } } },
      { ...emptyProgress(), challenges: { fuel: { done: 9, best: 2.4 } } },
    )
    expect(lo.challenges.fuel.best).toBe(2.4)
  })

  it('is order-independent', () => {
    const a = progressSchema.parse({ scenes: { s: { opened: 1 } }, questions: { q: { attempts: 1, correct: 0 } }, challenges: { c: { done: 4, best: 1 } } })
    const b = progressSchema.parse({ scenes: { s: { tour: 9 } }, questions: { q: { attempts: 4, correct: 1, last: 3 } }, challenges: { c: { done: 2, best: 5 } } })
    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a))
  })

  it('accepts the app’s stored shape, with missing sections defaulting to empty', () => {
    expect(progressSchema.parse({ scenes: { s: { opened: 1 } } })).toEqual({ scenes: { s: { opened: 1 } }, questions: {}, challenges: {} })
    expect(progressSchema.safeParse({ questions: { q: { attempts: -1, correct: 0 } } }).success).toBe(false)
  })
})
