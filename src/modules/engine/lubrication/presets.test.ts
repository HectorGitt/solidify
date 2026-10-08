import { describe, expect, it } from 'vitest'
import { DEFAULTS, operating } from './model'

describe('lubrication presets behave as their notes say (TB Fig 6.2 circuit)', () => {
  const hot = operating(DEFAULTS)
  it('hot at working speed: relief valve shut', () => {
    expect(hot.reliefOpen).toBe(0)
  })
  it('cold start: relief valve opens and spills oil', () => {
    const r = operating({ ...DEFAULTS, tempC: 10, rpm: 1800 })
    expect(r.reliefOpen).toBeGreaterThan(0)
    expect(r.reliefLpm).toBeGreaterThan(0)
  })
  it('hot idle, clogged filter and worn bearings all lower the gallery pressure', () => {
    expect(operating({ ...DEFAULTS, tempC: 110, rpm: 600 }).galleryBar).toBeLessThan(hot.galleryBar)
    expect(operating({ ...DEFAULTS, filterClog: 5 }).galleryBar).toBeLessThan(hot.galleryBar)
    expect(operating({ ...DEFAULTS, wear: 2.5 }).galleryBar).toBeLessThan(hot.galleryBar)
  })
})
