import { describe, expect, it } from 'vitest'
import { SLIPS } from '@/study/marking'
import { SLIP_NAMES, paperSeed } from './papers'

describe('class papers', () => {
  it('gives each student stable, different numbers', () => {
    expect(paperSeed('ada', 'p1', 'q1')).toBe(paperSeed('ada', 'p1', 'q1'))
    const seeds = new Set(['ada', 'ben', 'cy', 'dee', 'eve'].map((u) => paperSeed(u, 'p1', 'q1')))
    expect(seeds.size).toBe(5)
    expect(paperSeed('ada', 'p1', 'q1')).not.toBe(paperSeed('ada', 'p2', 'q1'))
    for (const u of ['a', 'b', 'c']) expect(paperSeed(u, 'p', 'q')).toBeGreaterThan(0)
  })
  it('names every mistake the marker can report', () => {
    for (const s of SLIPS) expect(SLIP_NAMES[s.id], s.id).not.toBe(s.id)
    for (const k of ['sign', 'swap', 'rounding', 'carried']) expect(SLIP_NAMES[k]).toBeTruthy()
  })
})
