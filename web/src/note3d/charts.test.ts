import { describe, expect, it } from 'vitest'
import { evalDim, evaluateCalculations, evaluateChart, noteChartSchema, type NoteChartSpec } from './schema'

describe('chart formulas', () => {
  it('has the step and Macaulay functions beam diagrams need', () => {
    expect(evalDim('step(x - 2)', { x: 1 })).toBe(0)
    expect(evalDim('step(x - 2)', { x: 2 })).toBe(1)
    expect(evalDim('mac(x - 2, 1)', { x: 1 })).toBe(0)
    expect(evalDim('mac(x - 2, 2)', { x: 5 })).toBe(9)
    expect(evalDim('exp(0) + log(1) + atan(0)', {})).toBe(1)
  })

  it('draws a simply supported beam with a point load: peak moment Pab/L under the load', () => {
    // P = 10 kN at a = 1 m on a 4 m span: R1 = P(L - a)/L = 7.5 kN, M_max = Pab/L = 7.5 kN·m at x = 1 m
    const params = { P: 10, a: 1, L: 4 }
    const { scope } = evaluateCalculations([{ id: 'R1', label: 'Left reaction', symbol: 'R_1', formula: 'P * (L - a) / L', unit: 'kN' }], params)
    const chart: NoteChartSpec = {
      id: 'bmd',
      title: 'Bending moment',
      x: { label: 'Position', unit: 'm', from: 0, to: 'L' },
      y: { label: 'Moment', unit: 'kN·m' },
      series: [
        { id: 'M', label: 'M', formula: 'R1 * x - P * mac(x - a, 1)' },
        { id: 'V', label: 'V', formula: 'R1 - P * step(x - a)' },
      ],
      samples: 400,
    }
    expect(noteChartSchema.safeParse(chart).success).toBe(true)
    const ev = evaluateChart(chart, scope)!
    expect(ev.xs[0]).toBe(0)
    expect(ev.xs.at(-1)).toBe(4)
    expect(ev.series[0].max.y).toBeCloseTo(7.5, 6)
    expect(ev.series[0].max.x).toBeCloseTo(1, 6)
    expect(ev.series[0].ys.at(-1)).toBeCloseTo(0, 6) // zero moment at the right support
    expect(ev.series[1].max.y).toBeCloseTo(7.5, 6) // shear: +R1 left of the load
    expect(ev.series[1].min.y).toBeCloseTo(-2.5, 6) // and -R2 right of it
  })

  it('redraws from new sizes and refuses a zero-length range', () => {
    const chart: NoteChartSpec = { id: 'c', title: 'Cantilever', x: { label: 'x', unit: 'm', from: 0, to: 'L' }, y: { label: 'M', unit: 'kN·m' }, series: [{ id: 'M', label: 'M', formula: '-P * (L - x)' }] }
    expect(evaluateChart(chart, { P: 2, L: 3 })!.series[0].min.y).toBeCloseTo(-6)
    expect(evaluateChart(chart, { P: 2, L: 5 })!.series[0].min.y).toBeCloseTo(-10)
    expect(evaluateChart(chart, { P: 2, L: 0 })).toBeNull()
  })
})
