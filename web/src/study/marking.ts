import { checkAnswer, type AnswerField } from './types'

/**
 * Examiner-style feedback on a wrong numeric answer: is it the right answer distorted by one of
 * the classic slips (a unit prefix, rpm vs rad/s, radius vs diameter, …)? Each check compares the
 * student's value with the correct one times or divided by a factor, within a tight tolerance,
 * so a match is very unlikely to be a coincidence.
 */

export interface Slip {
  id: string
  factor: number
  /** feedback when the answer is the correct value × factor */
  big: string
  /** feedback when the answer is the correct value ÷ factor */
  small: string
}

const PI2 = 2 * Math.PI

/** Ordered from most to least specific; the first match wins. */
export const SLIPS: Slip[] = [
  { id: 'rpm-rads', factor: PI2 / 60, big: 'Looks like rpm was converted to rad/s where it shouldn’t be (×2π/60).', small: 'Looks like a speed was left in rpm where rad/s was needed: multiply by 2π/60.' },
  { id: '2pi', factor: PI2, big: 'Off by 2π: check whether a 2π belongs here (rev vs rad).', small: 'Off by 2π: a 2π seems to be missing (e.g. P = 2πNT/60, or rev/s → rad/s).' },
  { id: 'deg-rad', factor: 180 / Math.PI, big: 'Off by 57.3: the angle looks like it is in degrees where radians were needed.', small: 'Off by 57.3: the angle looks like it is in radians; give it in degrees.' },
  { id: 'hp-kw', factor: 1 / 0.7457, big: 'This is the answer in horsepower; the question asks for kW.', small: 'This is the answer in kW; the question asks for horsepower.' },
  { id: 'inch-mm', factor: 25.4, big: 'Off by 25.4: an inch value seems to have been converted to mm twice, or mm used for inches.', small: 'Off by 25.4: convert inches to millimetres (1 in = 25.4 mm).' },
  { id: 'g', factor: 9.81, big: 'Off by g (9.81): a weight in N seems to have been used where mass in kg was needed.', small: 'Off by g (9.81): mass in kg seems to have been used where weight in N was needed.' },
  { id: 'kmh', factor: 3.6, big: 'Off by 3.6: this looks like km/h where m/s was asked (or the reverse conversion done twice).', small: 'Off by 3.6: this looks like m/s; convert to km/h (×3.6).' },
  { id: 'per-min', factor: 60, big: 'Off by 60: check per minute vs per second (rpm vs rev/s, L/min vs L/s, h vs min).', small: 'Off by 60: check per minute vs per second (rpm vs rev/s, L/min vs L/s, h vs min).' },
  { id: 'mega', factor: 1e6, big: 'Off by a million: check mm² vs m², or Pa vs MPa.', small: 'Off by a million: check mm² vs m², or Pa vs MPa.' },
  { id: 'kilo', factor: 1000, big: 'Off by 1000: check the unit prefix (N vs kN, W vs kW, mm vs m, g vs kg).', small: 'Off by 1000: check the unit prefix (N vs kN, W vs kW, mm vs m, g vs kg).' },
  { id: 'percent', factor: 100, big: 'Off by 100: give a fraction, or check cm vs m.', small: 'Off by 100: give it as a percentage, or check cm vs m.' },
  { id: 'ten', factor: 10, big: 'Off by 10: check the decimal point, or bar vs MPa.', small: 'Off by 10: check the decimal point, or bar vs MPa.' },
  { id: 'four', factor: 4, big: 'Off by 4: check the area. Use πd²/4, not πd².', small: 'Off by 4: check the area. Use πd²/4, not πd²/16 or (πd/4)².' },
  { id: 'two', factor: 2, big: 'Off by 2: diameter used where the radius was needed?', small: 'Off by 2: radius used where the diameter was needed, or a missing factor of 2?' },
]

export type Diagnosis = { kind: 'slip'; slip: string; message: string } | { kind: 'sign' | 'swap' | 'rounding' | 'carried'; message: string }

const near = (a: number, b: number, rel: number) => Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-12)

/** Tolerance for matching a slip: tight, so coincidences are rare. */
export const SLIP_TOL = 0.012

/**
 * Explain a wrong answer, or return null when nothing specific is recognised.
 * `others` are the correct values of the question's other answer boxes (to spot swapped boxes).
 */
export function diagnose(field: AnswerField, correct: number, given: number, others: { field: AnswerField; value: number }[] = []): Diagnosis | null {
  if (!Number.isFinite(given) || !Number.isFinite(correct) || checkAnswer(field, correct, given)) return null
  if (correct !== 0 && near(given, -correct, SLIP_TOL)) return { kind: 'sign', message: 'Right size, wrong sign: check the direction or which way round you subtracted.' }
  for (const o of others) {
    if (o.value !== 0 && near(given, o.value, 0.01) && !near(o.value, correct, 0.01)) {
      return { kind: 'swap', message: `That’s the value for ${o.field.key} (${o.field.unit}). Is it in the wrong box?` }
    }
  }
  if (correct !== 0) {
    for (const s of SLIPS) {
      if (near(given, correct * s.factor, SLIP_TOL)) return { kind: 'slip', slip: s.id, message: s.big }
      if (near(given, correct / s.factor, SLIP_TOL)) return { kind: 'slip', slip: s.id, message: s.small }
    }
    if (near(given, correct, 0.05)) return { kind: 'rounding', message: 'Close, but outside the tolerance: carry more significant figures through the intermediate steps.' }
  }
  return null
}

export interface FieldMark {
  field: AnswerField
  computed: number
  given: number
  ok: boolean
  /** wrong, but worked correctly from the student's own earlier (wrong) answer */
  carried: boolean
  diagnosis: Diagnosis | null
}

/**
 * Mark every answer box of a question, with feedback on the wrong ones. `follow` (from the
 * question) gives what later answers should be when worked from the student's own earlier
 * answers: a match earns the method mark, as an examiner would ("error carried forward").
 */
export function markAnswers(
  fields: AnswerField[],
  computed: Record<string, number>,
  given: Record<string, number>,
  follow?: (given: Record<string, number>) => Partial<Record<string, number>>,
): FieldMark[] {
  const finiteGiven = Object.fromEntries(Object.entries(given).filter(([, v]) => Number.isFinite(v)))
  let followed: Partial<Record<string, number>> = {}
  try {
    followed = follow ? follow(finiteGiven) : {}
  } catch {
    followed = {}
  }
  return fields.map((f) => {
    const value = given[f.key]
    const ok = Number.isFinite(value) && checkAnswer(f, computed[f.key], value)
    const ecf = followed[f.key]
    const carried = !ok && Number.isFinite(value) && ecf !== undefined && Number.isFinite(ecf) && checkAnswer(f, ecf, value)
    const others = fields.filter((o) => o.key !== f.key).map((o) => ({ field: o, value: computed[o.key] }))
    const diagnosis: Diagnosis | null = ok || !Number.isFinite(value)
      ? null
      : carried
        ? { kind: 'carried', message: 'Method correct from your earlier answer: method mark awarded, but fix the earlier step.' }
        : diagnose(f, computed[f.key], value, others)
    return { field: f, computed: computed[f.key], given: value, ok, carried, diagnosis }
  })
}

/** Examiner-style score: 1 per correct box, ½ for a box with only the method right. */
export function scoreMarks(marks: FieldMark[]) {
  const got = marks.reduce((s, m) => s + (m.ok ? 1 : m.carried ? 0.5 : 0), 0)
  return { got, of: marks.length }
}
