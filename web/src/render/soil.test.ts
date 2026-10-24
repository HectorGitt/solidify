import { describe, expect, it } from 'vitest'
import { PROFILES, createSoil, heightAt, pressPrint, roughen, stampRun } from './soil'

describe('soil heightfield', () => {
  it('a mouldboard run cuts a furrow of the set depth and heaps the slice beside it', () => {
    const g = createSoil(4, 2, 0.02)
    stampRun(g, -1, 1, 0, 0.6, PROFILES.mouldboard(0.18, 0.3))
    expect(heightAt(g, 0, 0)).toBeCloseTo(-0.18, 6)
    expect(heightAt(g, 0, 0.3)).toBeGreaterThan(0.05) // turned slice
    expect(heightAt(g, 1.6, 0)).toBe(0) // outside the run
  })

  it('ridges and slots have the requested heights', () => {
    const g = createSoil(2, 2, 0.01)
    stampRun(g, -0.5, 0.5, 0, 0.4, PROFILES.ridge(0.2, 0.6))
    expect(heightAt(g, 0, 0)).toBeCloseTo(0.2, 6)
    const s = createSoil(2, 2, 0.01)
    stampRun(s, -0.5, 0.5, 0, 0.05, PROFILES.slot(0.3, 0.02))
    expect(heightAt(s, 0, 0)).toBeCloseTo(-0.3, 6)
  })

  it('wheel prints only deepen the surface and mark compaction', () => {
    const g = createSoil(2, 2, 0.02)
    pressPrint(g, 0, 0, 0.1, 0.2, 0.03)
    expect(heightAt(g, 0, 0)).toBeCloseTo(-0.03, 6)
    pressPrint(g, 0, 0, 0.1, 0.2, 0.01)
    expect(heightAt(g, 0, 0)).toBeCloseTo(-0.03, 6)
    expect(g.compacted[Math.round((0 - g.z0) / g.cell) * g.nx + Math.round((0 - g.x0) / g.cell)]).toBe(1)
  })

  it('roughen is deterministic and small', () => {
    const a = createSoil(1, 1, 0.05)
    const b = createSoil(1, 1, 0.05)
    roughen(a, 0.01, 7)
    roughen(b, 0.01, 7)
    expect(Array.from(a.height)).toEqual(Array.from(b.height))
    expect(Math.max(...Array.from(a.height).map(Math.abs))).toBeLessThan(0.02)
  })

  it('version increments on change so the renderer re-uploads', () => {
    const g = createSoil(1, 1, 0.1)
    const v = g.version
    stampRun(g, -0.2, 0.2, 0, 0.1, PROFILES.tilth(0.05, 0.1))
    expect(g.version).toBeGreaterThan(v)
  })
})
