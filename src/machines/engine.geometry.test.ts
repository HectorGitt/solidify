import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { pinHeight } from '@/physics/engine'
import { SC } from '@/modules/engine/four-stroke/model'
import { FIRING_4, FIRING_ORDERS, PITCH, buildStatic, engineLayout, firingFromOrder } from './engine.geometry'
import { firingOrder } from './Engine'

const allParts = (g: ReturnType<typeof buildStatic>) =>
  (Object.entries(g).flatMap(([k, v]) => ('isBufferGeometry' in (v as object) ? [[k, v]] : Object.entries(v as object).map(([kk, vv]) => [`${k}.${kk}`, vv]))) as [string, unknown][]).filter((e): e is [string, THREE.BufferGeometry] => typeof e[1] === 'object')

const lengthZ = (geo: THREE.BufferGeometry) => {
  geo.computeBoundingBox()
  return geo.boundingBox!.max.z - geo.boundingBox!.min.z
}

describe('shared engine (full detail)', () => {
  it('builds every part of the four', { timeout: 120000 }, () => {
    const t0 = performance.now()
    const g = buildStatic()
    console.log(`four-cylinder engine geometry built in ${(performance.now() - t0).toFixed(0)} ms`)
    for (const [k, geo] of allParts(g)) expect(geo.attributes.position.count, k).toBeGreaterThan(0)
    // one-piece castings span all four cylinders
    expect(lengthZ(g.block)).toBeGreaterThan(3 * PITCH + 0.1)
  })

  it.each([1, 2, 3, 6, 8])('builds a %i-cylinder engine with castings to suit', { timeout: 120000 }, (n) => {
    const firing = firingFromOrder(FIRING_ORDERS[n])
    const g = buildStatic({ firing })
    for (const [k, geo] of allParts(g)) expect(geo.attributes.position.count, k).toBeGreaterThan(0)
    const L = engineLayout(firing)
    expect(lengthZ(g.block)).toBeCloseTo(L.ll, 2)
    expect(lengthZ(g.head)).toBeCloseTo(L.lu, 2)
  })

  it('fires 1-3-4-2 with pistons 1 & 4 and 2 & 3 moving together', () => {
    // cylinder i reaches TDC when the crank has turned its firing angle
    const at = (deg: number) => FIRING_4.map((f) => pinHeight(SC, ((deg - f) * Math.PI) / 180))
    const h = at(0)
    expect(h[0]).toBeCloseTo(h[3], 9)
    expect(h[1]).toBeCloseTo(h[2], 9)
    expect(h[0]).toBeGreaterThan(h[1])
    expect(firingOrder(FIRING_4)).toEqual([1, 3, 4, 2])
    const L = engineLayout(FIRING_4)
    expect(L.cylZ[0]).toBeGreaterThan(L.cylZ[3]) // no. 1 at the front
  })

  it('turns every usual order into even firing angles and back', () => {
    for (const order of Object.values(FIRING_ORDERS)) {
      const f = firingFromOrder(order)
      expect(firingOrder(f)).toEqual(order)
      const sorted = [...f].sort((a, b) => a - b)
      sorted.forEach((x, i) => expect(x).toBeCloseTo((720 / order.length) * i, 9))
    }
  })
})
