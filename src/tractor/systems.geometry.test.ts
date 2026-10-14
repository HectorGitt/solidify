import { describe, expect, it } from 'vitest'
import type * as THREE from 'three'
import { buildStatic } from './systems.geometry'

describe('tractor systems geometry', () => {
  it('builds every system part', { timeout: 120000 }, () => {
    const g = buildStatic()
    const walk = (v: unknown, path: string) => {
      if (v && typeof v === 'object' && 'isBufferGeometry' in v) expect((v as THREE.BufferGeometry).attributes.position.count, path).toBeGreaterThan(0)
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`)
    }
    walk(g, 'systems')
  })
})
