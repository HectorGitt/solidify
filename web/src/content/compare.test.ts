import { describe, expect, it } from 'vitest'
import { compareTable, pickParams } from './compare'
import type { CompareDef } from '@/modules/types'

describe('compare variants', () => {
  it('picks only setting keys', () => {
    expect(pickParams({ a: 1, run: 0 }, { a: 5, run: 3, set: () => {} }, ['run'])).toEqual({ a: 5 })
  })

  it('merges each variant over the current settings and marks the best', () => {
    const def: CompareDef = {
      title: 't',
      current: () => ({}),
      variants: [
        { label: 'A', params: { x: 1 } },
        { label: 'B', params: { x: 3 } },
      ],
      metrics: (p) => [
        { label: 'x', value: p.x as number, better: 'high' },
        { label: 'y', value: p.y as number, better: 'low' },
        { label: 'z', value: 0, text: p.x === 3 ? 'spins' : undefined, better: 'high' },
      ],
    }
    const t = compareTable(def, { x: 0, y: 2 })
    expect(t.cols.map((c) => c.params)).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 2 },
    ])
    expect(t.rows[0].cells.map((c) => c.best)).toEqual([false, true])
    // all equal: nothing highlighted
    expect(t.rows[1].cells.map((c) => c.best)).toEqual([false, false])
    // a failed variant (text) is never "best"
    expect(t.rows[2].cells.map((c) => c.best)).toEqual([false, false])
  })

  it('scene comparisons give the expected physics', async () => {
    const lab = (await import('@/modules/traction/traction-lab/index')).default
    const t = compareTable(lab.compare!, lab.compare!.current())
    const slip = t.rows.find((r) => r.label === 'Wheel slip')!.cells.map((c) => c.v.value)
    expect(slip[1]).toBeLessThan(slip[0]) // radial slips less than bias

    const spray = (await import('@/modules/precision/see-and-spray/index')).default
    const s = compareTable(spray.compare!, spray.compare!.current())
    const used = s.rows.find((r) => r.label === 'Chemical used')!.cells.map((c) => c.v.value)
    expect(used[0]).toBe(100)
    expect(used[1]).toBeLessThan(50)
    const killed = s.rows.find((r) => r.label === 'Weeds killed')!.cells.map((c) => c.v.value)
    expect(killed[2]).toBeLessThan(killed[1]) // no latency compensation misses weeds

    const cfg = (await import('@/modules/chassis/configurator/index')).default
    const c = compareTable(cfg.compare!, cfg.compare!.current())
    expect(c.cols).toHaveLength(3)
    expect(c.rows.every((r) => r.cells.every((x) => x.v.text || Number.isFinite(x.v.value)))).toBe(true)
  }, 300000)
})
