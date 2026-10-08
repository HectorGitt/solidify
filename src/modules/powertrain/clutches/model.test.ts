import { describe, expect, it } from 'vitest'
import { buildStatic } from './geometry'
import { IPTO_SURFACES, iptoCapacity, singleCapacity, slipStep, type SlipState } from './model'

describe('clutch scene — TTS p2–4, TOP p5–8, AEE503 M8', () => {
  it('single plate: 7.2 kN, f 0.3, 2 faces, R_f 120 mm (uniform wear) → 518 N·m', () => {
    expect(singleCapacity('wear')).toBeCloseTo(7200 * 0.3 * 0.12 * 2, 6)
    expect(singleCapacity('pressure')).toBeGreaterThan(singleCapacity('wear'))
  })
  it('engaged clutch carries the load; a released clutch lets the shaft coast to rest under load', () => {
    const s: SlipState = { w: 100, locked: true }
    slipStep(s, 100, 500, 120, 0.25, 0.01)
    expect(s.locked).toBe(true)
    for (let i = 0; i < 100; i++) slipStep(s, 100, 0, 120, 0.25, 0.01)
    expect(s.locked).toBe(false)
    expect(s.w).toBe(0)
  })
  it('capacity below the load → slip; restoring the capacity re-locks at engine speed', () => {
    const s: SlipState = { w: 100, locked: true }
    slipStep(s, 100, 80, 120, 0.25, 0.01)
    expect(s.locked).toBe(false)
    expect(s.w).toBeLessThan(100)
    for (let i = 0; i < 400; i++) slipStep(s, 100, 300, 120, 0.25, 0.01)
    expect(s.locked).toBe(true)
    expect(s.w).toBe(100)
  })
  it('wet IPTO pack: 6 driving faces + 5 friction plates → 10 surfaces; no oil, no torque', () => {
    expect(IPTO_SURFACES).toBe(10)
    expect(iptoCapacity(0, 'wear')).toBe(0)
    expect(iptoCapacity(15e5, 'wear')).toBeGreaterThan(1000)
  })
  it('geometry builds', () => {
    const g = buildStatic()
    expect(g.single.disc.linings.attributes.position.count).toBeGreaterThan(0)
    expect(g.ipto.friction.attributes.position.count).toBeGreaterThan(0)
  })
})
