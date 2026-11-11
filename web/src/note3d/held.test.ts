import { describe, expect, it } from 'vitest'
import { resolveAssembly } from './assembly'
import { heldProblems } from './held'
import type { NotePartSpec } from './schema'

const Z: [number, number, number] = [Math.PI / 2, 0, 0]
const base = (extra: NotePartSpec['shapes'] = []): NotePartSpec => ({
  id: 'base',
  name: 'Base plate',
  role: 'housing',
  position: [0, -0.1, 0],
  shapes: [{ kind: 'box', sx: 0.4, sy: 0.02, sz: 0.2 }, ...extra],
})
const shaft: NotePartSpec = { id: 'shaft', name: 'Shaft', role: 'moving', position: [0, 0, 0], rotation: Z, shapes: [{ kind: 'cylinder', r: 0.012, h: 0.18 }], motion: { kind: 'rotate', axis: 'y', speed: 2 } }
const gear: NotePartSpec = { id: 'gear', name: 'Gear', role: 'moving', shapes: [{ kind: 'gear', teeth: 20, module: 0.004 }], mount: { kind: 'coaxial', target: 'shaft' } }

describe('every part held', () => {
  it('names a shaft and its gear that touch each other but hang above the base', () => {
    const problems = heldProblems({ parts: [base(), shaft, gear] }, {})
    expect(problems.join(' ')).toMatch(/Shaft and Gear are not held by anything/)
  })
  it('passes once a pedestal reaches the shaft', () => {
    const post: NotePartSpec['shapes'] = [{ kind: 'box', position: [0, 0.05, 0.08], sx: 0.03, sy: 0.1, sz: 0.02 }]
    expect(heldProblems({ parts: [base(post), shaft, gear] }, {})).toEqual([])
  })
  it('names a bearing block that only hangs on the turning shaft', () => {
    const post: NotePartSpec['shapes'] = [{ kind: 'box', position: [0, 0.05, 0.08], sx: 0.03, sy: 0.1, sz: 0.02 }]
    const block: NotePartSpec = { id: 'block', name: 'Bearing block', role: 'static', shapes: [{ kind: 'tube', rOuter: 0.02, rInner: 0.012, h: 0.02 }], mount: { kind: 'coaxial', target: 'shaft', at: 0.1 } }
    expect(heldProblems({ parts: [base(post), shaft, gear, block] }, {}).join(' ')).toMatch(/Bearing block is fixed to nothing/)
  })
  it('names a gear standing outside the gearbox drawn round it', () => {
    const box: NotePartSpec = { id: 'box', name: 'Gearbox housing', role: 'housing', position: [0, 0, 0], shapes: [{ kind: 'box', sx: 0.1, sy: 0.1, sz: 0.1 }, { kind: 'box', op: 'subtract', sx: 0.08, sy: 0.08, sz: 0.08 }] }
    const out: NotePartSpec = { id: 'wheel', name: 'Worm wheel', role: 'moving', shapes: [{ kind: 'gear', teeth: 30, module: 0.004 }], mount: { kind: 'against', target: 'box', face: '+y' } }
    expect(heldProblems({ parts: [box, out] }, {}).join(' ')).toMatch(/Worm wheel is outside Gearbox housing/)
  })
  it('names gears whose teeth run through each other', () => {
    const a: NotePartSpec = { id: 'a', name: 'Pinion', role: 'moving', position: [0, 0, 0], shapes: [{ kind: 'gear', teeth: 20, module: 0.004 }] }
    const b: NotePartSpec = { id: 'b', name: 'Wheel', role: 'moving', position: [0.09, 0, 0], shapes: [{ kind: 'gear', teeth: 40, module: 0.004 }] }
    // pitch radii 40 + 80 = 120 mm; centres 90 mm apart
    expect(heldProblems({ parts: [a, b] }, {}).join(' ')).toMatch(/teeth of Pinion and Wheel cut into each other/)
  })
})

