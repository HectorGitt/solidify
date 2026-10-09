import { describe, expect, it } from 'vitest'
import { DEFAULTS, PLANS, evaluate, externalDoors } from './model'

const onWall = (r: { x: number; z: number; w: number; d: number }, d: { x: number; z: number; axis: 'x' | 'z' }) =>
  d.axis === 'x'
    ? d.x > r.x && d.x < r.x + r.w && (Math.abs(d.z - r.z) < 0.05 || Math.abs(d.z - r.z - r.d) < 0.05)
    : d.z > r.z && d.z < r.z + r.d && (Math.abs(d.x - r.x) < 0.05 || Math.abs(d.x - r.x - r.w) < 0.05)

describe('farm dwelling plans (AEE505 LN p14–17)', () => {
  it('seven plan types: 3 traditional + 4 contemporary', () => {
    expect(PLANS.length).toBe(7)
    expect(PLANS.filter((p) => p.group === 'Traditional').length).toBe(3)
  })
  it('every door lies on a wall of some room, and no rooms overlap', () => {
    for (const p of PLANS) {
      for (const d of p.doors) expect(p.rooms.some((r) => onWall(r, d)), `${p.id} door ${d.x},${d.z}`).toBe(true)
      const solid = p.rooms.filter((r) => r.kind !== 'yard')
      for (let i = 0; i < solid.length; i++)
        for (let j = i + 1; j < solid.length; j++) {
          const a = solid[i]
          const b = solid[j]
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z)
          expect(ox > 1e-6 && oz > 1e-6, `${p.id}: ${a.name} / ${b.name}`).toBe(false)
        }
    }
  })
  it('one-room house has one door; external-access has a door per room', () => {
    expect(externalDoors(PLANS[0])).toBe(1)
    expect(externalDoors(PLANS.find((p) => p.id === 'external')!)).toBe(6)
    expect(externalDoors(PLANS.find((p) => p.id === 'central')!)).toBe(2)
  })
  it('worked example 3 (Ass p3): courtyard house for a family of 7 meets every room rule', () => {
    const ev = evaluate({ ...DEFAULTS, plan: 'courtyard', family: 7 })
    expect(ev.occ).toEqual([2, 3, 2])
    expect(ev.passes).toBe(ev.checks.length)
    expect(ev.ewOk).toBe(true)
  })
  it('one 20 m² room for 7 people fails the 3 m²/person rule (needs 21 m²)', () => {
    const ev = evaluate({ ...DEFAULTS, plan: 'mp-one', family: 7 })
    expect(ev.checks[0].check!.ok).toBe(false)
  })
})
