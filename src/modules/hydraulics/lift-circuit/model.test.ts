import { describe, expect, it } from 'vitest'
import { solveLinkage } from '@/tractor/linkage'
import { BARREL_LEN, DEFAULTS, PHI_HIGH, PHI_LOW, RAM_MAX, RAM_MIN, ROD_LEN, analyse, ramLength, step } from './model'

describe('lift circuit geometry', () => {
  it('linkage closes over the whole working range and the ram extends to lift', () => {
    for (let i = 0; i <= 20; i++) {
      const phi = PHI_LOW + ((PHI_HIGH - PHI_LOW) * i) / 20
      expect(solveLinkage(phi).valid).toBe(true)
    }
    expect(ramLength(PHI_HIGH).L).toBeGreaterThan(ramLength(PHI_LOW).L)
    expect(solveLinkage(PHI_HIGH).L.y).toBeGreaterThan(solveLinkage(PHI_LOW).L.y + 0.4)
  })
  it('piston stays inside the barrel', () => {
    expect(RAM_MIN - ROD_LEN).toBeGreaterThan(0.02)
    expect(RAM_MAX - ROD_LEN).toBeLessThan(BARREL_LEN - 0.03)
  })
})

describe('lift circuit behaviour — AEE510 Tractor Hydraulic System p2–3', () => {
  it('27 L/min lifts a normal implement; relief (150 kg/cm²) is not reached', () => {
    const a = analyse(DEFAULTS, (PHI_LOW + PHI_HIGH) / 2)
    expect(a.overload).toBe(false)
    expect(a.split.toLoad).toBe(27)
    let phi = PHI_LOW
    for (let i = 0; i < 4000; i++) phi = step({ ...DEFAULTS, valve: 'lift' }, phi, 0.01)
    expect(phi).toBeCloseTo(PHI_HIGH, 6)
  })
  it('an overload sends all the pump flow over the relief valve and the hitch does not move', () => {
    const p = { ...DEFAULTS, load: 200 }
    const phi = step(p, PHI_LOW, 0.1)
    expect(phi).toBe(PHI_LOW)
  })
  it('on "lower" the implement drops under its own weight', () => {
    const phi = step({ ...DEFAULTS, valve: 'lower' }, PHI_HIGH, 0.5)
    expect(phi).toBeGreaterThan(PHI_HIGH)
  })
})
