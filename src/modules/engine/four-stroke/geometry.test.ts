import { describe, expect, it } from 'vitest'
import { buildEngineGeometry } from './geometry'

describe('engine geometry', () => {
  it('builds every part (and reports how long it takes)', () => {
    const t0 = performance.now()
    const g = buildEngineGeometry()
    const ms = performance.now() - t0
    console.log(`engine geometry built in ${ms.toFixed(0)} ms`)
    for (const [k, v] of Object.entries(g)) {
      if (typeof v === 'function') continue
      const geos = 'isBufferGeometry' in (v as object) ? [v] : Object.values(v as object)
      for (const geo of geos) expect((geo as { attributes: { position: { count: number } } }).attributes.position.count, k).toBeGreaterThan(0)
    }
  })
})
