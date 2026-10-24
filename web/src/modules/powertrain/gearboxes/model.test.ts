import { beforeEach, describe, expect, it } from 'vitest'
import { M, SIGMA, Z } from './dims'
import { buildStatic } from './geometry'
import { boxRatio, live, makeGraph, resetShift, shift, speedTable, stepGearbox, useGearbox, type GearboxParams } from './model'

function settle(p: Partial<GearboxParams>) {
  useGearbox.setState({ ...useGearbox.getState(), ...p })
  const g = makeGraph()
  resetShift()
  for (let i = 0; i < 300; i++) stepGearbox(g, 0.01)
  return g
}

describe('gearbox scene — TTS p4–7, TOP p3–4', () => {
  beforeEach(() => useGearbox.getState().reset())

  it('every top–bottom pair has the same tooth sum (same centre distance)', () => {
    for (const [a, b] of [
      [Z.t1, Z.b1],
      [Z.t2, Z.b2],
      [Z.t3, Z.b3],
      [Z.rhb, Z.rho],
      [Z.rlb, Z.rlo],
    ])
      expect(a + b).toBe(SIGMA)
    expect((M * SIGMA) / 2).toBeCloseTo(0.135, 9)
  })
  it('3 gears + reverse × 2 ranges = 6F / 2R; speed ratio = Π drivers / Π followers', () => {
    const rows = speedTable(2000)
    expect(rows.filter((r) => r.ratio > 0)).toHaveLength(6)
    expect(rows.filter((r) => r.ratio < 0)).toHaveLength(2)
    expect(boxRatio('1', 'L')).toBeCloseTo((15 / 45) * (18 / 42), 12)
    expect(boxRatio('R', 'H')).toBeLessThan(0)
  })
  it('driving in 2nd high: output = engine × ratio', () => {
    const g = settle({ variant: 'synchro', gear: '2', range: 'H', engineRpm: 1800 })
    expect(live.output).toBeCloseTo(1800 * boxRatio('2', 'H'), 3)
    expect(g.get('crown').omega).not.toBe(0)
  })
  it('synchromesh: 2nd → 3rd on the move, speeds matched before the dogs engage', () => {
    const g = settle({ variant: 'synchro', gear: '2', range: 'H' })
    useGearbox.getState().set({ gear: '3' })
    let sawSync = false
    let minOut = Infinity
    for (let i = 0; i < 600 && !(shift.phase === 'drive' && shift.gear === '3'); i++) {
      stepGearbox(g, 0.01)
      sawSync ||= shift.phase === 'sync'
      minOut = Math.min(minOut, Math.abs(live.output))
    }
    expect(shift.gear).toBe('3')
    expect(sawSync).toBe(true)
    expect(shift.clash).toBeLessThan(0.05)
    expect(minOut).toBeGreaterThan(100) // still moving
  })
  it('sliding mesh: the tractor is stopped before the gears are slid into mesh', () => {
    const g = settle({ variant: 'sliding', gear: '2', range: 'H' })
    useGearbox.getState().set({ gear: '1' })
    let sawStop = false
    for (let i = 0; i < 800 && !(shift.phase === 'drive' && shift.gear === '1'); i++) {
      stepGearbox(g, 0.01)
      sawStop ||= shift.phase === 'stop'
    }
    expect(sawStop).toBe(true)
    expect(shift.gear).toBe('1')
    for (let i = 0; i < 50; i++) stepGearbox(g, 0.01)
    expect(live.output).toBeCloseTo(1800 * boxRatio('1', 'H'), 3)
  })
  it('geometry builds', () => {
    expect(buildStatic().clusterA.gears.attributes.position.count).toBeGreaterThan(0)
  })
})
