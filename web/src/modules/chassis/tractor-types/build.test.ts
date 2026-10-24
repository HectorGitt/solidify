import { describe, expect, it } from 'vitest'
import { buildType } from './build'
import { TYPES } from './model'

describe('tractor-types gallery geometry', () => {
  it('lists the twelve types of the AEE502 notes', () => {
    expect(TYPES).toHaveLength(12)
  })
  for (const t of TYPES) {
    it(`builds ${t.id} within the triangle budget`, () => {
      const parts = buildType(t.id)
      let tris = 0
      for (const p of parts) {
        const pos = p.geo.getAttribute('position')
        expect(pos.count).toBeGreaterThan(0)
        tris += (p.geo.index ? p.geo.index.count : pos.count) / 3
      }
      expect(tris).toBeLessThan(150_000)
    })
  }
})
