import { create } from 'zustand'
import { useProgress } from '@/study/progress'
import type { ChallengeEntry, CriterionResult } from './types'

export type ChallengeStatus = 'running' | 'won'

interface ChallengeState {
  active: ChallengeEntry | null
  status: ChallengeStatus
  /** seconds all criteria have held together */
  held: number
  results: CriterionResult[]
  /** score of the winning run */
  score: number | null
  /** previous best before this win */
  prevBest: number | null
  hintShown: boolean
  start: (c: ChallengeEntry, apply?: (p: Record<string, unknown>) => void) => void
  stop: () => void
  showHint: () => void
  /** evaluate the criteria; `dt` real seconds since the last tick (0 while paused) */
  tick: (dt: number) => void
}

export const useChallenge = create<ChallengeState>((set, get) => ({
  active: null,
  status: 'running',
  held: 0,
  results: [],
  score: null,
  prevBest: null,
  hintShown: false,
  start: (c, apply) => {
    if (c.setup && apply) apply(c.setup)
    set({ active: c, status: 'running', held: 0, results: [], score: null, prevBest: null, hintShown: false })
  },
  stop: () => set({ active: null, status: 'running', held: 0, results: [], score: null }),
  showHint: () => set({ hintShown: true }),
  tick: (dt) => {
    const s = get()
    const c = s.active
    if (!c || s.status === 'won') return
    let results: CriterionResult[]
    try {
      results = c.criteria.map((k) => k.check())
    } catch {
      return
    }
    const ok = results.every((r) => r.pass)
    const need = c.hold ?? 2
    const held = ok ? s.held + dt : 0
    if (ok && held >= need) {
      const score = c.score ? c.score.value() : null
      const prev = useProgress.getState().challenges[c.id]?.best ?? null
      useProgress.getState().recordChallenge(c.id, score ?? undefined, c.score?.better)
      set({ results, held, status: 'won', score, prevBest: prev })
      return
    }
    set({ results, held })
  },
}))

/** Is a new score better than a previous best? */
export function isBetter(score: number, prev: number | null | undefined, better: 'lower' | 'higher' = 'higher') {
  if (prev === null || prev === undefined) return true
  return better === 'lower' ? score < prev : score > prev
}
