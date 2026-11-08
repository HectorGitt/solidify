/**
 * A model's formula ("(P * a + W * L / 2) / L") written as an equation for KaTeX ("\frac{P a + W L/2}{L}"):
 * divisions as fractions, roots, powers and brackets as a textbook writes them, names with subscripts and Greek
 * letters. With `values`, each name is replaced by its number: the line with the numbers put in. Returns null if
 * the formula can't be read (the caller then shows it as written).
 */

type Node =
  | { t: 'num'; v: string }
  | { t: 'id'; v: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'fn'; name: string; args: Node[] }

const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega'])

function parse(src: string): Node | null {
  const toks = src.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|[-+*/^(),]/g)
  if (!toks || toks.join('').replace(/\s/g, '') !== src.replace(/\s/g, '')) return null
  let i = 0
  const peek = () => toks[i]
  const expr = (): Node => {
    let a = term()
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++] as '+' | '-'
      a = { t: 'bin', op, a, b: term() }
    }
    return a
  }
  const term = (): Node => {
    let a = power()
    while (peek() === '*' || peek() === '/') {
      const op = toks[i++] as '*' | '/'
      a = { t: 'bin', op, a, b: power() }
    }
    return a
  }
  const power = (): Node => {
    const a = unary()
    if (peek() === '^') {
      i++
      return { t: 'bin', op: '^', a, b: power() }
    }
    return a
  }
  const unary = (): Node => {
    if (peek() === '-') {
      i++
      return { t: 'neg', a: unary() }
    }
    if (peek() === '+') {
      i++
      return unary()
    }
    return primary()
  }
  const primary = (): Node => {
    const k = toks[i++]
    if (k === undefined) throw new Error('end')
    if (k === '(') {
      const e = expr()
      if (toks[i++] !== ')') throw new Error(')')
      return e
    }
    if (/^[\d.]/.test(k)) return { t: 'num', v: k }
    if (/^[A-Za-z_]/.test(k)) {
      if (peek() === '(') {
        i++
        const args: Node[] = []
        if (peek() !== ')') {
          args.push(expr())
          while (peek() === ',') {
            i++
            args.push(expr())
          }
        }
        if (toks[i++] !== ')') throw new Error(')')
        return { t: 'fn', name: k, args }
      }
      return { t: 'id', v: k }
    }
    throw new Error(k)
  }
  try {
    const n = expr()
    return i === toks.length ? n : null
  } catch {
    return null
  }
}

/** a name as a symbol: R_B → R_{B}, M_max → M_{\mathrm{max}}, sigma_y → \sigma_{y}, rpm → \mathrm{rpm} */
export function nameTex(name: string): string {
  const [base, ...subs] = name.split('_')
  const b = GREEK.has(base) ? `\\${base}` : base.length > 1 ? `\\mathrm{${base}}` : base
  if (!subs.length || !subs.join('')) return b
  const sub = subs.join(',')
  const s = GREEK.has(sub) ? `\\${sub}` : sub.length > 1 && /^[a-z]+$/i.test(sub) ? `\\mathrm{${sub}}` : sub
  return `${b}_{${s}}`
}

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }

export function exprTex(formula: string, opts: { symbols?: Record<string, string>; values?: Record<string, string> } = {}): string | null {
  const root = parse(formula.trim())
  if (!root) return null
  const { symbols = {}, values } = opts
  const prec = (n: Node) => (n.t === 'bin' ? PREC[n.op] : n.t === 'neg' ? 1.5 : 4)
  const wrap = (n: Node, min: number) => (prec(n) < min ? `\\left(${tex(n)}\\right)` : tex(n))
  const startsWithNumber = (s: string) => /^[\d.]/.test(s)
  const tex = (n: Node): string => {
    switch (n.t) {
      case 'num':
        return n.v.replace(/e([+-]?\d+)/, '\\times 10^{$1}')
      case 'id':
        if (n.v === 'pi' || n.v === 'PI') return '\\pi'
        if (values && values[n.v] !== undefined) return values[n.v]
        // a symbol already written in LaTeX ("\beta_{rad}") is used as it is
        if (symbols[n.v]) return /[\\{}]/.test(symbols[n.v]) ? symbols[n.v] : nameTex(symbols[n.v])
        return nameTex(n.v)
      case 'neg':
        return `-${wrap(n.a, 2)}`
      case 'bin': {
        if (n.op === '/') return `\\frac{${tex(n.a)}}{${tex(n.b)}}`
        if (n.op === '^') return `${n.a.t === 'id' || n.a.t === 'num' ? tex(n.a) : `\\left(${tex(n.a)}\\right)`}^{${tex(n.b)}}`
        if (n.op === '*') {
          const a = wrap(n.a, 2)
          const b = wrap(n.b, 2)
          // numbers side by side need a times sign; letters can sit together
          return values || startsWithNumber(b) || /\d$/.test(a) ? `${a} \\times ${b}` : `${a}\\,${b}`
        }
        const b = n.op === '-' ? wrap(n.b, 2) : tex(n.b)
        return `${tex(n.a)} ${n.op} ${b}`
      }
      case 'fn': {
        const [x, y] = n.args.map(tex)
        const paren = (s: string) => `\\left(${s}\\right)`
        switch (n.name) {
          case 'sqrt':
            return `\\sqrt{${x}}`
          case 'abs':
            return `\\left|${x}\\right|`
          case 'sin':
          case 'cos':
          case 'tan':
          case 'sinh':
          case 'cosh':
          case 'tanh':
          case 'exp':
          case 'ln':
            return `\\${n.name}${paren(x)}`
          case 'log':
            return `\\ln${paren(x)}`
          case 'log10':
            return `\\log_{10}${paren(x)}`
          case 'asin':
            return `\\sin^{-1}${paren(x)}`
          case 'acos':
            return `\\cos^{-1}${paren(x)}`
          case 'atan':
            return `\\tan^{-1}${paren(x)}`
          case 'atan2':
            return `\\tan^{-1}${paren(`\\frac{${x}}{${y}}`)}`
          case 'pow':
            return `${n.args[0].t === 'id' || n.args[0].t === 'num' ? x : paren(x)}^{${y}}`
          case 'hypot':
            return `\\sqrt{${n.args.map((a) => `${a.t === 'id' || a.t === 'num' ? tex(a) : paren(tex(a))}^{2}`).join(' + ')}}`
          case 'min':
          case 'max':
            return `\\${n.name}${paren(n.args.map(tex).join(',\\ '))}`
          case 'floor':
            return `\\lfloor ${x} \\rfloor`
          case 'ceil':
            return `\\lceil ${x} \\rceil`
          case 'mac':
            return `\\langle ${x} \\rangle^{${y ?? '1'}}`
          case 'step':
            return `H${paren(x)}`
          default:
            return `\\mathrm{${n.name}}${paren(n.args.map(tex).join(',\\ '))}`
        }
      }
    }
  }
  return tex(root)
}
