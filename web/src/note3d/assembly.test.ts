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

describe('linkages and attached arrows', () => {
  const crank: NotePartSpec = { id: 'crank', name: 'Crankshaft', shapes: [{ kind: 'cylinder', r: 0.02, h: 0.2, rotation: alongX }] }
  const piston = (angle: number): NotePartSpec => ({ id: 'piston', name: 'Piston', mount: { kind: 'slider', target: 'crank', throw: 0.04, rod: 0.15, angle }, shapes: [{ kind: 'cylinder', r: 0.04, h: 0.05 }] })
  const rod = (angle: number): NotePartSpec => ({ id: 'rod', name: 'Connecting rod', mount: { kind: 'link', target: 'crank', to: 'piston', throw: 0.04, angle }, shapes: [{ kind: 'box', sx: 0.02, sy: 0.15, sz: 0.02 }] })

  it('places a piston by the slider-crank formula and runs the rod from crank pin to piston', () => {
    expect(resolveAssembly({ parts: [crank, piston(0)] }, {}).placements.get('piston')!.position[1]).toBeCloseTo(0.19, 5) // r + l at top dead centre
    const { placements, issues } = resolveAssembly({ parts: [crank, piston(90), rod(90)] }, {})
    const y = Math.sqrt(0.15 ** 2 - 0.04 ** 2)
    expect(placements.get('piston')!.position[1]).toBeCloseTo(y, 5)
    // crank pin a quarter turn round: 40 mm out along z; the rod's middle is halfway to the piston, its long side along that line
    const r = placements.get('rod')!
    expect(r.position[1]).toBeCloseTo(y / 2, 5)
    expect(r.position[2]).toBeCloseTo(0.02, 5)
    const along = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...r.rotation, 'XYZ'))
    const line = new THREE.Vector3(0, y, -0.04).normalize()
    expect(Math.abs(along.dot(line))).toBeCloseTo(1, 5)
    expect(issues).toEqual([])
  })

  it('attaches a load arrow to a face and a span dimension to the part, wherever it ends up', async () => {
    const { resolveAnnotation } = await import('./assembly')
    const parts: NotePartSpec[] = [
      { id: 'support', name: 'Support', shapes: [{ kind: 'box', sx: 0.05, sy: 0.05, sz: 0.05 }] },
      { id: 'beam', name: 'Beam', mount: { kind: 'against', target: 'support', face: '+y' }, shapes: [{ kind: 'box', sx: 0.4, sy: 0.04, sz: 0.03 }] },
    ]
    const { frames } = resolveAssembly({ parts }, {})
    const load = resolveAnnotation({ id: 'P', kind: 'force', label: 'P', from: [0, 0, 0], anchor: { part: 'beam', at: '+y' }, direction: '-y', length: 0.1 }, frames, {})!
    // the beam sits on the 50 mm support, so its top face is at 25 + 40 = 65 mm; the arrow ends there, from 100 mm above
    expect(load.to[1]).toBeCloseTo(0.065, 5)
    expect(load.from[1]).toBeCloseTo(0.165, 5)
    const span = resolveAnnotation({ id: 'L', kind: 'dimension', label: 'L', from: [0, 0, 0], anchor: { part: 'beam' } }, frames, {})!
    expect(span.from[0]).toBeCloseTo(-0.2, 5)
    expect(span.to[0]).toBeCloseTo(0.2, 5)
    expect(span.from[1]).toBeLessThan(0.025) // drawn below the beam
    const tip = resolveAnnotation({ id: 'R', kind: 'force', label: 'R', from: [0, 0, 0], anchor: { part: 'beam', at: 'end' }, direction: '+y' }, frames, {})!
    expect(tip.to[0]).toBeCloseTo(0.2, 5)
  })
})

describe('a face and a point along the part together', () => {
  it('puts "on top, at the far end" on the top face at the far end', async () => {
    const { resolveAnnotation } = await import('./assembly')
    const { frames } = resolveAssembly({ parts: [{ id: 'beam', name: 'Beam', shapes: [{ kind: 'box', sx: 0.4, sy: 0.04, sz: 0.03 }] }] }, {})
    const p = resolveAnnotation({ id: 'P', kind: 'force', label: 'P', from: [0, 0, 0], anchor: { part: 'beam', at: '+y', along: 1 } }, frames, {})!
    expect(p.to[0]).toBeCloseTo(0.2, 5)
    expect(p.to[1]).toBeCloseTo(0.02, 5)
  })
})

