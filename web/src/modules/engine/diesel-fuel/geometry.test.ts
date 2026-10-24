import { describe, expect, it } from 'vitest'
import { buildStatic } from './geometry'

describe('diesel fuel system geometry', () => {
  it('builds every part within the triangle budget (CSG is slow: generous timeout)', () => {
    const t0 = performance.now()
    const g = buildStatic()
    console.log(`diesel-fuel geometry built in ${(performance.now() - t0).toFixed(0)} ms`)
    let tris = 0
    for (const [k, v] of Object.entries(g)) {
      const n = v.attributes.position.count
      expect(n, k).toBeGreaterThan(0)
      tris += n / 3
    }
    console.log(`≈ ${Math.round(tris)} triangles`)
    expect(tris).toBeLessThan(150_000)
  }, 120_000)
})
