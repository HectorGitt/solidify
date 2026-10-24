import { describe, expect, it } from 'vitest'
import { PAIRS } from './DrivelineInternals'
import { GEARBOX } from './geometry'

describe('gearbox internals', () => {
  it('every speed pair meshes on the same centre distance', () => {
    const sum = (2 * GEARBOX.centre) / GEARBOX.module
    expect(GEARBOX.input[0] + GEARBOX.input[1]).toBe(sum)
    expect(GEARBOX.selected[0] + GEARBOX.selected[1]).toBe(sum)
    for (const [main, lay] of PAIRS) expect(main + lay).toBe(sum)
  })

  it('pairs do not overlap along the shafts', () => {
    const xs = [0.47, 0.3, ...PAIRS.map(([, , x]) => x)].sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(0.03 + 0.03) // two gear widths: room for the collar
  })
})
