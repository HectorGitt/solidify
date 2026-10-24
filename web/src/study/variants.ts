import type { WorkingStep } from '@/ui/Working'
import type { Question } from './types'

/**
 * Parametric exam questions. A question declares its inputs (with the past-paper value and a
 * realistic range) and builds its statement, answers, worked solution and scene setup from
 * them. `instantiate(q, seed)` gives a variant with fresh numbers; seed 'original' is the past
 * paper exactly. Variants are deterministic: the same seed always gives the same numbers.
 */

export type Vals = Record<string, number>

export interface InputSpec {
  key: string
  /** the value in the past paper / worked example */
  value: number
  /** realistic range for variants */
  min: number
  max: number
  /** variants are rounded to a multiple of this (e.g. 50 rpm, 0.05 m) */
  step: number
}

export interface VariantMaker {
  inputs: InputSpec[]
  at: (v: Vals) => Pick<Question, 'statement' | 'solve' | 'working' | 'params'>
  /** extra physical sanity check for a generated variant */
  valid?: (v: Vals, r: Record<string, number>) => boolean
}

export type Seed = number | 'original'

/** Small fast seeded PRNG (mulberry32). */
export function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const decimals = (step: number) => {
  const s = String(step)
  return s.includes('e-') ? Number(s.split('e-')[1]) : (s.split('.')[1] ?? '').length
}

/** Round to a multiple of `step` without floating-point dust (0.35, not 0.35000000000000003). */
export function snap(x: number, step: number) {
  return Number((Math.round(x / step) * step).toFixed(decimals(step)))
}

/** Pick input values for a seed. */
export function drawValues(inputs: InputSpec[], seed: number): Vals {
  const rnd = prng(seed)
  const v: Vals = {}
  for (const i of inputs) {
    const lo = Math.ceil(i.min / i.step - 1e-9)
    const hi = Math.floor(i.max / i.step + 1e-9)
    v[i.key] = snap((lo + Math.floor(rnd() * (hi - lo + 1))) * i.step, i.step)
  }
  return v
}

export const originalValues = (inputs: InputSpec[]): Vals => Object.fromEntries(inputs.map((i) => [i.key, i.value]))

type Base = Omit<Question, 'statement' | 'solve' | 'working' | 'params' | 'vary' | 'variant' | 'values'>

export interface ParametricSpec extends Base {
  inputs: InputSpec[]
  statement: (v: Vals) => string
  solve: (v: Vals) => Record<string, number>
  /** `original` is true for the past-paper numbers (e.g. to show an erratum that only applies there) */
  working: (v: Vals, r: Record<string, number>, original: boolean) => WorkingStep[]
  params?: (v: Vals) => Record<string, unknown>
  valid?: (v: Vals, r: Record<string, number>) => boolean
}

/** Author a parametric question. The returned question *is* the past-paper version. */
export function parametric(spec: ParametricSpec): Question {
  const { inputs, statement, solve, working, params, valid, ...base } = spec
  const orig = originalValues(inputs)
  const same = (v: Vals) => inputs.every((i) => v[i.key] === i.value)
  const at = (v: Vals) => ({
    statement: statement(v),
    solve: () => solve(v),
    working: (r: Record<string, number>) => working(v, r, same(v)),
    params: params?.(v),
  })
  return { ...base, ...at(orig), vary: { inputs, at, valid }, variant: 'original', values: orig }
}

const finite = (r: Record<string, number>, keys: string[]) => keys.every((k) => Number.isFinite(r[k]))

/**
 * A concrete version of a question. Fixed (non-parametric) questions and seed 'original'
 * return the past-paper question. Otherwise tries successive sub-seeds until the numbers give
 * a valid, finite answer (falls back to the original if none does).
 */
export function instantiate(q: Question, seed: Seed): Question {
  if (!q.vary || seed === 'original') return q
  const keys = q.answers.map((a) => a.key)
  for (let k = 0; k < 40; k++) {
    const v = drawValues(q.vary.inputs, seed * 41 + k)
    const inst = q.vary.at(v)
    const r = inst.solve()
    if (finite(r, keys) && (q.vary.valid?.(v, r) ?? true)) return { ...q, ...inst, variant: seed, values: v }
  }
  return q
}

export const randomSeed = () => 1 + Math.floor(Math.random() * 2 ** 30)

/** Number for a statement: no trailing zeros, thousands separated by a thin space when ≥ 10 000. */
export function num(x: number, maxDecimals = 4) {
  const s = Number(x.toFixed(maxDecimals)).toString()
  const [i, d] = s.split('.')
  const int = Math.abs(Number(i)) >= 10000 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : i
  return d ? `${int}.${d}` : int
}

/** The same number for KaTeX working: exact, with `\,` thousands separators. */
export function tnum(x: number, maxDecimals = 4) {
  return num(x, maxDecimals).replace(/ /g, '\\,')
}
