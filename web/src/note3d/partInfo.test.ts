import { describe, expect, it } from 'vitest'
import { buildPartGeometry } from './builder'
import { findPart, meshVolume, partParameters, relatedCalculations, shapeSizes } from './partInfo'
import type { NoteSceneSpec } from './schema'

describe('part inspector facts', () => {
  it('measures a part’s volume from its built solid', () => {
    expect(meshVolume(buildPartGeometry([{ kind: 'box', sx: 0.2, sy: 0.1, sz: 0.05 }], {}))).toBeCloseTo(0.001, 6)
    // a 40 mm × 100 mm cylinder: π r² h
    expect(meshVolume(buildPartGeometry([{ kind: 'cylinder', r: 0.02, h: 0.1 }], {}))).toBeCloseTo(Math.PI * 0.02 ** 2 * 0.1, 5)
  })

  it('works out a gear’s sizes from the model’s values', () => {
    const rows = Object.fromEntries(shapeSizes({ kind: 'gear', teeth: 'z1', module: 'm / 1000', h: 0.03, rInner: 0.01 }, { z1: 20, m: 4 }).map((r) => [r.label, r.value]))
    expect(rows).toMatchObject({ Teeth: '20', Module: '4.00 mm', 'Pitch diameter': '80.0 mm', 'Outside diameter': '88.0 mm', 'Face width': '30.0 mm', Bore: '20.0 mm' })
  })

  it('finds what drives a part and the equations it takes part in, through earlier results too', () => {
    const spec = {
      parameters: [{ id: 'z1' }, { id: 'm' }, { id: 'P' }, { id: 'n' }],
      calculations: [
        { id: 'd1', label: 'Pitch diameter', symbol: 'd', formula: 'z1 * m', unit: 'mm' },
        { id: 'T', label: 'Torque', symbol: 'T', formula: 'P / n', unit: 'N·m' },
        { id: 'Ft', label: 'Tooth force', symbol: 'F', formula: '2 * T / d1', unit: 'N' },
      ],
      parts: [{ id: 'housing', name: 'Housing', shapes: [], children: [{ id: 'pinion', name: 'Pinion', shapes: [{ kind: 'gear', teeth: 'z1', module: 'm / 1000' }] }] }],
    } as unknown as NoteSceneSpec
    const pinion = findPart(spec, 'pinion')!
    expect(pinion.name).toBe('Pinion')
    const drivers = partParameters(pinion, ['z1', 'm', 'P', 'n'])
    expect(drivers).toEqual(['z1', 'm'])
    // the torque does not involve the pinion's sizes; the tooth force does, through the pitch diameter
    expect(relatedCalculations(spec.calculations, drivers).map((c) => c.id)).toEqual(['d1', 'Ft'])
  })
})
