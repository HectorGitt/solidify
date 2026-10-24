import { describe, expect, it } from 'vitest'
import { parseBlocks, parseInline } from './RichText'

describe('RichText parsing', () => {
  it('splits inline maths, bold, italic and code', () => {
    expect(parseInline('at $\\beta = 30^\\circ$ the **minimum** is *small* in `rpm`')).toEqual([
      { t: 'text', v: 'at ' },
      { t: 'math', v: '\\beta = 30^\\circ', display: false },
      { t: 'text', v: ' the ' },
      { t: 'bold', v: [{ t: 'text', v: 'minimum' }] },
      { t: 'text', v: ' is ' },
      { t: 'em', v: [{ t: 'text', v: 'small' }] },
      { t: 'text', v: ' in ' },
      { t: 'code', v: 'rpm' },
    ])
  })

  it('keeps maths inside bold', () => {
    expect(parseInline('**$0.866\\,\\omega_1$**')).toEqual([{ t: 'bold', v: [{ t: 'math', v: '0.866\\,\\omega_1', display: false }] }])
  })

  it('leaves unclosed markers as text while a reply is still streaming', () => {
    expect(parseInline('ratio $\\frac{1}{\\cos')).toEqual([{ t: 'text', v: 'ratio $\\frac{1}{\\cos' }])
    expect(parseInline('the **max')).toEqual([{ t: 'text', v: 'the **max' }])
  })

  it('does not read currency or snake_case as markup', () => {
    expect(parseInline('costs $ 5 and $ 6')).toEqual([{ t: 'text', v: 'costs $ 5 and $ 6' }])
    expect(parseInline('a pto_shaft_angle value')).toEqual([{ t: 'text', v: 'a pto_shaft_angle value' }])
  })

  it('builds paragraphs, display maths, and lists with display maths inside items', () => {
    const text = [
      'In a Hooke’s joint the ratio varies.',
      '',
      '$$\\frac{\\omega_2}{\\omega_1} = \\frac{\\cos\\beta}{1 - \\sin^2\\beta\\cos^2\\theta}$$',
      '',
      '* **Minimum** when the yoke is perpendicular:',
      '  $$\\cos\\beta \\approx 0.866$$',
      '* **Maximum** in the bend plane.',
      '',
      '1. First',
      '2. Second',
    ].join('\n')
    const b = parseBlocks(text)
    expect(b.map((x) => x.t)).toEqual(['p', 'math', 'ul', 'ol'])
    const ul = b[2] as { t: 'ul'; items: unknown[][] }
    expect(ul.items).toHaveLength(2)
    expect(JSON.stringify(ul.items[0])).toContain('"display":true')
  })

  it('collects multi-line display maths and shows an unclosed block as text', () => {
    expect(parseBlocks('$$\na = b\n+ c\n$$')).toEqual([{ t: 'math', v: 'a = b\n+ c' }])
    expect(parseBlocks('$$\na = b')[0].t).toBe('p')
  })
})
