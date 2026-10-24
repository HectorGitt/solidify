import { describe, expect, it } from 'vitest'
import { buildStatic } from './geometry'

describe('lift-circuit geometry', () => {
  it('builds every part', () => {
    const t0 = performance.now()
    const g = buildStatic()
    console.log(`lift geometry ${(performance.now() - t0).toFixed(0)} ms`)
    const walk = (v: unknown, k: string) => {
      if (v && typeof v === 'object' && 'isBufferGeometry' in v) expect((v as unknown as { attributes: { position: { count: number } } }).attributes.position.count, k).toBeGreaterThan(0)
      else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, `${k}.${kk}`)
    }
    walk(g, 'g')
  })
})
