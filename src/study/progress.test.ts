import { describe, expect, it } from 'vitest'
import { useProgress, summarise } from './progress'
import { checkAnswer, parseAnswer } from './types'

describe('study progress store (works without localStorage)', () => {
  it('records scene opens, tours and answers, and resets', () => {
    const p = useProgress.getState()
    p.reset()
    p.markOpened('pumps')
    p.markTour('gears')
    p.recordAnswer('q1', false)
    p.recordAnswer('q1', true)
    const s = useProgress.getState()
    expect(s.scenes.pumps.opened).toBeGreaterThan(0)
    expect(s.scenes.gears.tour).toBeGreaterThan(0)
    expect(s.questions.q1).toMatchObject({ attempts: 2, correct: 1 })
    expect(summarise(s, ['pumps', 'gears', 'belts'], ['q1', 'q2'])).toEqual({ scenes: 3, opened: 2, toured: 1, questions: 2, attempted: 1, solved: 1 })
    s.reset()
    expect(useProgress.getState().scenes).toEqual({})
  })
})

describe('answer checking', () => {
  const f = { key: 'x', label: 'x', unit: 'kW', expected: 100 }
  it('accepts within 1 % and rejects outside', () => {
    expect(checkAnswer(f, 100, 100.9)).toBe(true)
    expect(checkAnswer(f, 100, 101.5)).toBe(false)
    expect(checkAnswer({ ...f, abs: 0 }, 3, 3)).toBe(true)
  })
  it('parses typed numbers', () => {
    expect(parseAnswer('1,000.5')).toBe(1000.5)
    expect(parseAnswer(' 2.5e3 ')).toBe(2500)
    expect(Number.isNaN(parseAnswer(''))).toBe(true)
  })
})
