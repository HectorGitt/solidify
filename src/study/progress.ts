import { create } from 'zustand'

/** Per-scene study record. Keyed by scene id (unique across the catalogue). */
export interface SceneProgress {
  opened?: number
  tour?: number
}

export interface QuestionProgress {
  attempts: number
  correct: number
  last?: number
}

interface ProgressData {
  scenes: Record<string, SceneProgress>
  questions: Record<string, QuestionProgress>
}

const KEY = 'agritech.progress.v1'
const EMPTY: ProgressData = { scenes: {}, questions: {} }

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as Partial<ProgressData>
      return { scenes: d.scenes ?? {}, questions: d.questions ?? {} }
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return { scenes: {}, questions: {} }
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
  recordAnswer: (questionId: string, correct: boolean) => void
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
      const { scenes, questions } = get()
      if (scenes[id]?.opened) return
      commit({ questions, scenes: { ...scenes, [id]: { ...scenes[id], opened: Date.now() } } })
    },
    markTour: (id) => {
      const { scenes, questions } = get()
      const now = Date.now()
      commit({ questions, scenes: { ...scenes, [id]: { opened: scenes[id]?.opened ?? now, tour: now } } })
    },
    recordAnswer: (id, correct) => {
      const { scenes, questions } = get()
      const q = questions[id] ?? { attempts: 0, correct: 0 }
      commit({ scenes, questions: { ...questions, [id]: { attempts: q.attempts + 1, correct: q.correct + (correct ? 1 : 0), last: Date.now() } } })
    },
    reset: () => commit({ ...EMPTY, scenes: {}, questions: {} }),
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
