import { describe, expect, it } from 'vitest'
import { crankshaft } from './crank'
import { CRANK, buildStatic } from './geometry'
import { DIM, LAYOUTS, cylZ } from './model'

describe('multi-cylinder geometry', () => {
  it('builds the castings for every cylinder count', () => {
    const t0 = performance.now()
    const g = buildStatic()
    console.log(`multi-cylinder castings built in ${(performance.now() - t0).toFixed(0)} ms`)
    for (const n of ['2', '3', '4', '6', '8']) for (const [k, geo] of Object.entries(g.byCount[n])) expect(geo.attributes.position.count, `${n}/${k}`).toBeGreaterThan(0)
  })
  it('builds a crankshaft for every layout', () => {
    for (const [n, list] of Object.entries(LAYOUTS))
      for (const l of list) {
        const c = crankshaft(CRANK, l.firing.map((f, i) => ({ z: cylZ(i + 1, Number(n)), firingDeg: f })), DIM.pitch)
        expect(c.geometry.attributes.position.count).toBeGreaterThan(0)
      }
  })
})
