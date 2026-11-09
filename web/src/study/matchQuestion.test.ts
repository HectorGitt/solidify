import { describe, expect, it } from 'vitest'
import { matchQuestion } from './matchQuestion'
import { QUESTIONS } from './questions'

describe('matching a pasted problem to a checked one', () => {
  it('finds every checked problem from its own statement, exactly', () => {
    for (const q of QUESTIONS) {
      const m = matchQuestion(q.statement)
      expect(m?.question.id, q.id).toBeTruthy()
      expect(m!.exact, q.id).toBe(true)
      // the match is this problem, or one worded the same with the same numbers
      expect(m!.question.statement === q.statement || m!.question.id === q.id, q.id).toBe(true)
    }
  })
  it('still finds it when pasted with other line breaks, case and thousands separators', () => {
    const q = QUESTIONS.find((x) => /\d{4}/.test(x.statement))!
    const messy = q.statement.toUpperCase().replace(/ /g, '\n').replace(/(\d)(\d{3})\b/, '$1,$2')
    expect(matchQuestion(messy)?.question.id).toBe(q.id)
  })
  it('knows the same problem with other numbers is not the checked one exactly', () => {
    const q = QUESTIONS.find((x) => /\d/.test(x.statement))!
    const other = q.statement.replace(/\d+(\.\d+)?/g, (n) => String(Number(n) + 7))
    const m = matchQuestion(other)
    expect(m?.question.id).toBe(q.id)
    expect(m?.exact).toBe(false)
  })
  it('leaves an unrelated problem alone', () => {
    expect(matchQuestion('A simply supported timber joist of span 3.6 m carries a uniformly distributed load. Determine the deflection at mid span using Young modulus 11 GPa.')?.exact ?? false).toBe(false)
    expect(matchQuestion('Design a rainwater harvesting tank for a farmhouse roof of area 120 square metres in Ibadan.')).toBeNull()
  })
})
