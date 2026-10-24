import { describe, expect, it } from 'vitest'
import { buildStatic } from './geometry'

describe('cylinder geometry', () => {
  it('builds every part, including the spool valve', () => {
    const g = buildStatic()
    for (const [k, v] of Object.entries(g)) expect(v.attributes.position.count, k).toBeGreaterThan(0)
  })
})
