import { beforeEach, describe, expect, it } from 'vitest'
import { C, FORWARD_SPEEDS, IDLER, SS, Z, boxRatio, forwardTable, reverseAllowed } from './dims'
import { buildStatic } from './geometry'
import { live, makeGraph, resetSeq, seq, stepMF, useMF } from './model'

const run = (steps: number) => {
  const g = makeGraph()
  for (let i = 0; i < steps; i++) stepMF(g, 0.01)
  return g
}

describe('MF 16-speed gearbox — TOP p3–4 Fig A2.6, TTS p4', () => {
  beforeEach(() => {
    useMF.getState().reset()
    resetSeq()
  })
  it('4 × 2 × 2 = 16 forward; 1.6–32 km/h at 2000 rpm; reverse in 12', () => {
    expect(FORWARD_SPEEDS).toBe(16)
    const rows = forwardTable(2000)
    expect(rows).toHaveLength(16)
    expect(rows[0].kmh).toBeGreaterThan(1.5)
    expect(rows[0].kmh).toBeLessThan(1.8)
    expect(rows[15].kmh).toBeGreaterThan(31)
    expect(rows[15].kmh).toBeLessThan(34)
    const allowed = rows.filter((r) => reverseAllowed(r.labels[2] as 'L' | 'H', Number(r.labels[1]) as 1, r.labels[0] as 'L' | 'H'))
    expect(allowed).toHaveLength(12)
  })
  it('every pair across the two shaft lines has 60 teeth; speed-shift planets fit', () => {
    for (let k = 0; k < 4; k++) expect(Z.m[k] + Z.l[k]).toBe(60)
    expect(Z.lh + Z.oh).toBe(60)
    expect(Z.ll + Z.ol).toBe(60)
    expect(Z.fwd + Z.cm).toBe(60)
    expect(Z.rev + Z.cm + 4).toBeLessThan(60) // reverse gear clears the constant-mesh gear
    expect(SS.zr).toBe(SS.zs + 2 * SS.zp)
    expect((SS.zs + SS.zr) % SS.n).toBe(0)
    expect(Math.hypot(IDLER.x, IDLER.y + C)).toBeCloseTo((0.005 * (Z.idler + Z.cm)) / 2, 9)
  })
  it('drive graph reproduces Π drivers / Π followers in L2H forward; PTO at engine speed', () => {
    run(100)
    expect(live.output).toBeCloseTo(2000 * boxRatio('H', 'F', 2, 'L'), 3)
    expect(live.pto).toBeCloseTo(2000, 6)
  })
  it('speed-shift low: carrier = sun × 45/114 (ring held)', () => {
    useMF.getState().set({ speedShift: 'L' })
    run(50)
    expect(live.carrier / live.input).toBeCloseTo(45 / 114, 9)
  })
  it('shuttle to reverse reverses the output; reverse refused in speeds 13–16', () => {
    useMF.getState().set({ shuttle: 'R' })
    const g = run(200)
    expect(seq.shuttle).toBe('R')
    expect(Math.sign(g.get('output').omega)).toBe(Math.sign(boxRatio('H', 'R', 2, 'L')))
    useMF.getState().set({ shuttle: 'F', range: 'H', gear: 4 })
    useMF.getState().set({ shuttle: 'R' })
    expect(useMF.getState().shuttle).toBe('F')
    expect(useMF.getState().warning).toBeTruthy()
  })
  it('geometry builds', () => {
    expect(buildStatic().m1.gear.attributes.position.count).toBeGreaterThan(0)
  })
})
