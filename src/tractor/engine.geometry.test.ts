import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { pinHeight } from '@/physics/engine'
import { SC } from '@/modules/engine/four-stroke/model'
import { CYL_Z, FIRING, PITCH, buildStatic } from './engine.geometry'

describe('tractor engine (full detail)', () => {
  it('builds every part', { timeout: 120000 }, () => {
    const t0 = performance.now()
    const g = buildStatic()
    console.log(`tractor engine geometry built in ${(performance.now() - t0).toFixed(0)} ms`)
    for (const [k, v] of Object.entries(g)) {
      const geos = 'isBufferGeometry' in (v as object) ? [v] : Object.values(v as object)
      for (const geo of geos) expect((geo as THREE.BufferGeometry).attributes.position.count, k).toBeGreaterThan(0)
    }
    // one-piece castings span all four cylinders
    g.block.computeBoundingBox()
    const bb = g.block.boundingBox!
    expect(bb.max.z - bb.min.z).toBeGreaterThan(3 * PITCH + 0.1)
  })

  it('fires 1-3-4-2 with pistons 1 & 4 and 2 & 3 moving together', () => {
    // cylinder i reaches TDC when the crank has turned its firing angle
    const at = (deg: number) => FIRING.map((f) => pinHeight(SC, ((deg - f) * Math.PI) / 180))
    const h = at(0)
    expect(h[0]).toBeCloseTo(h[3], 9)
    expect(h[1]).toBeCloseTo(h[2], 9)
    expect(h[0]).toBeGreaterThan(h[1])
    // firing order: sort cylinders by firing angle
    const order = FIRING.map((f, i) => [f, i + 1]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
    expect(order).toEqual([1, 3, 4, 2])
    expect(CYL_Z[0]).toBeGreaterThan(CYL_Z[3]) // no. 1 at the front
  })
})
