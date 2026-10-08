import { describe, expect, it } from 'vitest'
import { RECOMMENDED_SAG } from '@/physics/tyres'
import { CHAIN, DIM, trackPath, trackState } from './model'
import { idlerGeometry, linkGeometry, rollerGeometry, shoeGeometry, sprocketGeometry } from './trackParts'

describe('crawler track path', () => {
  it('the chain closes: path length = links × pitch, at any adjustment', () => {
    for (const a of [-30, -10, 0, 2]) {
      const p = trackPath(trackState(a))
      expect(p.length).toBeCloseTo(CHAIN.links * DIM.pitch, 6)
    }
  })
  it('the setting gives about 1 in of sag between carrier roller and front idler (TT p52)', () => {
    const t = trackState(0)
    expect(t.sag2).toBeCloseTo(RECOMMENDED_SAG, 4)
    expect(t.state).toBe('correct')
  })
  it('grease in → too tight (spring takes the excess); grease out → too loose', () => {
    const tight = trackState(6)
    expect(tight.state).toBe('too tight')
    expect(tight.springComp).toBeGreaterThan(0)
    const loose = trackState(-25)
    expect(loose.state).toBe('too loose')
    expect(loose.sag2).toBeGreaterThan(trackState(-5).sag2)
  })
  it('the path is continuous (no jumps between segments)', () => {
    const p = trackPath(trackState(-10))
    const a = { x: 0, y: 0 }
    const b = { x: 0, y: 0 }
    const ds = 0.005
    for (let s = 0; s < p.length; s += ds) {
      p.at(s, a)
      p.at(s + ds, b)
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(2 * ds)
    }
  })
})

describe('undercarriage parts build', () => {
  it('links, sprocket, idler, rollers and every shoe type have geometry', () => {
    for (const g of [linkGeometry(), sprocketGeometry(), idlerGeometry(), rollerGeometry(0.09)]) expect(g.attributes.position.count).toBeGreaterThan(0)
    for (const s of ['standard', 'open', 'snow', 'multi', 'rubber'] as const) expect(shoeGeometry(s).attributes.position.count).toBeGreaterThan(0)
  })
})
