import { describe, expect, it } from 'vitest'
import { resolveAssembly } from './assembly'
import type { NotePartSpec } from './schema'

const X: [number, number, number] = [0, 0, Math.PI / 2]
describe('fitting parts by named features', () => {
  it('a pin goes into a named hole, wherever and however the hole is set in its plate', () => {
    const plate: NotePartSpec = {
      id: 'plate', name: 'Plate', role: 'static', position: [0.1, 0.2, 0], shapes: [
        { kind: 'box', sx: 0.2, sy: 0.02, sz: 0.1 },
        { kind: 'cylinder', name: 'hole', op: 'subtract', position: [0.05, 0, 0.02], r: 0.005, h: 0.03 },
      ],
    }
    const pin: NotePartSpec = { id: 'pin', name: 'Pin', role: 'static', rotation: X, shapes: [{ kind: 'cylinder', r: 0.005, h: 0.05 }], mount: { kind: 'fit', target: 'plate', feature: 'hole' } }
    const f = resolveAssembly({ parts: [plate, pin] }, {}).frames.get('pin')!
    expect(f.center.x).toBeCloseTo(0.15, 4)
    expect(f.center.y).toBeCloseTo(0.2, 4)
    expect(f.center.z).toBeCloseTo(0.02, 4)
    // the pin's written rotation (lying along X) is replaced by the hole's axis (Y)
    expect(Math.abs(f.axis.y)).toBeCloseTo(1, 4)
  })
  it('a shaft runs through a pedestal’s bore at the bore’s height, not the pedestal’s middle', () => {
    const pedestal: NotePartSpec = {
      id: 'ped', name: 'Pedestal', role: 'housing', position: [0, 0, 0], shapes: [
        { kind: 'box', position: [0, 0.04, 0], sx: 0.04, sy: 0.08, sz: 0.06 },
        { kind: 'tube', name: 'bore', position: [0, 0.1, 0], rotation: X, rOuter: 0.02, rInner: 0.01, h: 0.04 },
      ],
    }
    const shaft: NotePartSpec = { id: 'shaft', name: 'Shaft', role: 'moving', shapes: [{ kind: 'cylinder', r: 0.01, h: 0.3 }], mount: { kind: 'fit', target: 'ped', feature: 'bore', offset: 0.1 } }
    const f = resolveAssembly({ parts: [pedestal, shaft] }, {}).frames.get('shaft')!
    expect(f.center.y).toBeCloseTo(0.1, 4)
    expect(Math.abs(f.axis.x)).toBeCloseTo(1, 4)
    expect(Math.abs(f.center.x)).toBeCloseTo(0.1, 4)
  })
  it('a block sits on a named face of a feature', () => {
    const base: NotePartSpec = { id: 'base', name: 'Base', role: 'housing', position: [0, 0, 0], shapes: [{ kind: 'box', name: 'deck', position: [0.1, 0, 0], sx: 0.1, sy: 0.02, sz: 0.1 }] }
    const block: NotePartSpec = { id: 'block', name: 'Block', role: 'static', shapes: [{ kind: 'box', sx: 0.04, sy: 0.04, sz: 0.04 }], mount: { kind: 'fit', target: 'base', feature: 'deck', face: '+y' } }
    const f = resolveAssembly({ parts: [base, block] }, {}).frames.get('block')!
    expect(f.box.min.y).toBeCloseTo(0.01, 4)
    expect(f.center.x).toBeCloseTo(0.1, 4)
  })
  it('says so when the feature is not there', () => {
    const plate: NotePartSpec = { id: 'plate', name: 'Plate', role: 'static', position: [0, 0, 0], shapes: [{ kind: 'box', sx: 0.1, sy: 0.1, sz: 0.1 }] }
    const pin: NotePartSpec = { id: 'pin', name: 'Pin', role: 'static', shapes: [{ kind: 'cylinder', r: 0.005, h: 0.05 }], mount: { kind: 'fit', target: 'plate', feature: 'hole' } }
    expect(resolveAssembly({ parts: [plate, pin] }, {}).issues.map((i) => i.message).join(' ')).toMatch(/Pin fits to "hole" on Plate, which has no shape of that name/)
  })
})
