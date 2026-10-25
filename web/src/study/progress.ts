import { create } from 'zustand'
import { schedule } from './review'

/** Per-scene study record. Keyed by scene id (unique across the catalogue). */
export interface SceneProgress {
  opened?: number
  tour?: number
  /** tour checkpoints: step index → 1 if right first time, 0 if not */
  checks?: Record<string, number>
}

export interface QuestionProgress {
  attempts: number
  correct: number
  last?: number
  /** spaced-repetition box 0–4 (see review.ts) */
  box?: number
  /** when the next review is due */
  due?: number
  /** score of the last attempt, 0–1 (method marks count ½ per box) */
  score?: number
}

export interface ChallengeProgress {
  /** when it was first completed */
  done: number
  best?: number
  /** which way a better score goes (lets the cloud copy keep the right best) */
  better?: 'higher' | 'lower'
}

export interface ProgressData {
  scenes: Record<string, SceneProgress>
  questions: Record<string, QuestionProgress>
  challenges: Record<string, ChallengeProgress>
}

const KEY = 'agritech.progress.v1'
const EMPTY: ProgressData = { scenes: {}, questions: {}, challenges: {} }

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as Partial<ProgressData>
      return { scenes: d.scenes ?? {}, questions: d.questions ?? {}, challenges: d.challenges ?? {} }
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return { scenes: {}, questions: {}, challenges: {} }
}

function save(d: ProgressData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* ignore */
  }
}

interface ProgressState extends ProgressData {
  markOpened: (sceneId: string) => void
  markTour: (sceneId: string) => void
  /** first answer to a tour checkpoint (later answers don't change it) */
  recordCheck: (sceneId: string, step: number, correct: boolean) => void
  /** `score` is 0–1 (defaults to 1 when correct, 0 otherwise) */
  recordAnswer: (questionId: string, correct: boolean, score?: number) => void
  recordChallenge: (id: string, score?: number, better?: 'lower' | 'higher') => void
  /** replace everything, e.g. with the merged copy from cloud sync */
  replaceAll: (d: ProgressData) => void
  reset: () => void
}

export const useProgress = create<ProgressState>((set, get) => {
  const commit = (d: ProgressData) => {
    save(d)
    set(d)
  }
  return {
    ...load(),
    markOpened: (id) => {
      const { scenes, questions, challenges } = get()
      if (scenes[id]?.opened) return
      commit({ questions, challenges, scenes: { ...scenes, [id]: { ...scenes[id], opened: Date.now() } } })
    },
    markTour: (id) => {
      const { scenes, questions, challenges } = get()
      const now = Date.now()
      commit({ questions, challenges, scenes: { ...scenes, [id]: { ...scenes[id], opened: scenes[id]?.opened ?? now, tour: now } } })
    },
    recordCheck: (id, step, correct) => {
      const { scenes, questions, challenges } = get()
      const prev = scenes[id]?.checks ?? {}
      if (String(step) in prev) return
      commit({ questions, challenges, scenes: { ...scenes, [id]: { ...scenes[id], opened: scenes[id]?.opened ?? Date.now(), checks: { ...prev, [step]: correct ? 1 : 0 } } } })
    },
    recordAnswer: (id, correct, score) => {
      const { scenes, questions, challenges } = get()
      const q = questions[id] ?? { attempts: 0, correct: 0 }
      const now = Date.now()
      const s = correct ? 1 : Math.min(0.99, Math.max(0, score ?? 0))
      commit({ scenes, challenges, questions: { ...questions, [id]: { attempts: q.attempts + 1, correct: q.correct + (correct ? 1 : 0), last: now, score: s, ...schedule(q, s, now) } } })
    },
    recordChallenge: (id, score, better = 'higher') => {
      const { scenes, questions, challenges } = get()
      const prev = challenges[id]
      let best = prev?.best
      if (score !== undefined && Number.isFinite(score)) best = best === undefined ? score : better === 'lower' ? Math.min(best, score) : Math.max(best, score)
      commit({ scenes, questions, challenges: { ...challenges, [id]: { done: prev?.done ?? Date.now(), ...(best !== undefined ? { best, better } : {}) } } })
    },
    replaceAll: (d) => commit({ scenes: { ...d.scenes }, questions: { ...d.questions }, challenges: { ...d.challenges } }),
    reset: () => commit({ ...EMPTY, scenes: {}, questions: {}, challenges: {} }),
  }
})

/** Fraction-style summary for a set of scenes and questions. */
export function summarise(
  p: ProgressData,
  sceneIds: string[],
  questionIds: string[],
): { scenes: number; opened: number; toured: number; questions: number; attempted: number; solved: number } {
  return {
    scenes: sceneIds.length,
    opened: sceneIds.filter((s) => p.scenes[s]?.opened).length,
    toured: sceneIds.filter((s) => p.scenes[s]?.tour).length,
    questions: questionIds.length,
    attempted: questionIds.filter((q) => (p.questions[q]?.attempts ?? 0) > 0).length,
    solved: questionIds.filter((q) => (p.questions[q]?.correct ?? 0) > 0).length,
  }
}
