import { describe, expect, it } from 'vitest'
import { buildStatic } from './geometry'

describe('cooling geometry', () => {
  it('builds every part', () => {
    const t0 = performance.now()
    const g = buildStatic()
    console.log(`cooling geometry built in ${(performance.now() - t0).toFixed(0)} ms`)
    const walk = (v: unknown, k: string) => {
      if (typeof v === 'number') return
      if (v && typeof v === 'object' && 'isBufferGeometry' in v) {
        expect((v as unknown as { attributes: { position: { count: number } } }).attributes.position.count, k).toBeGreaterThan(0)
        return
      }
      for (const [kk, vv] of Object.entries(v as object)) walk(vv, `${k}.${kk}`)
    }
    walk(g, 'g')
  })
})
