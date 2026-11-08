import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FORMULA_FUNCTIONS, evalDim } from './schema'

const strict = (f: string) => evalDim(f, { x: 0.5, y: 2 }, Number.NaN, true)

describe('formula functions', () => {
  it('every listed function really computes (none passes its input through)', () => {
    const want: Record<string, number> = {
      sqrt: Math.sqrt(2), pow: 0.25, hypot: Math.hypot(0.5, 2), sin: Math.sin(0.5), cos: Math.cos(0.5), tan: Math.tan(0.5),
      asin: Math.asin(0.5), acos: Math.acos(0.5), atan: Math.atan(0.5), atan2: Math.atan2(0.5, 2), sinh: Math.sinh(0.5), cosh: Math.cosh(0.5),
      tanh: Math.tanh(0.5), exp: Math.exp(0.5), log: Math.log(2), ln: Math.log(2), log10: Math.log10(2), abs: 0.5, min: 0.5, max: 2,
      floor: 0, ceil: 1, round: 1, step: 1, mac: 0.25,
    }
    const call: Record<string, string> = { sqrt: 'sqrt(y)', pow: 'pow(x, y)', hypot: 'hypot(x, y)', atan2: 'atan2(x, y)', log: 'log(y)', ln: 'ln(y)', log10: 'log10(y)', min: 'min(x, y)', max: 'max(x, y)', mac: 'mac(x, 2)' }
    for (const f of FORMULA_FUNCTIONS) expect(strict(call[f] ?? `${f}(x)`), f).toBeCloseTo(want[f], 10)
  })
  it('in a calculation, what cannot be worked out is not a number', () => {
    for (const f of ['sqrt(-1)', 'asin(2)', 'log(0)', 'ln(-3)', 'nosuch(2)', 'zz * 2', '1 / 0']) expect(Number.isNaN(strict(f)), f).toBe(true)
  })
  it('the prompt tells Gemini about every function', () => {
    const prompt = readFileSync(new URL('../../../api/src/createPrompt.ts', import.meta.url), 'utf8')
    const line = prompt.split('\n').find((l) => l.includes('Formulas use parameter ids'))!
    for (const f of FORMULA_FUNCTIONS) expect(new RegExp(`\\b${f}\\b`).test(line), f).toBe(true)
  })
})
