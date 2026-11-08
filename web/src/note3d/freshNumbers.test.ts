import { describe, expect, it } from 'vitest'
import { freshNumbers } from './freshNumbers'
import { evaluateCalculations, type NoteSceneSpec } from './schema'

// a 6 m beam, 20 kN at a from A, 5 kN/m: R_B = (P a + w L² / 2) / L, and the load must stay on the beam
const beam: Pick<NoteSceneSpec, 'parameters' | 'calculations'> = {
  parameters: [
    { id: 'L', label: 'Span', symbol: 'L', value: 6, min: 1, max: 12, step: 0.5, unit: 'm' },
    { id: 'P', label: 'Load', symbol: 'P', value: 20, min: 0, max: 60, step: 1, unit: 'kN' },
    { id: 'a', label: 'Position', symbol: 'a', value: 5, min: 0, max: 12, step: 0.5, unit: 'm' },
    { id: 'w', label: 'UDL', symbol: 'w', value: 5, min: 0, max: 20, step: 0.5, unit: 'kN/m' },
  ],
  calculations: [
    { id: 'R_B', label: 'R_B', symbol: 'R_B', formula: '(P * a + w * L ^ 2 / 2) / L', unit: 'kN' },
    { id: 'gap', label: 'Load to B', symbol: 'b', formula: 'L - a', unit: 'm' },
  ],
}

describe('new numbers for a solved problem', () => {
  it('stay near the stated values, on the sliders and their steps, and keep every step sensible', () => {
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let k = 0; k < 50; k++) {
      const v = freshNumbers(beam, 0.3, 40, random)!
      expect(v).not.toBeNull()
      for (const p of beam.parameters) {
        expect(v[p.id]).toBeGreaterThanOrEqual(Math.max(p.min, p.value * 0.7) - 1e-9)
        expect(v[p.id]).toBeLessThanOrEqual(Math.min(p.max, p.value * 1.3) + 1e-9)
        expect(Math.abs(((v[p.id] - p.min) / p.step) % 1)).toBeLessThan(1e-6)
      }
      // the load is still on the beam (L - a keeps its sign)
      const r = evaluateCalculations(beam.calculations, v).results
      expect(r[1].value).toBeGreaterThan(0)
    }
  })
  it('gives up rather than return impossible numbers', () => {
    const impossible = { ...beam, calculations: [{ id: 'x', label: 'x', symbol: 'x', formula: 'sqrt(-L)', unit: '' }] }
    expect(freshNumbers(impossible)).toBeNull()
  })
})
