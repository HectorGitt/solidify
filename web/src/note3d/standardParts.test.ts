import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildPartGeometry } from './builder'

const size = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox()
  return g.boundingBox!.getSize(new THREE.Vector3())
}

describe('standard parts drawn by the app', () => {
  it('a ball bearing scaled to its bore and width: races, cage and balls about Y', () => {
    // the reference is a 40 mm bore, 80 mm outside, 18 mm wide; a 25 mm bore is 50 mm outside
    const s = size(buildPartGeometry([{ kind: 'bearing', d: 0.025, h: 0.015 }], {}))
    expect(s.x).toBeCloseTo(0.05, 3)
    expect(s.z).toBeCloseTo(0.05, 3)
    expect(s.y).toBeCloseTo(0.015, 3)
  })
  it('every bearing type builds, a size from a parameter too', () => {
    for (const bearing of ['ball', 'roller', 'taper', 'needle', 'thrust'] as const) {
      const g = buildPartGeometry([{ kind: 'bearing', bearing, d: 'bore / 1000' }], { bore: 30 })
      expect(g.getAttribute('position').count).toBeGreaterThan(100)
      expect(size(g).x).toBeGreaterThan(0.03)
    }
  })
})

describe('a standard part built by hand', () => {
  it('is named, and the bearing shape passes', async () => {
    const { scoreBuild } = await import('@/evals/score')
    const shaft = { id: 'shaft', name: 'Shaft', role: 'moving', position: [0, 0, 0], shapes: [{ kind: 'cylinder', r: 0.0125, h: 0.2 }], motion: { kind: 'rotate', axis: 'y', speed: 2 } }
    const byHand = { id: 'b', name: 'Deep-groove ball bearing', role: 'static', mount: { kind: 'coaxial', target: 'shaft' }, shapes: [{ kind: 'tube', rOuter: 0.026, rInner: 0.0125, h: 0.015 }, { kind: 'sphere', r: 0.004, radialCount: 9, radialRadius: 0.019 }] }
    const standard = { ...byHand, shapes: [{ kind: 'bearing', bearing: 'ball', d: 0.025, h: 0.015 }] }
    const check = (b: object) => scoreBuild({ id: 'x', prompt: 'a bearing' }, { spec: { title: 'x', parameters: [], calculations: [], annotations: [], parts: [shaft, b] } }, 0, { motion: false }).checks.find((c) => c.name === 'standard parts')
    expect(check(byHand)?.ok).toBe(false)
    expect(check(byHand)?.detail).toMatch(/Deep-groove ball bearing: draw it as a "bearing" shape/)
    expect(check(standard)?.ok).toBe(true)
  })
})

describe('opening cut away', () => {
  it('cuts a casing round the drive, not a base plate with pedestals', async () => {
    const { openingCut } = await import('./openingCut')
    const Z: [number, number, number] = [Math.PI / 2, 0, 0]
    const shaft = { id: 'shaft', name: 'Shaft', role: 'moving' as const, position: [0, 0, 0] as [number, number, number], rotation: Z, shapes: [{ kind: 'cylinder' as const, r: 0.01, h: 0.1 }], motion: { kind: 'rotate' as const, axis: 'y' as const, speed: 2 } }
    const casing = { id: 'case', name: 'Gearbox casing', role: 'housing' as const, position: [0, 0, 0] as [number, number, number], shapes: [{ kind: 'box' as const, sx: 0.2, sy: 0.2, sz: 0.2 }, { kind: 'box' as const, op: 'subtract' as const, sx: 0.18, sy: 0.18, sz: 0.18 }] }
    const base = { id: 'base', name: 'Base and pedestals', role: 'housing' as const, position: [0, 0, 0] as [number, number, number], shapes: [{ kind: 'box' as const, sx: 0.3, sy: 0.2, sz: 0.2 }] }
    const spec = (p: object) => ({ title: 'x', parameters: [], calculations: [], annotations: [], parts: [p, shaft] }) as never
    expect(openingCut(spec(casing))?.enabled).toBe(true)
    expect(openingCut(spec(base))).toBeNull()
  })
})
