import type { Citation } from '@/content/citations'
import type { WorkingStep } from '@/ui/Working'
import type { Seed, Vals, VariantMaker } from './variants'

/** Subject areas. The ids are internal authoring keys and are never shown; users see the titles. */
export type Course = 'AEE509' | 'AEE510' | 'AEE502' | 'AEE501' | 'AEE503' | 'AEE518'

export const COURSES: { id: Course; title: string }[] = [
  { id: 'AEE509', title: 'Engines' },
  { id: 'AEE510', title: 'Transmission, hydraulics & tyres' },
  { id: 'AEE502', title: 'Tractor mechanics & implements' },
  { id: 'AEE501', title: 'Land clearing, tillage & machinery management' },
  { id: 'AEE503', title: 'Machine design' },
  { id: 'AEE518', title: 'Vibration & dynamic systems' },
]

export const courseTitle = (c: string) => COURSES.find((x) => x.id === c)?.title ?? c

/** One numeric answer box. */
export interface AnswerField {
  key: string
  /** KaTeX label, e.g. "F_t" */
  label: string
  unit: string
  /** the value stated in the notes / worked answer / marking guide (or the corrected value, when an erratum applies) */
  expected: number
  /** relative tolerance for checking (default 0.01 = 1 %) */
  tol?: number
  /** absolute tolerance floor, in the field's unit */
  abs?: number
}

export interface Question {
  id: string
  course: Course
  topic: string
  /** scene that shows this, for "open in 3D" */
  moduleId: string
  sceneId: string
  title: string
  /** the problem, with all given data */
  statement: string
  answers: AnswerField[]
  /** computes every answer key by calling the app's tested physics functions */
  solve: () => Record<string, number>
  /** worked solution, built from the solved values */
  working: (r: Record<string, number>) => WorkingStep[]
  cite: Citation
  /** id in src/content/errata.ts when the marking guide / notes differ */
  errata?: string
  /** passed to the scene's applyParams when opened from the question */
  params?: Record<string, unknown>
  /** parametric questions: makes variants with fresh numbers (see variants.ts) */
  vary?: VariantMaker
  /** which version this is: 'original' (the past paper) or a variant seed */
  variant?: Seed
  /** the input values of this version */
  values?: Vals
  /**
   * Method marks (error carried forward): what each later answer should be when worked
   * correctly from the student's own earlier answers. Return only the keys that follow.
   */
  follow?: (given: Record<string, number>) => Partial<Record<string, number>>
}

export const DEFAULT_TOL = 0.01

/** Is `given` an acceptable answer for this field, against the computed value? */
export function checkAnswer(field: AnswerField, computed: number, given: number) {
  if (!Number.isFinite(given)) return false
  const tol = Math.max(Math.abs(computed) * (field.tol ?? DEFAULT_TOL), field.abs ?? 0, 1e-12)
  return Math.abs(given - computed) <= tol
}

/** Parse a typed answer: accepts commas, spaces and "1.2e3". */
export function parseAnswer(s: string) {
  const t = s.replace(/[,\s]/g, '').replace(/×10\^?/, 'e')
  if (!t) return NaN
  return Number(t)
}
