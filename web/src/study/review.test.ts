import { describe, expect, it } from 'vitest'
import { DAY, dueQuestions, questionMastery, schedule, suggestTopic, topicMastery } from './review'

const now = Date.UTC(2026, 9, 25)

describe('spaced repetition', () => {
  it('moves up a box on a fully correct answer: 1, 3, 7, 21 days', () => {
    let s = schedule(undefined, 1, now)
    expect(s).toEqual({ box: 1, due: now + 1 * DAY })
    s = schedule(s, 1, now)
    expect(s.due - now).toBe(3 * DAY)
    s = schedule(s, 1, now)
    expect(s.due - now).toBe(7 * DAY)
    s = schedule(s, 1, now)
    expect(s).toEqual({ box: 4, due: now + 21 * DAY })
    expect(schedule(s, 1, now).box).toBe(4)
  })
  it('anything less than full marks comes back tomorrow, from box 0', () => {
    expect(schedule({ box: 3 }, 0.5, now)).toEqual({ box: 0, due: now + DAY })
    expect(schedule({ box: 4 }, 0, now)).toEqual({ box: 0, due: now + DAY })
  })
  it('lists due questions, most overdue first, and never unseen ones', () => {
    const q = {
      a: { attempts: 1, correct: 0, due: now - 2 * DAY },
      b: { attempts: 2, correct: 1, due: now - DAY },
      c: { attempts: 1, correct: 1, due: now + DAY },
    }
    expect(dueQuestions(q, ['a', 'b', 'c', 'never'], now)).toEqual(['a', 'b'])
  })
})

describe('mastery', () => {
  it('rises with the box reached; a near miss counts a little', () => {
    expect(questionMastery(undefined)).toBe(0)
    expect(questionMastery({ attempts: 1, correct: 0, box: 0, score: 0.5 })).toBeCloseTo(0.125)
    expect(questionMastery({ attempts: 3, correct: 3, box: 2 })).toBe(0.5)
    expect(questionMastery({ attempts: 9, correct: 9, box: 4 })).toBe(1)
    // progress recorded before spaced repetition existed
    expect(questionMastery({ attempts: 2, correct: 1 })).toBe(0.25)
  })
  it('averages over a topic and suggests what to practise next', () => {
    const items = [
      { id: 'w1', topic: 'Weight transfer' },
      { id: 'w2', topic: 'Weight transfer' },
      { id: 'h1', topic: 'Hydraulics' },
      { id: 'g1', topic: 'Gearing' },
    ]
    const q = { w1: { attempts: 2, correct: 2, box: 4, due: now + 9 * DAY }, w2: { attempts: 1, correct: 0, box: 0, score: 0, due: now + DAY }, h1: { attempts: 1, correct: 1, box: 1, due: now - 1 } }
    const t = topicMastery(q, items, now)
    expect(t.find((x) => x.topic === 'Weight transfer')!.mastery).toBe(0.5)
    expect(suggestTopic(t)!.topic).toBe('Hydraulics') // has a review due
    const later = topicMastery(q, items, now - 2 * DAY)
    expect(suggestTopic(later)!.topic).toBe('Hydraulics') // weakest started (0.25 < 0.5)
  })
})
