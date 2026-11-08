import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { exprTex, nameTex } from './exprTex'

const renders = (tex: string) => katex.renderToString(tex, { throwOnError: true })

describe('formulas written as equations', () => {
  it('divisions as fractions, letters side by side, brackets where needed', () => {
    expect(exprTex('(P * a + W * L / 2) / L')).toBe('\\frac{P\\,a + \\frac{W\\,L}{2}}{L}')
    expect(exprTex('P + W - R_B')).toBe('P + W - R_{B}')
    expect(exprTex('a - (b + c)')).toBe('a - \\left(b + c\\right)')
    expect(exprTex('(a + b) * c')).toBe('\\left(a + b\\right)\\,c')
    expect(exprTex('w * a ^ 2 / 2')).toBe('\\frac{w\\,a^{2}}{2}')
    expect(exprTex('2 * pi * N / 60')).toBe('\\frac{2 \\times \\pi\\,N}{60}')
  })
  it('roots, inverse trig, Macaulay brackets and Greek names', () => {
    expect(exprTex('sqrt(l ^ 2 - r ^ 2)')).toBe('\\sqrt{l^{2} - r^{2}}')
    expect(exprTex('asin(r / c)')).toBe('\\sin^{-1}\\left(\\frac{r}{c}\\right)')
    expect(exprTex('mac(x - a, 1)')).toBe('\\langle x - a \\rangle^{1}')
    expect(exprTex('sigma_y / FoS')).toBe('\\frac{\\sigma_{y}}{\\mathrm{FoS}}')
    expect(nameTex('M_max')).toBe('M_{\\mathrm{max}}')
  })
  it('with the numbers put in', () => {
    expect(exprTex('(P * a + W * L / 2) / L', { values: { P: '20', a: '2', W: '30', L: '6' } })).toBe('\\frac{20 \\times 2 + \\frac{30 \\times 6}{2}}{6}')
  })
  it('uses the symbol a calculation is known by', () => {
    expect(exprTex('M_max / Z', { symbols: { M_max: 'M_max', Z: 'Z' } })).toBe('\\frac{M_{\\mathrm{max}}}{Z}')
  })
  it('everything it writes is valid for KaTeX; what it cannot read gives null', () => {
    for (const f of ['(P * a + W * L / 2) / L', 'atan2(y, x) * 180 / pi', 'hypot(a, b + c)', 'pow(a + b, 3)', '-x ^ 2', 'floor(n / 2) + ceil(m)', 'log10(p) - ln(q)', '1.5e3 * x'])
      expect(() => renders(exprTex(f)!), f).not.toThrow()
    expect(exprTex('a + * b')).toBeNull()
    expect(exprTex('(a + b')).toBeNull()
    expect(exprTex('a % b')).toBeNull()
  })
})
