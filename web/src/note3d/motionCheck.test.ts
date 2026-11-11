import { describe, expect, it } from 'vitest'
import { motionProblems } from './motionCheck'
import type { NotePartSpec, NoteShapeSpec } from './schema'

const Z: [number, number, number] = [Math.PI / 2, 0, 0]
/** a scotch yoke: a crank turning at the back, a slotted yoke in front following its pin, and on the pin `slider` */
const yoke = (slider: NoteShapeSpec[]): NotePartSpec[] => [
  {
    id: 'crank',
    name: 'Crank',
    role: 'moving',
    position: [0, 0, 0],
    motion: { kind: 'rotate', axis: 'z', speed: 6 },
    shapes: [
      { kind: 'cylinder', rotation: Z, r: 0.085, h: 0.016 },
      { kind: 'cylinder', position: [0.06, 0, 0.02], rotation: Z, r: 0.01, h: 0.024 },
    ],
    children: [{ id: 'slider', name: 'Slider', role: 'moving', position: [0.06, 0, 0.026], shapes: slider }],
  },
  {
    id: 'yoke',
    name: 'Slotted yoke',
    role: 'moving',
    position: [0, 0, 0.026],
    mount: { kind: 'follower', target: 'crank', direction: '+x', of: 'pin', throw: 0.06 },
    shapes: [
      { kind: 'box', sx: 0.06, sy: 0.19, sz: 0.024 },
      { kind: 'box', op: 'subtract', sx: 0.024, sy: 0.164, sz: 0.03 },
    ],
  },
]

describe('the machine checked while it moves', () => {
  it('names a block fixed to the crank whose corners sweep through the slot', () => {
    const block: NoteShapeSpec[] = [
      { kind: 'box', sx: 0.023, sy: 0.042, sz: 0.022 },
      { kind: 'cylinder', op: 'subtract', rotation: Z, r: 0.0102, h: 0.024 },
    ]
    expect(motionProblems({ parts: yoke(block), calculations: [], parameters: [] }, {}).join(' ')).toMatch(/Slider runs into Slotted yoke as it moves/)
  })
  it('passes a round roller that fits the slot', () => {
    const roller: NoteShapeSpec[] = [{ kind: 'tube', rotation: Z, rOuter: 0.0115, rInner: 0.0102, h: 0.022 }]
    expect(motionProblems({ parts: yoke(roller), calculations: [], parameters: [] }, {})).toEqual([])
  })
  it('says nothing about a model with no motion', () => {
    const still: NotePartSpec[] = [{ id: 'a', name: 'Block', role: 'static', position: [0, 0, 0], shapes: [{ kind: 'box', sx: 0.1, sy: 0.1, sz: 0.1 }] }]
    expect(motionProblems({ parts: still, calculations: [], parameters: [] }, {})).toEqual([])
  })
})