describe('a dog-bone connecting rod', () => {
  it('lines up by its length, not by the round eyes that point across it', () => {
    const crank: NotePartSpec = { id: 'crank', name: 'Crankshaft', shapes: [{ kind: 'cylinder', r: 0.02, h: 0.2, rotation: alongX }] }
    const piston: NotePartSpec = { id: 'piston', name: 'Piston', mount: { kind: 'slider', target: 'crank', throw: 0.04, rod: 0.15, angle: 0 }, shapes: [{ kind: 'cylinder', r: 0.04, h: 0.05 }] }
    const rod: NotePartSpec = {
      id: 'rod', name: 'Rod', mount: { kind: 'link', target: 'crank', to: 'piston', throw: 0.04, angle: 0 },
      shapes: [
        { kind: 'cylinder', r: 0.012, h: 0.02, position: [0, -0.075, 0], rotation: [Math.PI / 2, 0, 0] },
        { kind: 'cylinder', r: 0.008, h: 0.02, position: [0, 0.075, 0], rotation: [Math.PI / 2, 0, 0] },
        { kind: 'box', sx: 0.012, sy: 0.15, sz: 0.01 },
      ],
    }
    const r = resolveAssembly({ parts: [crank, piston, rod] }, {}).placements.get('rod')!
    // at top dead centre the rod stands straight up, from the pin 40 mm above the crank to the piston 190 mm above it
    const along = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...r.rotation, 'XYZ'))
    expect(Math.abs(along.y)).toBeCloseTo(1, 5)
    // its bounding box is centred on the line (the eyes differ in size, so that is 2 mm off the middle)
    expect(r.position[1]).toBeCloseTo((0.04 + 0.19) / 2, 2)
  })
})

describe('parts on one axis', () => {
  it('does not call a gear on its shaft buried, however it was placed', () => {
    const parts: NotePartSpec[] = [
      { id: 'shaft', name: 'Countershaft', shapes: [{ kind: 'cylinder', r: 0.03, h: 0.3, rotation: alongX }] },
      // placed by coordinates on the shaft's axis, not by a mount
      { id: 'pinion', name: 'Pinion', position: [0.05, 0, 0], rotation: alongX, shapes: [{ kind: 'gear', teeth: 16, module: 0.004, h: 0.03 }] },
    ]
    expect(resolveAssembly({ parts }, {}).issues.map((i) => i.kind)).not.toContain('buried')
  })
})

describe('planetary gear sets', () => {
  const gear = (teeth: number) => [{ kind: 'gear', teeth, module: 0.003, faceWidth: 0.02 }]
  const spec = {
    title: 'Planetary set',
    parameters: [],
    calculations: [],
    parts: [
      { id: 'sun', name: 'Sun gear', position: [0, 0, 0], shapes: gear(20) },
      { id: 'p1', name: 'Planet 1', mount: { kind: 'mesh', target: 'sun', angle: 0 }, shapes: gear(16) },
      { id: 'p2', name: 'Planet 2', mount: { kind: 'mesh', target: 'sun', angle: 120 }, shapes: gear(16) },
      { id: 'p3', name: 'Planet 3', mount: { kind: 'mesh', target: 'sun', angle: 240 }, shapes: gear(16) },
      // ring: pitch radius of sun + 2 planets = (20 + 32) × 3 mm / 2 = 78 mm, drawn as a tube round them
      { id: 'ring', name: 'Ring gear', mount: { kind: 'coaxial', target: 'sun' }, shapes: [{ kind: 'tube', rOuter: 0.09, rInner: 0.078, h: 0.02 }] },
    ],
  } as unknown as Parameters<typeof resolveAssembly>[0]

  it('spaces the planets evenly round the sun at the meshing distance, inside the ring, with nothing flagged', () => {
    const { placements, issues } = resolveAssembly(spec, {})
    const at = (id: string) => new THREE.Vector3(...placements.get(id)!.position)
    const d = (0.003 * 20) / 2 + (0.003 * 16) / 2
    for (const id of ['p1', 'p2', 'p3']) expect(at(id).length()).toBeCloseTo(d, 4)
    // 120 degrees apart: equal distances between each pair
    const gap = (a: string, b: string) => at(a).distanceTo(at(b))
    expect(gap('p1', 'p2')).toBeCloseTo(gap('p2', 'p3'), 4)
    expect(gap('p2', 'p3')).toBeCloseTo(gap('p3', 'p1'), 4)
    expect(issues).toEqual([])
  })
})
