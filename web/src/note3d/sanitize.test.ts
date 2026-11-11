import { describe, expect, it } from 'vitest'
import { cleanCut, sanitizeGeneratedSpec } from './sanitize'

describe('the section plane Gemini suggests', () => {
  it('keeps a good one', () => {
    expect(cleanCut({ enabled: true, normal: [1, 0, 0], pos: 0.02 })).toEqual({ enabled: true, normal: [1, 0, 0], pos: 0.02 })
  })

  it('replaces one with no normal, a short or non-number normal, or a zero normal (the propped cantilever that crashed the workspace)', () => {
    for (const bad of [{ enabled: true, pos: 0 }, { normal: [0, 1] }, { normal: ['0', 1, 0] }, { normal: [0, 0, 0] }, 'z', null])
      expect(cleanCut(bad).normal).toEqual([0, 0, 1])
    expect(cleanCut({ enabled: false }).enabled).toBe(false)
    expect(cleanCut({ normal: [0, 1, 0], pos: 'mid' }).pos).toBe(0)
  })

  it('is applied to every generated model', () => {
    const spec = sanitizeGeneratedSpec({ spec: { title: 'Propped cantilever', recommendedCut: { enabled: true }, parts: [{ id: 'beam', name: 'Beam', shapes: [{ kind: 'box', sx: 1, sy: 0.05, sz: 0.05 }] }] } }, 'a propped cantilever')
    expect(spec?.recommendedCut?.normal).toEqual([0, 0, 1])
  })
})

describe('3D labels', () => {
  it('turns LaTeX written into a label into plain text', async () => {
    const { plainLabel } = await import('./sanitize')
    expect(plainLabel('T_{in}')).toBe('T_in')
    expect(plainLabel(String.raw`\tau_{max}`)).toBe('τ_max')
    expect(plainLabel('F_t')).toBe('F_t')
  })
})
