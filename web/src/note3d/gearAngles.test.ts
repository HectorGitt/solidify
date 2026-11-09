import { describe, expect, it } from 'vitest'
import { buildPartGeometry } from './builder'
import type { NoteShapeSpec } from './schema'

const finite = (shapes: NoteShapeSpec[], params: Record<string, number>) => {
  const g = buildPartGeometry(shapes, params)
  const a = g.getAttribute('position').array as ArrayLike<number>
  let bad = 0
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) bad++
  return { count: a.length, bad }
}

describe('gear angles', () => {
  it('take a formula of the model values (a helix angle slider) and build a real gear', () => {
    const r = finite([{ kind: 'gear', teeth: 'z1', module: 0.003, h: 0.04, helixAngle: 'beta' } as NoteShapeSpec], { z1: 25, beta: 20 })
    expect(r.count).toBeGreaterThan(100)
    expect(r.bad).toBe(0)
  })
  it('never reach the geometry as NaN, whatever comes in', () => {
    for (const helixAngle of ['nonsense', 'beta * ', 1e9, -1e9] as unknown as number[]) {
      const r = finite([{ kind: 'gear', teeth: 20, module: 0.003, h: 0.02, helixAngle, pressureAngle: 'oops' } as unknown as NoteShapeSpec], {})
      expect(r.bad).toBe(0)
      expect(r.count).toBeGreaterThan(100)
    }
  })
})