describe('what coaxial lines up', () => {
  it('a crank goes in the frame’s bearing boss, not the middle of the whole frame', () => {
    const frame: NotePartSpec = {
      id: 'frame',
      name: 'Frame',
      role: 'housing',
      position: [0, 0, 0],
      // the boss comes first (the main round shape); the base plate hangs well below and in front of it
      shapes: [{ kind: 'cylinder', position: [0, 0.05, 0], rotation: Z, r: 0.03, h: 0.06 }, { kind: 'box', position: [0, -0.1, 0.06], sx: 0.4, sy: 0.02, sz: 0.2 }],
    }
    const crank: NotePartSpec = { id: 'crank', name: 'Crank', role: 'moving', shapes: [{ kind: 'cylinder', rotation: Z, r: 0.012, h: 0.08 }], mount: { kind: 'coaxial', target: 'frame', at: 0.5 } }
    const c = resolveAssembly({ parts: [frame, crank] }, {}).frames.get('crank')!.center
    expect(c.x).toBeCloseTo(0, 4)
    expect(c.y).toBeCloseTo(0.05, 4)
    expect(c.z).toBeCloseTo(0, 4)
  })
  it('a ring of balls stays in the plane of its race', () => {
    const race: NotePartSpec = { id: 'race', name: 'Inner ring', role: 'moving', position: [0, 0, 0], shapes: [{ kind: 'tube', rOuter: 0.03, rInner: 0.02, h: 0.015 }] }
    const balls: NotePartSpec = { id: 'balls', name: 'Balls', role: 'moving', shapes: [{ kind: 'sphere', r: 0.004, radialCount: 9, radialRadius: 0.034 }], mount: { kind: 'coaxial', target: 'race' } }
    const box = resolveAssembly({ parts: [race, balls] }, {}).frames.get('balls')!.box
    // flat in the race's plane (thin along the race's axis, Y), not stood on edge
    expect(box.max.y - box.min.y).toBeLessThan(0.012)
  })
  it('a row of rivets keeps its middle (no single axis)', () => {
    const plate: NotePartSpec = { id: 'plate', name: 'Plate', role: 'static', position: [0, 0, 0], shapes: [{ kind: 'box', sx: 0.2, sy: 0.01, sz: 0.06 }] }
    const rivets: NotePartSpec = { id: 'rivets', name: 'Rivets', role: 'static', shapes: [-0.05, 0, 0.05].map((x) => ({ kind: 'cylinder' as const, position: [x, 0, 0] as [number, number, number], r: 0.005, h: 0.02 })), mount: { kind: 'coaxial', target: 'plate' } }
    const c = resolveAssembly({ parts: [plate, rivets] }, {}).frames.get('rivets')!.center
    expect(Math.hypot(c.x, c.y, c.z)).toBeLessThan(0.002)
  })
})

describe('a keyed mount', () => {
  const Zr: [number, number, number] = [Math.PI / 2, 0, 0]
  const shaft: NotePartSpec = { id: 'shaft', name: 'Shaft', role: 'moving', position: [0, 0, 0], rotation: Zr, shapes: [{ kind: 'cylinder', r: 0.02, h: 0.2 }], motion: { kind: 'rotate', axis: 'y', speed: 2 } }
  // written lying across (its length along X), with the wrong role: the mount puts it right
  const key: NotePartSpec = { id: 'key', name: 'Parallel key', role: 'static', shapes: [{ kind: 'box', sx: 0.05, sy: 0.008, sz: 0.01 }], mount: { kind: 'keyed', target: 'shaft', r: 0.02 } }
  it('lays the key along the shaft, half sunk into its top', () => {
    const box = resolveAssembly({ parts: [shaft, key] }, {}).frames.get('key')!.box
    // the shaft runs along Z: the key's 50 mm is along Z, its 8 mm height straddles the surface at y = 20 mm
    expect(box.max.z - box.min.z).toBeCloseTo(0.05, 4)
    expect(box.min.y).toBeCloseTo(0.016, 4)
    expect(box.max.y).toBeCloseTo(0.024, 4)
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 4)
  })
  it('turns with the shaft, and passes the fixed-parts check', async () => {
    const { buildKinematics } = await import('./kinematics')
    const { fixedParts } = await import('@/evals/score')
    const kin = buildKinematics({ parts: [shaft, key] }, {})
    expect(kin.derived.has('key')).toBe(true)
    kin.update(1)
    expect(kin.move('key')!.pos.length()).toBeGreaterThan(0.005)
    expect(fixedParts({ parts: [shaft, key] } as never, {}).problems).toEqual([])
  })
})
