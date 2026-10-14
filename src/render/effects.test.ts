import { describe, expect, it } from 'vitest'
import { FARMLAND_ENGINE, torqueAt } from '@/physics/tractor'
import { RATED_RPM, farmlandLoad } from '@/tractor/effects'
import { emitParticle, makePool, smokeDensity, stepPool } from './Effects'
import * as THREE from 'three'

describe('diesel smoke model', () => {
  it('burns clean at part load', () => {
    expect(smokeDensity(0.5, 2000, 2250)).toBe(0)
  })
  it('smokes near full load, worse when lugged below rated speed', () => {
    const atRated = smokeDensity(1, 2250, 2250)
    const lugged = smokeDensity(1, 1300, 2250)
    expect(atRated).toBeGreaterThan(0.4)
    expect(lugged).toBeGreaterThan(atRated)
    expect(lugged).toBeLessThanOrEqual(1)
  })
  it('a load step adds a puff', () => {
    expect(smokeDensity(0.6, 2000, 2250, 0.5)).toBeGreaterThan(smokeDensity(0.6, 2000, 2250))
  })
})

describe('engine load', () => {
  it('is 1 on the full-load curve and 0 when stopped', () => {
    expect(farmlandLoad(torqueAt(FARMLAND_ENGINE, 1500), 1500)).toBeCloseTo(1, 9)
    expect(farmlandLoad(50, NaN)).toBe(0)
  })
  it('half the torque at rated speed is half load', () => {
    expect(farmlandLoad(torqueAt(FARMLAND_ENGINE, RATED_RPM) / 2, RATED_RPM)).toBeCloseTo(0.5, 9)
  })
})

describe('particle pool', () => {
  it('particles rise, drift with the wind and expire', () => {
    const p = makePool(4)
    emitParticle(p, 0, 2, 0, 0, 1, 0, { life: 1, size: 0.1, grow: 0.2, alpha: 0.5, color: new THREE.Color(), lift: 0.2, drag: 1 })
    for (let k = 0; k < 50; k++) stepPool(p, 0.01, [-1, 0, 0])
    expect(p.pos[1]).toBeGreaterThan(2)
    expect(p.pos[0]).toBeLessThan(0)
    for (let k = 0; k < 60; k++) stepPool(p, 0.01, [0, 0, 0])
    expect(p.age[0]).toBeGreaterThanOrEqual(p.life[0])
  })
  it('the ring buffer reuses the oldest slot', () => {
    const p = makePool(2)
    const o = { life: 1, size: 0.1, grow: 0, alpha: 1, color: new THREE.Color(), lift: 0, drag: 0 }
    emitParticle(p, 1, 1, 1, 0, 0, 0, o)
    emitParticle(p, 2, 1, 1, 0, 0, 0, o)
    emitParticle(p, 3, 1, 1, 0, 0, 0, o)
    expect(p.pos[0]).toBe(3)
  })
})
