import { describe, expect, it } from 'vitest'
import { completedItems, completedString, readProgress } from './liveBuild'

const full = JSON.stringify({
  explanation: 'Built a "pump" {with braces}',
  isNewMachine: true,
  spec: {
    title: 'Gear pump',
    extent: 0.5,
    camera: { position: [0.5, 0.4, 0.5], target: [0, 0, 0] },
    parameters: [
      { id: 'z', label: 'Teeth', value: 12, unit: '' },
      { id: 'w', label: 'Width', value: 20, unit: 'mm' },
    ],
    calculations: [{ id: 'q', label: 'Flow', latex: 'Q = \\pi' }],
    parts: [
      { id: 'housing', name: 'Housing {main}', shapes: [{ kind: 'box', sx: 0.2 }] },
      { id: 'g1', name: 'Gear', shapes: [{ kind: 'gear', teeth: 'z' }] },
    ],
  },
})

describe('reading a model while it is written', () => {
  it('returns only the items that have closed, at every point of the answer', () => {
    let lastParts = 0
    for (let n = 0; n <= full.length; n += 7) {
      const p = readProgress(full.slice(0, n))
      expect(p.parts.length).toBeGreaterThanOrEqual(lastParts) // never goes backwards
      lastParts = p.parts.length
      for (const part of p.parts) expect(part.shapes).toBeDefined() // a part shows only once whole
    }
    const done = readProgress(full)
    expect(done.parts.map((x) => x.id)).toEqual(['housing', 'g1'])
    expect(done.parameters.map((x) => x.id)).toEqual(['z', 'w'])
    expect(done.calculations[0].latex).toBe('Q = \\pi')
    expect(done.title).toBe('Gear pump')
    expect(done.explanation).toBe('Built a "pump" {with braces}')
    expect(done.draft.camera).toEqual({ position: [0.5, 0.4, 0.5], target: [0, 0, 0] })
  })

  it('handles braces and quotes inside strings, and a list cut off halfway', () => {
    const cut = full.slice(0, full.indexOf('"g1"') + 10)
    expect(completedItems(cut, 'parts').map((x) => x.id)).toEqual(['housing'])
    expect(completedString('{"title": "half wri', 'title')).toBeUndefined()
    expect(readProgress('{"isQuestion": true, "explanation": "Because"').isQuestion).toBe(true)
  })
})
