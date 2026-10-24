import { describe, expect, it } from 'vitest'
import { SPOT_DEFAULTS, expected, patchShift, planPass, scatterWeeds, sprayedArea, summarise } from './spotspray'

const spec = { ...SPOT_DEFAULTS, jitter: 0, recall: 1, falsePerM2: 0 }

describe('spot spraying', () => {
  it('weeds scatter at the asked density, deterministically', () => {
    const a = scatterWeeds(3, 0, 100, 12, 0.5)
    expect(a.length).toBe(600)
    expect(scatterWeeds(3, 0, 100, 12, 0.5)[10]).toEqual(a[10])
  })

  it('with latency compensated and enough look-ahead, every detected weed is hit', () => {
    const weeds = scatterWeeds(1, 0, 50, 12, 0.3)
    const r = summarise(spec, planPass(spec, weeds, 10 / 3.6, 1, 0, 50), 50)
    expect(r.control).toBe(1)
  })

  it('uncompensated latency moves the patch v·latency behind: misses at speed', () => {
    const s = { ...spec, compensate: false }
    expect(patchShift(s, 5, 0, 0.03)).toBeCloseTo(5 * s.latency, 9)
    const weeds = scatterWeeds(1, 0, 50, 12, 0.3)
    expect(summarise(s, planPass(s, weeds, 18 / 3.6, 1, 0, 50), 50).control).toBeLessThan(0.1)
  })

  it('too little look-ahead for the latency makes the nozzle late even when compensated', () => {
    const s = { ...spec, lookAhead: 0.3, latency: 0.15 }
    expect(patchShift(s, 6, 0, 0.03)).toBeGreaterThan(0.5)
  })

  it('saves most of the chemical at low weed density, little at high density', () => {
    const low = expected({ ...SPOT_DEFAULTS }, 0.1, 12)
    const high = expected({ ...SPOT_DEFAULTS }, 8, 12)
    expect(low.saving).toBeGreaterThan(0.9)
    expect(high.saving).toBeLessThan(low.saving)
  })

  it('overlapping patches on one nozzle are not double counted', () => {
    const area = sprayedArea(spec, [
      { k: 0, x0: 0, x1: 1, weed: 0 },
      { k: 0, x0: 0.5, x1: 1.5, weed: 1 },
      { k: 1, x0: 0, x1: 1, weed: 2 },
    ])
    expect(area).toBeCloseTo((1.5 + 1) * spec.spacing, 9)
  })

  it('missed detections lower control; false detections waste spray', () => {
    const weeds = scatterWeeds(2, 0, 50, 12, 0.5)
    const poor = { ...spec, recall: 0.7, falsePerM2: 0.2 }
    const r = summarise(poor, planPass(poor, weeds, 3, 4, 0, 50), 50)
    expect(r.control).toBeLessThan(0.8)
    expect(r.falseFires).toBe(Math.round(0.2 * 12 * 50))
  })
})
