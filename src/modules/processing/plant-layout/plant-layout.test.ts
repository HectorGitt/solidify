import { describe, expect, it } from 'vitest'
import {
  BUILDING,
  DEFAULTS,
  GARRI_STATIONS,
  FEED_MILL_STATIONS,
  assessLayout,
  getStationPositions,
  type LayoutPattern,
} from './model'

describe('plant-layout model and physics metrics', () => {
  it('provides complete station definitions for Garri and Feed Mill lines', () => {
    expect(GARRI_STATIONS).toHaveLength(8)
    expect(FEED_MILL_STATIONS).toHaveLength(8)

    // Check ASME symbol assignments
    const asmeTypes = new Set(GARRI_STATIONS.map((s) => s.asme))
    expect(asmeTypes.has('operation')).toBe(true)
    expect(asmeTypes.has('storage')).toBe(true)
    expect(asmeTypes.has('inspection')).toBe(true)

    // Check mass fraction monotonicity / conservation
    GARRI_STATIONS.forEach((s) => {
      expect(s.massFraction).toBeGreaterThan(0)
      expect(s.massFraction).toBeLessThanOrEqual(1.0)
    })
  })

  it('keeps all station positions within building interior bounds', () => {
    const patterns: LayoutPattern[] = ['straight', 'u-shape', 'serpentine', 'circular', 'odd-angle']
    const halfW = BUILDING.width / 2
    const halfD = BUILDING.depth / 2

    patterns.forEach((pat) => {
      const pos = getStationPositions(pat)
      expect(pos).toHaveLength(8)
      pos.forEach(([x, z]) => {
        expect(Math.abs(x)).toBeLessThanOrEqual(halfW)
        expect(Math.abs(z)).toBeLessThanOrEqual(halfD)
      })
    })
  })

  it('verifies zero flow crossings for clean layout patterns (Rule 2)', () => {
    const cleanPatterns: LayoutPattern[] = ['straight', 'u-shape', 'serpentine', 'circular']

    cleanPatterns.forEach((pat) => {
      const res = assessLayout({ ...DEFAULTS, pattern: pat })
      expect(res.crossings).toBe(0)
      expect(res.rules.noCrossings).toBe(true)
      expect(res.totalLength).toBeGreaterThan(0)
      expect(res.totalEffort).toBeGreaterThan(0)
    })
  })

  it('detects route collisions and crossing violations in odd-angle layout', () => {
    const res = assessLayout({ ...DEFAULTS, pattern: 'odd-angle' })
    expect(res.crossings).toBeGreaterThan(0)
    expect(res.rules.noCrossings).toBe(false)

    // Handling effort should be significantly worse than optimal U-shape
    const uRes = assessLayout({ ...DEFAULTS, pattern: 'u-shape' })
    expect(res.totalEffort).toBeGreaterThan(uRes.totalEffort)
    expect(res.relativeHandlingEffort).toBeGreaterThan(150)
  })

  it('correctly assesses aisle clearances against safety threshold (Rule 4)', () => {
    // Normal 2.5 m aisle should pass for U-shape
    const normal = assessLayout({ ...DEFAULTS, pattern: 'u-shape', aisleWidth: 2.5 })
    expect(normal.minClearance).toBeGreaterThan(2.0)

    // Unrealistically wide aisle threshold should flag inadequate clearance
    const tight = assessLayout({ ...DEFAULTS, pattern: 'u-shape', aisleWidth: 10.0 })
    expect(tight.aisleOk).toBe(false)
  })

  it('scales handling effort linearly with batch input mass', () => {
    const res5 = assessLayout({ ...DEFAULTS, batchMass: 5.0 })
    const res10 = assessLayout({ ...DEFAULTS, batchMass: 10.0 })

    expect(res10.totalEffort).toBeCloseTo(res5.totalEffort * 2, 2)
  })

  it('calculates ASME symbol inventory accurately', () => {
    const res = assessLayout(DEFAULTS)
    const counts = res.asmeCounts

    const totalStationSymbols = counts.operation + counts.inspection + counts.storage + counts.delay
    expect(totalStationSymbols).toBe(8)
    expect(counts.transport).toBe(7) // 7 transfers between 8 stations
  })
})
