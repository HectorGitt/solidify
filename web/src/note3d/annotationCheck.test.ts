import { describe, expect, it } from 'vitest'
import { resolveAnnotation, resolveAssembly } from './assembly'
import { annotationProblems } from './annotationCheck'
import type { NoteAnnotationSpec, NotePartSpec } from './schema'

const Z: [number, number, number] = [Math.PI / 2, 0, 0]
const gear: NotePartSpec = { id: 'pinion', name: 'Pinion', role: 'moving', position: [0, 0, 0], rotation: Z, shapes: [{ kind: 'gear', teeth: 20, module: 0.004 }] }
const beam: NotePartSpec = { id: 'beam', name: 'Beam', role: 'static', position: [0, 0, 0], shapes: [{ kind: 'box', sx: 1, sy: 0.05, sz: 0.04 }] }
const model = (parts: NotePartSpec[], annotations: NoteAnnotationSpec[]) => ({ parts, annotations, calculations: [], parameters: [] })

describe('load arrows', () => {
  it('passes forces that act the way their names say', () => {
    const anns: NoteAnnotationSpec[] = [
      { id: 'ft', kind: 'force', label: 'F_t', magnitude: 100, anchor: { part: 'pinion', at: '+x' }, direction: '-y' },
      { id: 'fa', kind: 'force', label: 'F_a', magnitude: 30, anchor: { part: 'pinion', at: '-z' }, direction: '+z' },
      { id: 'fr', kind: 'force', label: 'F_r', magnitude: 40, anchor: { part: 'pinion', at: '+y' }, direction: '-y' },
    ]
    expect(annotationProblems(model([gear], anns))).toEqual([])
  })
  it('names a tangential force along the axis, an axial one across it, a radial one along it, and one hidden in its part', () => {
    const anns: NoteAnnotationSpec[] = [
      { id: 'ft', kind: 'force', label: 'F_t', magnitude: 100, anchor: { part: 'pinion', at: '+x' }, direction: '+z' },
      { id: 'fa', kind: 'force', label: 'F_a', magnitude: 30, anchor: { part: 'pinion', at: 'center' }, direction: '-y' },
      { id: 'fr', kind: 'force', label: 'F_r', magnitude: 40, anchor: { part: 'pinion', at: '+z' }, direction: '-z' },
    ]
    const p = annotationProblems(model([gear], anns)).join(' ')
    expect(p).toMatch(/"F_t" is a tangential force but acts along the part's axis/)
    expect(p).toMatch(/"F_a" ends in the middle of its part/)
    expect(p).toMatch(/"F_a" is an axial force but does not act along the part's axis/)
    expect(p).toMatch(/"F_r" is a radial force but acts along the part's axis/)
  })
  it('names a bending moment about the beam’s own length, and a reaction acting with the load', () => {
    const anns: NoteAnnotationSpec[] = [
      { id: 'p', kind: 'force', label: 'P', magnitude: 5, anchor: { part: 'beam', at: '+y', along: 1 }, direction: '-y' },
      { id: 'r', kind: 'force', label: 'R_A', magnitude: 5, anchor: { part: 'beam', at: '+y', along: 0 }, direction: '-y' },
      { id: 'm', kind: 'moment', label: 'M_A', magnitude: 5, anchor: { part: 'beam', at: 'start' } },
    ]
    const p = annotationProblems(model([beam], anns)).join(' ')
    expect(p).toMatch(/"M_A" is a bending moment but turns about the member's own length/)
    expect(p).toMatch(/"R_A" is a reaction but acts the same way as the load "P"/)
    // with a direction across the beam, the moment is right
    expect(annotationProblems(model([beam], [{ ...anns[2], direction: '+z' }]))).toEqual([])
  })
  it('draws a pull from the face outward, not through the part', () => {
    const frames = resolveAssembly({ parts: [beam] }, {}).frames
    const pull = resolveAnnotation({ id: 'p', kind: 'force', label: 'P', anchor: { part: 'beam', at: '+x' }, direction: '+x', length: 0.1 }, frames, {})!
    expect(pull.from[0]).toBeCloseTo(0.5, 4)
    expect(pull.to[0]).toBeCloseTo(0.6, 4)
    const push = resolveAnnotation({ id: 'q', kind: 'force', label: 'Q', anchor: { part: 'beam', at: '+x' }, direction: '-x', length: 0.1 }, frames, {})!
    expect(push.from[0]).toBeCloseTo(0.6, 4)
    expect(push.to[0]).toBeCloseTo(0.5, 4)
  })
  it('names a load drawn with no value', () => {
    const p = annotationProblems(model([beam], [{ id: 't', kind: 'moment', label: 'T_in', anchor: { part: 'beam', at: 'start' }, direction: '+z' }]))
    expect(p.join(' ')).toMatch(/"T_in" has no value/)
  })
})
