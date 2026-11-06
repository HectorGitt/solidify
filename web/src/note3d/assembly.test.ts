import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { resolveAssembly } from './assembly'
import type { NotePartSpec } from './schema'

const alongX: [number, number, number] = [0, 0, Math.PI / 2]
const axisOf = (rot: [number, number, number], local = new THREE.Vector3(0, 1, 0)) => local.clone().applyEuler(new THREE.Euler(...rot, 'XYZ'))

const train: NotePartSpec[] = [
  { id: 'in', name: 'Input shaft', shapes: [{ kind: 'cylinder', r: 0.02, h: 0.3, rotation: alongX }] },
  { id: 'pinion', name: 'Pinion', mount: { kind: 'coaxial', target: 'in', at: 0.25 }, shapes: [{ kind: 'gear', teeth: 'z1', module: 0.004, h: 0.03 }] },
  { id: 'wheel', name: 'Wheel', mount: { kind: 'mesh', target: 'pinion', side: '+y' }, shapes: [{ kind: 'gear', teeth: 40, module: 0.004, h: 0.03 }] },
  { id: 'out', name: 'Output shaft', mount: { kind: 'coaxial', target: 'wheel' }, shapes: [{ kind: 'cylinder', r: 0.025, h: 0.3 }] },
  { id: 'base', name: 'Base plate', mount: { kind: 'against', target: 'in', face: '-y' }, shapes: [{ kind: 'box', sx: 0.4, sy: 0.02, sz: 0.1 }] },
]

describe('assembly by relation', () => {
  it('puts a gear on its shaft, meshes the next one at the right centre distance, and seats a plate', () => {
    const { placements, issues } = resolveAssembly({ parts: train }, { z1: 20 })
    const at = (id: string) => placements.get(id)!
    // pinion: on the shaft axis, a quarter of the way along (300 mm shaft → 75 mm left of centre), turned to lie along X
    expect(at('pinion').position[0]).toBeCloseTo(-0.075, 5)
    expect(at('pinion').position[1]).toBeCloseTo(0, 5)
    expect(Math.abs(axisOf(at('pinion').rotation).x)).toBeCloseTo(1, 5)
    // wheel: pitch radii 40 + 80 mm → 120 mm above the pinion, same axial plane, axis parallel
    expect(at('wheel').position[0]).toBeCloseTo(-0.075, 5)
    expect(at('wheel').position[1]).toBeCloseTo(0.12, 5)
    expect(Math.abs(axisOf(at('wheel').rotation).x)).toBeCloseTo(1, 5)
    // output shaft: through the wheel's centre, along X
    expect(at('out').position[1]).toBeCloseTo(0.12, 5)
    expect(Math.abs(axisOf(at('out').rotation).x)).toBeCloseTo(1, 5)
    // base plate: its top face on the bottom of the Ø40 shaft → centre 20 + 10 mm down
    expect(at('base').position[1]).toBeCloseTo(-0.03, 5)
    expect(issues).toEqual([])
  })

  it('follows the sizes: more pinion teeth move the wheel out', () => {
    const { placements } = resolveAssembly({ parts: train }, { z1: 30 })
    expect(placements.get('wheel')!.position[1]).toBeCloseTo((30 * 0.004) / 2 + 0.08, 5)
  })

  it('finds parts left floating or buried, and mounts on parts that are not there', () => {
    const parts: NotePartSpec[] = [
      ...train,
      { id: 'lost', name: 'Oil cap', position: [1, 1, 1], shapes: [{ kind: 'cylinder', r: 0.01, h: 0.01 }] },
      { id: 'block', name: 'Block', position: [0.6, 0, 0], shapes: [{ kind: 'box', sx: 0.2, sy: 0.2, sz: 0.2 }] },
      { id: 'pin', name: 'Pin', position: [0.6, 0, 0], shapes: [{ kind: 'box', sx: 0.02, sy: 0.02, sz: 0.02 }] },
      { id: 'ghost', name: 'Bracket', mount: { kind: 'against', target: 'nope', face: '+y' }, shapes: [{ kind: 'box', sx: 0.05, sy: 0.05, sz: 0.05 }] },
    ]
    const kinds = resolveAssembly({ parts }, { z1: 20 }).issues.map((i) => `${i.partId}:${i.kind}`)
    expect(kinds).toContain('lost:floating')
    expect(kinds).toContain('pin:buried')
    expect(kinds).toContain('ghost:missing-target')
    expect(kinds).not.toContain('pinion:buried')
  })
})
