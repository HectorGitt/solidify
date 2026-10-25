import { z } from 'zod'

/**
 * Mirrors src/study/progress.ts in the app. Timestamps are epoch milliseconds.
 * Merging two copies (this device vs the cloud) must never lose progress:
 *  - scenes: earliest `opened`, latest `tour`; tour checkpoints merged, keeping a right answer
 *  - questions: the larger attempts / correct counts and the latest `last`; the review
 *    schedule (box, due, score) comes from whichever copy has the latest attempt
 *    (counts are not summed: the same attempts would otherwise be counted twice on every sync)
 *  - challenges: earliest `done`, and the better `best` in the challenge's direction
 */

const key = z.string().min(1).max(120)
const time = z.number().int().nonnegative()

export const sceneProgress = z.object({
  opened: time.optional(),
  tour: time.optional(),
  /** tour checkpoints: step index → 1 right first time, 0 not */
  checks: z.record(z.string().regex(/^\d{1,3}$/), z.union([z.literal(0), z.literal(1)])).optional(),
})
export const questionProgress = z.object({
  attempts: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  last: time.optional(),
  /** spaced-repetition box 0–4, next review time and last score (0–1): see the app's review.ts */
  box: z.number().int().min(0).max(10).optional(),
  due: time.optional(),
  score: z.number().min(0).max(1).optional(),
})
export const challengeProgress = z.object({
  done: time,
  best: z.number().finite().optional(),
  better: z.enum(['higher', 'lower']).optional(),
})

export const progressSchema = z.object({
  scenes: z.record(key, sceneProgress).default({}),
  questions: z.record(key, questionProgress).default({}),
  challenges: z.record(key, challengeProgress).default({}),
})

export type Progress = z.infer<typeof progressSchema>
export type SceneProgress = z.infer<typeof sceneProgress>
export type QuestionProgress = z.infer<typeof questionProgress>
export type ChallengeProgress = z.infer<typeof challengeProgress>

export const MAX_ENTRIES = 5000

export const emptyProgress = (): Progress => ({ scenes: {}, questions: {}, challenges: {} })

const minDef = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b))
const maxDef = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.max(a, b))

function mergeScene(a?: SceneProgress, b?: SceneProgress): SceneProgress {
  const out: SceneProgress = {}
  const opened = minDef(a?.opened, b?.opened)
  const tour = maxDef(a?.tour, b?.tour)
  if (opened !== undefined) out.opened = opened
  if (tour !== undefined) out.tour = tour
  if (a?.checks || b?.checks) {
    const checks: Record<string, 0 | 1> = { ...(a?.checks ?? {}) }
    for (const [k, v] of Object.entries(b?.checks ?? {})) checks[k] = Math.max(checks[k] ?? 0, v) as 0 | 1
    out.checks = checks
  }
  return out
}

function mergeQuestion(a?: QuestionProgress, b?: QuestionProgress): QuestionProgress {
  const attempts = Math.max(a?.attempts ?? 0, b?.attempts ?? 0)
  const correct = Math.min(attempts, Math.max(a?.correct ?? 0, b?.correct ?? 0))
  const out: QuestionProgress = { attempts, correct }
  const last = maxDef(a?.last, b?.last)
  if (last !== undefined) out.last = last
  // the review schedule belongs to the most recent attempt
  const recent = (a?.last ?? -1) >= (b?.last ?? -1) ? a : b
  for (const k of ['box', 'due', 'score'] as const) {
    const v = recent?.[k] ?? (recent === a ? b : a)?.[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

function mergeChallenge(a?: ChallengeProgress, b?: ChallengeProgress): ChallengeProgress {
  if (!a) return { ...b! }
  if (!b) return { ...a }
  const better = a.better ?? b.better
  const out: ChallengeProgress = { done: Math.min(a.done, b.done) }
  if (better) out.better = better
  const best =
    a.best === undefined ? b.best : b.best === undefined ? a.best : better === 'lower' ? Math.min(a.best, b.best) : Math.max(a.best, b.best)
  if (best !== undefined) out.best = best
  return out
}

function mergeRecord<T>(a: Record<string, T>, b: Record<string, T>, f: (x?: T, y?: T) => T) {
  const out: Record<string, T> = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = f(a[k], b[k])
  return out
}

export function mergeProgress(a: Progress, b: Progress): Progress {
  return {
    scenes: mergeRecord(a.scenes, b.scenes, mergeScene),
    questions: mergeRecord(a.questions, b.questions, mergeQuestion),
    challenges: mergeRecord(a.challenges, b.challenges, mergeChallenge),
  }
}

export function entryCount(p: Progress) {
  return Object.keys(p.scenes).length + Object.keys(p.questions).length + Object.keys(p.challenges).length
}
