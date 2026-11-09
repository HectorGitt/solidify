import { QUESTIONS } from './questions'
import type { Question } from './types'

const STOP = new Set(
  'the and for with that this from are its has have was were will into onto each what which find determine calculate given show also when then than them they there their per using use used take taken shown below above following same other both find work out value values'.split(' '),
)

const words = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .replace(/[^a-z0-9.\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => /^[a-z]{3,}$/.test(w) && !STOP.has(w)),
  )

/** the numbers a problem states, as written (1 500 and 1,500 read as 1500) */
const numbers = (t: string) => new Set((t.replace(/(\d)[\s,](?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n))))

export interface QuestionMatch {
  question: Question
  /** the same numbers too (the checked problem is this one exactly), or only the same problem */
  exact: boolean
  /** how much of the checked problem's wording the pasted text has, 0..1 */
  score: number
}

/**
 * Is this pasted problem one of Solidify's own checked ones? Compared by the words of each checked statement
 * found in the pasted text (most of them must be there) and by its numbers (all, or nearly all, for an exact
 * match). Only a clear match is returned: a near miss would open the wrong problem.
 */
export function matchQuestion(text: string, pool: Question[] = QUESTIONS): QuestionMatch | null {
  const w = words(text)
  const n = numbers(text)
  if (w.size < 3) return null
  let best: QuestionMatch | null = null
  for (const q of pool) {
    const qw = words(q.statement)
    if (qw.size < 3) continue
    let shared = 0
    for (const x of qw) if (w.has(x)) shared++
    const score = shared / qw.size
    if (score < 0.7 || (best && score <= best.score)) continue
    const qn = numbers(q.statement)
    let hits = 0
    for (const x of qn) if (n.has(x)) hits++
    const exact = qn.size === 0 ? true : hits / qn.size >= 0.85
    // a short statement ("Find the brake power…") has too few words to go by alone: its numbers must agree too
    if (qw.size < 6 && !exact) continue
    best = { question: q, exact, score }
  }
  return best
}
