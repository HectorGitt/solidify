import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildPartGeometry } from './builder'
import type { NoteShapeSpec } from './schema'

const size = (s: Record<string, unknown>) => {
  const g = buildPartGeometry([s as unknown as NoteShapeSpec], {})
  g.computeBoundingBox()
  return g.boundingBox!.getSize(new THREE.Vector3())
}

describe('round shapes', () => {
  it('all turn about their local Y axis: thin along Y when they are discs, long along Y when they are rods', () => {
    for (const s of [
      { kind: 'gear', teeth: 20, module: 0.004, h: 0.02 },
      { kind: 'bevelGear', teeth: 20, module: 0.004, h: 0.02 },
      { kind: 'sprocket', teeth: 18, module: 0.004, h: 0.01 },
      { kind: 'pulley', r: 0.05, h: 0.02 },
      { kind: 'torus', r: 0.05, tubeRadius: 0.008 },
    ]) {
      const z = size(s)
      // a disc: about as wide in X as in Z, and thin in Y
      expect(Math.abs(z.x - z.z), s.kind).toBeLessThan(0.01)
      expect(z.y, s.kind).toBeLessThan(z.x * 0.5)
    }
    const shaft = size({ kind: 'cylinder', r: 0.02, h: 0.2 })
    expect(shaft.y).toBeGreaterThan(shaft.x * 3)
  })
})
