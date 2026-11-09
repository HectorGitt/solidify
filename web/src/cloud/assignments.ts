import { allChallenges } from '@/challenges/registry'
import { MODULES } from '@/modules/catalog'
import type { ProgressData } from '@/study/progress'
import { QUESTIONS } from '@/study/questions'

/** scene, question, challenge: tracked from the student's progress; model, link, note: the student marks them done */
export type AssignmentKind = 'scene' | 'question' | 'challenge' | 'model' | 'link' | 'note'

export const RESOURCE_KINDS: AssignmentKind[] = ['model', 'link', 'note']
export const isResource = (k: AssignmentKind) => RESOURCE_KINDS.includes(k)

export const KIND_LABEL: Record<AssignmentKind, string> = {
  scene: 'Lab rig',
  question: 'Exam question',
  challenge: 'Challenge',
  model: 'Library model',
  link: 'Link',
  note: 'Note',
}

export interface Assignment {
  id: string
  kind: AssignmentKind
  ref: string
  title: string
  due?: number
  better?: 'higher' | 'lower'
  /** the teacher's instructions, or a note's text */
  note?: string
  createdAt: number
  /** a student's own "done" mark, for resources */
  doneAt?: number
}

export interface AssignmentResult {
  complete: boolean
  label: string
  best?: number
  attempts?: number
}

/** Same rules as the API's dashboard (api/src/app.ts assignmentStatus). */
export function assignmentStatus(a: Pick<Assignment, 'kind' | 'ref' | 'doneAt'>, p: ProgressData): AssignmentResult {
  if (isResource(a.kind)) return { complete: !!a.doneAt, label: a.doneAt ? 'Done' : 'Not started' }
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
  /** the subjects (course ids) it belongs to, for the class's subject filter */
  subjects: string[]
  /** where the student goes to do it */
  route: string
  better?: 'higher' | 'lower'
  thumbnail?: string
}

/** Every scene that can be assigned (built scenes only). Progress is keyed by scene id. */
export function assignableScenes(): Assignable[] {
  return MODULES.flatMap((m) =>
    m.scenes.filter((s) => s.load).map((s) => ({ kind: 'scene' as const, ref: s.id, title: s.title, group: m.title, subjects: m.courses, route: `/m/${m.id}/${s.id}` })),
  )
}

export function assignableQuestions(): Assignable[] {
  return QUESTIONS.map((q) => ({ kind: 'question' as const, ref: q.id, title: q.title, group: q.topic, subjects: [q.course], route: `/exam?q=${encodeURIComponent(q.id)}` }))
}

export async function assignableChallenges(): Promise<Assignable[]> {
  const list = await allChallenges()
  return list.map((c) => {
    const mod = MODULES.find((m) => m.id === c.moduleId)
    const scene = mod?.scenes.find((s) => (s.folder ?? s.id) === c.folder)
    return {
      kind: 'challenge' as const,
      ref: c.id,
      title: c.title,
      group: scene?.title ?? mod?.title ?? 'Challenges',
      subjects: mod?.courses ?? [],
      route: `/m/${c.moduleId}/${scene?.id ?? c.folder}`,
      better: c.score?.better,
    }
  })
}

/** Models in the library (checked by a reviewer), grouped by topic; they have no subject, so they show under every one. */
export async function assignableModels(): Promise<Assignable[]> {
  const { listLibrary } = await import('./admin')
  const { items } = await listLibrary()
  return items.map((m) => ({ kind: 'model' as const, ref: m.id, title: m.title, group: m.topic || 'Library', subjects: [], route: `/library?open=${encodeURIComponent(m.id)}`, thumbnail: m.thumbnail }))
}

/** Where to send a student for an assignment: an app route, an outside address (links), or nowhere (notes). */
export function assignmentRoute(a: Pick<Assignment, 'kind' | 'ref'>): string | null {
  if (a.kind === 'question') return `/exam?q=${encodeURIComponent(a.ref)}`
  if (a.kind === 'scene') {
    for (const m of MODULES) for (const s of m.scenes) if (s.id === a.ref) return `/m/${m.id}/${s.id}`
    return null
  }
  if (a.kind === 'model') return `/library?open=${encodeURIComponent(a.ref)}`
  if (a.kind === 'link') return a.ref
  if (a.kind === 'note') return null
  return '/challenges'
}
