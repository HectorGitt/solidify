import { allChallenges } from '@/challenges/registry'
import { MODULES } from '@/modules/catalog'
import type { ProgressData } from '@/study/progress'
import { QUESTIONS } from '@/study/questions'

export type AssignmentKind = 'scene' | 'question' | 'challenge'

export interface Assignment {
  id: string
  kind: AssignmentKind
  ref: string
  title: string
  due?: number
  better?: 'higher' | 'lower'
  createdAt: number
}

export interface AssignmentResult {
  complete: boolean
  label: string
  best?: number
  attempts?: number
}

/** Same rules as the API's dashboard (api/src/app.ts assignmentStatus). */
export function assignmentStatus(a: Pick<Assignment, 'kind' | 'ref'>, p: ProgressData): AssignmentResult {
  if (a.kind === 'scene') {
    const s = p.scenes[a.ref]
    return { complete: !!s?.tour, label: s?.tour ? 'Toured' : s?.opened ? 'Opened' : 'Not started' }
  }
  if (a.kind === 'question') {
    const q = p.questions[a.ref]
    const complete = (q?.correct ?? 0) > 0
    return { complete, attempts: q?.attempts ?? 0, label: complete ? `Solved (${q!.attempts} tries)` : q?.attempts ? `${q.attempts} tries` : 'Not started' }
  }
  const ch = p.challenges[a.ref]
  return { complete: !!ch, best: ch?.best, label: ch ? (ch.best !== undefined ? `Done, best ${Number(ch.best.toPrecision(4))}` : 'Done') : 'Not started' }
}

export interface Assignable {
  kind: AssignmentKind
  ref: string
  title: string
  /** grouping label in the picker */
  group: string
  /** where the student goes to do it */
  route: string
  better?: 'higher' | 'lower'
}

/** Every scene that can be assigned (built scenes only). Progress is keyed by scene id. */
export function assignableScenes(): Assignable[] {
  return MODULES.flatMap((m) =>
    m.scenes.filter((s) => s.load).map((s) => ({ kind: 'scene' as const, ref: s.id, title: s.title, group: m.title, route: `/m/${m.id}/${s.id}` })),
  )
}

export function assignableQuestions(): Assignable[] {
  return QUESTIONS.map((q) => ({ kind: 'question' as const, ref: q.id, title: q.title, group: q.topic, route: `/exam?q=${encodeURIComponent(q.id)}` }))
}

export async function assignableChallenges(): Promise<Assignable[]> {
  const list = await allChallenges()
  return list.map((c) => {
    const mod = MODULES.find((m) => m.id === c.moduleId)
    const scene = mod?.scenes.find((s) => (s.folder ?? s.id) === c.folder)
    return { kind: 'challenge' as const, ref: c.id, title: c.title, group: scene?.title ?? mod?.title ?? 'Challenges', route: `/m/${c.moduleId}/${scene?.id ?? c.folder}`, better: c.score?.better }
  })
}

/** Where to send a student for an assignment. */
export function assignmentRoute(a: Pick<Assignment, 'kind' | 'ref'>): string | null {
  if (a.kind === 'question') return `/exam?q=${encodeURIComponent(a.ref)}`
  if (a.kind === 'scene') {
    for (const m of MODULES) for (const s of m.scenes) if (s.id === a.ref) return `/m/${m.id}/${s.id}`
    return null
  }
  return '/challenges'
}
