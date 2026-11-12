// A symbol as a model writes it (LaTeX-like: "T_1", "F_{max}", "\omega_2") turned into plain text for a label on
// the model: subscripts in Unicode where every character has one, Greek letters by name, braces and backslashes gone.

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
}

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', psi: 'ψ',
  omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Phi: 'Φ', Theta: 'Θ',
}

function sub(s: string) {
  const chars = [...s]
  // all or nothing: a half-lowered subscript reads worse than a plain one
  return chars.every((c) => SUB[c]) ? chars.map((c) => SUB[c]).join('') : chars.length ? `_${s}` : ''
}

export function symbolText(raw: string): string {
  let s = raw.replace(/\\([A-Za-z]+)/g, (_m, name: string) => GREEK[name] ?? name)
  s = s.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_m, braced: string | undefined, one: string | undefined) => sub(braced ?? one ?? ''))
  return s.replace(/[{}]/g, '').replace(/\\/g, '')
}
