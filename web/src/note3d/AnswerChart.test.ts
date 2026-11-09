import { describe, expect, it } from 'vitest'
import { parseBlocks } from '@/ui/RichText'
import { readAnswerChart } from './AnswerChart'
import { evaluateChart } from './schema'

describe('charts in written answers', () => {
  it('a ```chart block becomes a chart in the answer, between its paragraphs', () => {
    const text = 'The cost falls as output rises:\n\n```chart\n{"title":"Average cost","x":{"label":"Output","unit":"units","from":1,"to":50},"y":{"label":"Cost","unit":"N"},"series":[{"label":"AC","formula":"200 / x + 4"}]}\n```\n\nSo produce more.'
    const blocks = parseBlocks(text)
    expect(blocks.map((b) => b.t)).toEqual(['p', 'chart', 'p'])
  })
  it('reads a curve from a formula in x, and draws it', () => {
    const c = readAnswerChart('{"title":"y","x":{"label":"x","from":0,"to":5},"y":{"label":"y"},"series":[{"label":"y","formula":"3 * x ^ 2 - 2 * x"}]}')!
    expect(c.kind).toBe('curve')
    const ev = evaluateChart((c as Extract<typeof c, { kind: 'curve' }>).chart, {})!
    expect(ev.series[0].ys.at(-1)).toBeCloseTo(65, 6)
  })
  it('reads a bar chart from data, and refuses data that does not fit its categories', () => {
    const ok = readAnswerChart('{"type":"bar","title":"Cost per route","x":{"label":"Route"},"y":{"label":"Cost","unit":"N"},"categories":["P1-M1","P1-M2","P2-M1"],"series":[{"label":"Cost","values":[120,80,95]}]}')!
    expect(ok.kind).toBe('bar')
    expect(readAnswerChart('{"type":"bar","categories":["a","b"],"series":[{"values":[1]}]}')).toBeNull()
  })
  it('a chart still being written, or broken JSON, is not drawn', () => {
    expect(parseBlocks('```chart\n{"title":').some((b) => b.t === 'chart')).toBe(false)
    expect(readAnswerChart('{not json')).toBeNull()
    expect(readAnswerChart('{"series":[]}')).toBeNull()
  })
})
