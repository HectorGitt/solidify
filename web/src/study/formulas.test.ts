import { describe, expect, it } from 'vitest'
import { ERRATA } from '@/content/errata'
import { MODULES } from '@/modules/catalog'
import { FORMULAS } from './formulas'

describe('formula sheet registry', () => {
  it('has at least 80 formulas with unique ids', () => {
    expect(FORMULAS.length).toBeGreaterThanOrEqual(80)
    expect(new Set(FORMULAS.map((f) => f.id)).size).toBe(FORMULAS.length)
  })
  it('every formula links to a catalogued scene and a known erratum', () => {
    for (const f of FORMULAS) {
      const [m, s] = f.scene.split('/')
      expect(MODULES.find((x) => x.id === m)?.scenes.some((x) => x.id === s), f.scene).toBe(true)
      if (f.errata) expect(ERRATA.some((e) => e.id === f.errata), f.errata).toBe(true)
    }
  })
})
