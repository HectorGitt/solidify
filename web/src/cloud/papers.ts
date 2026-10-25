import { SLIPS, type FieldMark } from '@/study/marking'

/** A timed class paper (see api/src/app.ts). */
export interface Paper {
  id: string
  title: string
  questionIds: string[]
  minutes: number
  due?: number
  createdAt: number
  attempt?: { startedAt: number; submittedAt: number | null; total: number | null } | null
}

export interface PaperAttempt {
  startedAt: number
  submittedAt?: number
  late?: boolean
  answers?: Record<string, Record<string, string>>
  results?: Record<string, { score: number; slips: string[] }>
  total?: number
}

/**
 * Each student's own numbers on a paper: a stable seed from their account, the paper and the
 * question, so reloading shows the same numbers but two students get different ones.
 */
export function paperSeed(uid: string, paperId: string, questionId: string) {
  let h = 2166136261
  for (const ch of `${uid}|${paperId}|${questionId}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 2 ** 30 || 1
}

/** The mistake ids the marker recognised in a question's boxes (for the class report). */
export function slipsOf(marks: FieldMark[]): string[] {
  return marks.flatMap((m) => (m.ok || !m.diagnosis ? [] : m.diagnosis.kind === 'slip' ? [m.diagnosis.slip] : [m.diagnosis.kind]))
}

/** Short names for mistakes, for the teacher's report. */
export const SLIP_NAMES: Record<string, string> = {
  'rpm-rads': 'rpm vs rad/s',
  '2pi': 'missing or extra 2π',
  'deg-rad': 'degrees vs radians',
  'hp-kw': 'kW vs horsepower',
  'inch-mm': 'inches vs mm',
  g: 'mass vs weight (g)',
  kmh: 'km/h vs m/s',
  'per-min': 'per minute vs per second',
  mega: 'mm² vs m², Pa vs MPa',
  kilo: 'unit prefix (×1000)',
  percent: 'percent vs fraction',
  ten: 'decimal point (×10)',
  four: 'area: πd²/4',
  two: 'radius vs diameter',
  sign: 'wrong sign',
  swap: 'answer in the wrong box',
  rounding: 'rounded too early',
  carried: 'earlier mistake carried forward',
}

// every slip the marker knows has a name here
for (const s of SLIPS) if (!SLIP_NAMES[s.id]) SLIP_NAMES[s.id] = s.id
