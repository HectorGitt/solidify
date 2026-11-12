import { describe, expect, it } from 'vitest'
import { symbolText } from './symbolText'

describe('symbolText', () => {
  it('writes subscripts and Greek letters as plain text', () => {
    expect(symbolText('T_1')).toBe('T₁')
    expect(symbolText('F_t')).toBe('Fₜ')
    expect(symbolText('F_{max}')).toBe('Fₘₐₓ')
    expect(symbolText('\\omega_2')).toBe('ω₂')
    expect(symbolText('\\Delta L')).toBe('Δ L')
  })
  it('leaves a subscript it cannot lower whole, and plain words alone', () => {
    expect(symbolText('F_{bq}')).toBe('F_bq')
    expect(symbolText('Load')).toBe('Load')
    expect(symbolText('P = 7.5 kW')).toBe('P = 7.5 kW')
  })
})
