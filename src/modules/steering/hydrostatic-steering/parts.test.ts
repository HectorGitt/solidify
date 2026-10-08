import { describe, expect, it } from 'vitest'
import { buildSteeringParts } from './parts'

describe('steering parts', () => {
  it('builds every part', () => {
    const g = buildSteeringParts()
    const walk = (v: unknown, k: string) => {
      if (v && typeof v === 'object' && 'isBufferGeometry' in v) expect((v as unknown as { attributes: { position: { count: number } } }).attributes.position.count, k).toBeGreaterThan(0)
      else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, `${k}.${kk}`)
    }
    walk(g, 'g')
  })
})
