import { describe, expect, it } from 'vitest'
import { decodeTyreSize } from '@/physics/tyres'
import { buildTyre } from './build'

describe('tyre cutaway geometry', () => {
  for (const build of ['bias', 'belted', 'radial'] as const)
    for (const tread of ['R1', 'R2', 'R3', 'F2'] as const)
      it(`${build} / ${tread} builds with the right layers`, () => {
        // build twice and judge the faster run: the first pays one-off warm-up, and a busy
        // machine (the whole suite runs in parallel) can stall any single run
        let ms = Infinity
        let g = buildTyre(decodeTyreSize('18.4-38')!, build, tread, true)
        for (let run = 0; run < 2; run++) {
          const t0 = performance.now()
          g = buildTyre(decodeTyreSize('18.4-38')!, build, tread, true)
          ms = Math.min(ms, performance.now() - t0)
        }
        expect(ms).toBeLessThan(1500)
        const plies = g.layers.filter((l) => l.kind === 'ply').length
        const belts = g.layers.filter((l) => l.kind === 'belt').length
        expect(plies).toBe({ bias: 4, belted: 2, radial: 1 }[build])
        expect(belts).toBe({ bias: 0, belted: 2, radial: 4 }[build])
        for (const l of g.layers) expect(l.geo.attributes.position.count).toBeGreaterThan(0)
        expect(g.layers.filter((l) => l.cords && l.cords.attributes.position.count > 0).length).toBe(plies + belts)
        expect(g.lugs).not.toBeNull()
        let tris = 0
        for (const l of g.layers) tris += l.geo.attributes.position.count / 3 + (l.cords ? l.cords.attributes.position.count / 3 : 0)
        tris += (g.lugs?.attributes.position.count ?? 0) / 3
        if (build === "radial" && tread === "R1") console.log(`tyre: ${Math.round(tris)} tris, ${ms.toFixed(0)} ms`)
        expect(tris).toBeLessThan(150_000)
      })
  it('geometry follows the size code (710/70R38 is ≈ 1.96 m tall)', () => {
    const g = buildTyre(decodeTyreSize('710/70R38')!, 'radial', 'R1', false)
    expect(2 * g.R).toBeCloseTo(1.9592, 3)
    expect(g.layers.every((l) => l.cords === undefined)).toBe(true)
  })
})

describe('inflation deformation', () => {
  it('flattens the tread onto the ground plane z = R − δ and leaves the top alone', async () => {
    const { deformTyre } = await import('./deform')
    const g = buildTyre(decodeTyreSize('18.4-38')!, 'bias', 'R3', false)
    const delta = 0.05
    const d = deformTyre(g.layers[0].geo, { R: g.R, r0: g.rimR, hw: g.hw, delta, halfLen: 0.3, state: 'correct' })
    const p = d.getAttribute('position')
    let zMax = -Infinity
    let zMin = Infinity
    for (let i = 0; i < p.count; i++) {
      zMax = Math.max(zMax, p.getZ(i))
      zMin = Math.min(zMin, p.getZ(i))
    }
    expect(zMax).toBeLessThanOrEqual(g.R - g.lugH - 0.9 * delta)
    expect(zMin).toBeLessThan(-(g.R - g.lugH) + 0.01)
  })
})
