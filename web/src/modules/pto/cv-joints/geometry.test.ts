import { describe, expect, it } from 'vitest'
import { openEdges, volume } from '../shared/cardan.test'
import { buildStatic } from './geometry'

describe('CV-joint geometry', () => {
  it('builds every part; lathe/CSG solids are closed and outward-facing', () => {
    const t0 = performance.now()
    const g = buildStatic()
    console.log(`cv-joint geometry built in ${(performance.now() - t0).toFixed(0)} ms`)
    for (const [k, v] of Object.entries(g)) {
      expect(v.attributes.position.count, k).toBeGreaterThan(0)
      expect(volume(v), k).toBeGreaterThan(0)
    }
    for (const k of ['rzBall', 'triRoller', 'centreSocket', 'weissCentre'] as const) expect(openEdges(g[k]), k).toBe(0)
  })
})
