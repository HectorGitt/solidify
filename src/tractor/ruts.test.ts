import { describe, expect, it } from 'vitest'
import { createSoil, heightAt, pressTyre } from '@/render/soil'
import { STATIC_FRONT, STATIC_REAR, pressTractor, rutDepths } from './ruts'
import { TRACTOR } from './dims'

describe('rut depth', () => {
  it('soft soil and heavy loads rut deeper; slip digs in', () => {
    const firm = rutDepths(STATIC_REAR, STATIC_FRONT, 1500e3, 0.05).rear
    const soft = rutDepths(STATIC_REAR, STATIC_FRONT, 450e3, 0.05).rear
    const heavy = rutDepths(STATIC_REAR * 1.6, STATIC_FRONT, 450e3, 0.05).rear
    const slipping = rutDepths(STATIC_REAR, STATIC_FRONT, 450e3, 0.3).rear
    expect(soft).toBeGreaterThan(firm)
    expect(heavy).toBeGreaterThan(soft)
    expect(slipping).toBeGreaterThan(soft)
  })
  it('stays within a sensible range (a few mm to 8 cm)', () => {
    const d = rutDepths(STATIC_REAR, STATIC_FRONT, 860e3, 0.1)
    expect(d.rear).toBeGreaterThan(0.003)
    expect(d.rear).toBeLessThanOrEqual(0.08)
    expect(d.front).toBeLessThan(d.rear)
  })
})

describe('tyre print', () => {
  it('U-shaped rut with berms beside it', () => {
    const g = createSoil(2, 2, 0.02)
    pressTyre(g, 0, 0, 0, 0.3, 0.19, 0.04, { lugPitch: 0, berm: 0.3 })
    expect(heightAt(g, 0, 0)).toBeCloseTo(-0.04, 3)
    // shallower towards the tread edges
    expect(heightAt(g, 0, 0.17)).toBeGreaterThan(heightAt(g, 0, 0))
    // displaced soil heaped just outside the tread
    expect(heightAt(g, 0, 0.19 * 1.3)).toBeGreaterThan(0)
  })

  it('lugs imprint deeper bars only on a fine grid, and slip smears them', () => {
    const fine = createSoil(2, 2, 0.02)
    pressTyre(fine, 0, 0, 0, 0.5, 0.19, 0.03, { lugPitch: 0.24, chevron: false })
    const along = Array.from({ length: 25 }, (_, i) => heightAt(fine, -0.24 + i * 0.02, 0))
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(0.005)
    const smeared = createSoil(2, 2, 0.02)
    pressTyre(smeared, 0, 0, 0, 0.5, 0.19, 0.03, { lugPitch: 0.24, chevron: false, slip: 0.35 })
    const s = Array.from({ length: 25 }, (_, i) => heightAt(smeared, -0.24 + i * 0.02, 0))
    expect(Math.max(...s) - Math.min(...s)).toBeLessThan(0.001)
    const coarse = createSoil(2, 2, 0.1)
    pressTyre(coarse, 0, 0, 0, 0.5, 0.19, 0.03, { lugPitch: 0.24 })
    expect(heightAt(coarse, 0, 0)).toBeCloseTo(-0.03, 3)
  })

  it('a rut is never raised by a later shallower print or a neighbour’s berm', () => {
    const g = createSoil(3, 3, 0.02)
    pressTyre(g, 0, 0, 0, 0.3, 0.19, 0.05, { lugPitch: 0 })
    pressTyre(g, 0, 0.35, 0, 0.3, 0.19, 0.01, { lugPitch: 0, berm: 0.5 })
    expect(heightAt(g, 0, 0)).toBeCloseTo(-0.05, 3)
  })

  it('follows the heading: a print across X runs along Z', () => {
    const g = createSoil(3, 3, 0.02)
    pressTyre(g, 0, 0, Math.PI / 2, 0.4, 0.1, 0.03, { lugPitch: 0, berm: 0 })
    expect(heightAt(g, 0, 0.3)).toBeLessThan(-0.02)
    expect(heightAt(g, 0.3, 0)).toBeCloseTo(0, 6)
  })

  it('the whole tractor leaves four prints at the right track widths', () => {
    const g = createSoil(6, 4, 0.04)
    pressTractor(g, 0, 0, 0, { rear: 0.03, front: 0.015 }, 0)
    expect(heightAt(g, 0, TRACTOR.rear.track / 2)).toBeLessThan(-0.02)
    expect(heightAt(g, 0, -TRACTOR.rear.track / 2)).toBeLessThan(-0.02)
    expect(heightAt(g, TRACTOR.wheelbase, TRACTOR.front.track / 2)).toBeLessThan(-0.01)
    expect(heightAt(g, 0, 0)).toBeCloseTo(0, 6)
  })
})
