import { describe, expect, it } from 'vitest'
import { DEFAULT_LINKAGE, lineIntersect, linkageRange, phiForHitchHeight, solveLinkage } from './linkage'

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('three-point linkage (Macmillan Figs 6.4–6.5)', () => {
  it('closes the four-bar chain over a working range that includes the ground and full lift', () => {
    const { lo, hi } = linkageRange()
    const ground = phiForHitchHeight(0.2)
    const raised = phiForHitchHeight(0.75)
    expect(lo).toBeLessThan(raised)
    expect(hi).toBeGreaterThan(ground)
  })
  it('keeps every link at its length', () => {
    const g = DEFAULT_LINKAGE
    for (const y of [0.2, 0.4, 0.6, 0.75]) {
      const p = solveLinkage(phiForHitchHeight(y))
      expect(p.valid).toBe(true)
      expect(p.L.y).toBeCloseTo(y, 6)
      expect(dist(p.L, g.A)).toBeCloseTo(g.lower, 6)
      expect(dist(p.U, p.L)).toBeCloseTo(g.mast, 6)
      expect(dist(p.U, g.B)).toBeCloseTo(g.top, 6)
      expect(dist(p.D, g.C)).toBeCloseTo(g.liftArm, 6)
      expect(dist(p.D, p.E)).toBeCloseTo(g.liftRod, 6)
    }
  })
  it('virtual hitch point lies ahead of the implement and on both link lines', () => {
    const p = solveLinkage(phiForHitchHeight(0.25))
    expect(p.V).not.toBeNull()
    expect(p.V!.x).toBeGreaterThan(p.L.x)
    const g = DEFAULT_LINKAGE
    const cross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    expect(cross(g.A, p.L, p.V!)).toBeCloseTo(0, 6)
    expect(cross(g.B, p.U, p.V!)).toBeCloseTo(0, 6)
  })
  it('lifting raises the lift arm', () => {
    expect(solveLinkage(phiForHitchHeight(0.7)).beta).toBeGreaterThan(solveLinkage(phiForHitchHeight(0.25)).beta)
  })
  it('lineIntersect returns null for parallel lines', () => {
    expect(lineIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull()
  })
})
