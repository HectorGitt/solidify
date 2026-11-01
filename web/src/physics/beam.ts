/**
 * Straight beams: reactions, shear force, bending moment and deflection along the span, and the
 * stresses across a section. SI throughout: m, N, Pa. Loads act downward; sagging moment is positive;
 * deflection is positive upward.
 */
export type BeamLoad = { kind: 'point'; x: number; P: number } | { kind: 'udl'; x0: number; x1: number; w: number }

export type BeamSupport =
  /** a pin at a and a roller at b; the ends may overhang */
  | { kind: 'simple'; a: number; b: number }
  /** built in at x = 0 */
  | { kind: 'cantilever' }

export interface Beam {
  L: number
  support: BeamSupport
  loads: BeamLoad[]
}

export interface Reactions {
  /** at a (or at the wall), upward */
  Ra: number
  /** at b, upward (zero for a cantilever) */
  Rb: number
  /** the wall's moment on a cantilever */
  Ma: number
}

const clampTo = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
/** total downward load left of x, and its moment about x */
function loadsLeftOf(loads: BeamLoad[], x: number) {
  let F = 0
  let M = 0
  for (const l of loads) {
    if (l.kind === 'point') {
      if (l.x < x) {
        F += l.P
        M += l.P * (x - l.x)
      }
    } else {
      const hi = clampTo(x, l.x0, l.x1)
      const f = l.w * (hi - l.x0)
      F += f
      M += f * (x - (l.x0 + hi) / 2)
    }
  }
  return { F, M }
}

/** Sum of vertical forces and of moments. */
export function reactions(b: Beam): Reactions {
  const all = loadsLeftOf(b.loads, b.L + 1)
  // moment of all the load about x = 0
  const total = all.F
  const about0 = total * (b.L + 1) - all.M
  if (b.support.kind === 'cantilever') return { Ra: total, Rb: 0, Ma: about0 }
  const { a, b: bb } = b.support
  const Rb = (about0 - total * a) / (bb - a)
  return { Ra: total - Rb, Rb, Ma: 0 }
}

/** Shear force just right of x: up on the left of the cut is positive. */
export function shear(b: Beam, x: number, r = reactions(b)) {
  const { F } = loadsLeftOf(b.loads, x + 1e-9)
  if (b.support.kind === 'cantilever') return r.Ra - F
  return (x + 1e-9 > b.support.a ? r.Ra : 0) + (x + 1e-9 > b.support.b ? r.Rb : 0) - F
}

/** Bending moment at x: sagging positive. */
export function moment(b: Beam, x: number, r = reactions(b)) {
  const { M } = loadsLeftOf(b.loads, x)
  if (b.support.kind === 'cantilever') return r.Ra * x - r.Ma - M
  return (x > b.support.a ? r.Ra * (x - b.support.a) : 0) + (x > b.support.b ? r.Rb * (x - b.support.b) : 0) - M
}

export interface BeamCurves {
  x: number[]
  V: number[]
  M: number[]
  /** deflection, up positive */
  y: number[]
}

/** V, M and deflection at n + 1 points. EI in N·m². Deflection: integrates EI y″ = M with the supports at zero. */
export function curves(b: Beam, EI: number, n = 400): BeamCurves {
  const r = reactions(b)
  const h = b.L / n
  const x: number[] = []
  const V: number[] = []
  const M: number[] = []
  for (let i = 0; i <= n; i++) {
    const xi = (b.L * i) / n
    x.push(xi)
    V.push(shear(b, xi, r))
    M.push(moment(b, xi, r))
  }
  // slope and deflection by the trapezium rule, from a built-in end with zero slope and deflection
  const raw: number[] = [0]
  let slope = 0
  for (let i = 1; i <= n; i++) {
    const s0 = slope
    slope += ((M[i - 1] + M[i]) / 2 / EI) * h
    raw.push(raw[i - 1] + ((s0 + slope) / 2) * h)
  }
  if (b.support.kind === 'cantilever') return { x, V, M, y: raw }
  // a straight line takes the deflection to zero at both supports
  const { a, b: bb } = b.support
  const at = (q: number) => {
    const f = clampTo(q / h, 0, n)
    const i = Math.min(n - 1, Math.floor(f))
    return raw[i] + (raw[i + 1] - raw[i]) * (f - i)
  }
  const ya = at(a)
  const k = (at(bb) - ya) / (bb - a)
  return { x, V, M, y: raw.map((v, i) => v - ya - k * (x[i] - a)) }
}

/** Where the moment and shear are largest, from sampled curves. */
export function extremes(c: BeamCurves) {
  const peak = (arr: number[]) => arr.reduce((best, v, i) => (Math.abs(v) > Math.abs(arr[best]) ? i : best), 0)
  const iM = peak(c.M)
  const iV = peak(c.V)
  const iY = peak(c.y)
  return { Mmax: c.M[iM], xM: c.x[iM], Vmax: c.V[iV], xV: c.x[iV], ymax: c.y[iY], xY: c.x[iY] }
}

/* ------------------------------------------------------------------ sections */

/** A section as stacked rectangles, bottom first: width b, height h. */
export type Section = { b: number; h: number }[]

export const rect = (b: number, h: number): Section => [{ b, h }]
/** flange on top */
export const tee = (bf: number, tf: number, hw: number, tw: number): Section => [
  { b: tw, h: hw },
  { b: bf, h: tf },
]
export const eye = (bf: number, tf: number, hw: number, tw: number): Section => [
  { b: bf, h: tf },
  { b: tw, h: hw },
  { b: bf, h: tf },
]

export interface SectionProps {
  A: number
  /** neutral axis above the bottom */
  ybar: number
  /** second moment of area about the neutral axis */
  I: number
  depth: number
  /** to the extreme fibres */
  yTop: number
  yBottom: number
}

export function sectionProps(s: Section): SectionProps {
  let A = 0
  let Ay = 0
  let z = 0
  for (const r of s) {
    A += r.b * r.h
    Ay += r.b * r.h * (z + r.h / 2)
    z += r.h
  }
  const ybar = Ay / A
  let I = 0
  z = 0
  for (const r of s) {
    I += (r.b * r.h ** 3) / 12 + r.b * r.h * (z + r.h / 2 - ybar) ** 2
    z += r.h
  }
  return { A, ybar, I, depth: z, yTop: z - ybar, yBottom: ybar }
}

/** Width at height z above the bottom. */
export function widthAt(s: Section, z: number) {
  let top = 0
  for (const r of s) {
    top += r.h
    if (z <= top + 1e-12) return r.b
  }
  return s[s.length - 1].b
}

/** First moment of the area above height z, about the neutral axis. */
export function firstMoment(s: Section, z: number, p = sectionProps(s)) {
  let Q = 0
  let bottom = 0
  for (const r of s) {
    const top = bottom + r.h
    const lo = Math.max(bottom, z)
    if (top > lo) Q += r.b * (top - lo) * ((top + lo) / 2 - p.ybar)
    bottom = top
  }
  return Q
}

/** Bending stress σ = M y / I at height z. Sagging compresses the top: tension is positive. */
export const bendingStress = (M: number, z: number, p: SectionProps) => (-M * (z - p.ybar)) / p.I

/** Shear stress τ = V Q / (I b) at height z. */
export const shearStress = (V: number, s: Section, z: number, p = sectionProps(s)) => (V * firstMoment(s, z, p)) / (p.I * widthAt(s, z))

/** The largest shear stress is at the neutral axis, for these sections. */
export const maxShearStress = (V: number, s: Section, p = sectionProps(s)) => shearStress(V, s, p.ybar, p)
