/**
 * The planar four-bar linkage. A and D are the fixed pivots, A at the origin and D on +x;
 * link lengths: frame AD, crank AB, coupler BC, rocker (output lever) DC. Angles in radians.
 */
export interface FourBar {
  frame: number
  crank: number
  coupler: number
  rocker: number
}

export type LinkageKind = 'crank-rocker' | 'double-crank' | 'double-rocker' | 'change-point' | 'impossible'

export interface Classification {
  kind: LinkageKind
  /** shortest + longest */
  sumSL: number
  /** the other two */
  sumPQ: number
  /** S + L ≤ P + Q: at least one link can turn fully relative to the others */
  grashof: boolean
  shortest: keyof FourBar
}

const NAMES: (keyof FourBar)[] = ['frame', 'crank', 'coupler', 'rocker']
const EPS = 1e-9

/** Grashof's law, and which mechanism this assembly gives. */
export function classify(l: FourBar): Classification {
  const v = NAMES.map((k) => l[k])
  const sorted = [...v].sort((a, b) => a - b)
  const sumSL = sorted[0] + sorted[3]
  const sumPQ = sorted[1] + sorted[2]
  const shortest = NAMES[v.indexOf(sorted[0])]
  const base = { sumSL, sumPQ, shortest }
  // no link may be as long as the other three together
  if (sorted[3] >= sorted[0] + sorted[1] + sorted[2] - EPS) return { kind: 'impossible', grashof: false, ...base }
  if (sumSL > sumPQ + EPS) return { kind: 'double-rocker', grashof: false, ...base }
  if (Math.abs(sumSL - sumPQ) <= EPS) return { kind: 'change-point', grashof: true, ...base }
  if (shortest === 'frame') return { kind: 'double-crank', grashof: true, ...base }
  if (shortest === 'coupler') return { kind: 'double-rocker', grashof: true, ...base }
  return { kind: 'crank-rocker', grashof: true, ...base }
}

/** The crank's working range: [lo, hi] about +x, or null when it turns fully. */
export function crankRange(l: FourBar): { lo: number; hi: number } | null {
  const { frame: d, crank: b, coupler: c, rocker: e } = l
  const cosAt = (s: number) => (d * d + b * b - s * s) / (2 * d * b)
  // the diagonal BD must stay between |c − e| and c + e
  const cosLo = cosAt(c + e)
  const cosHi = cosAt(Math.abs(c - e))
  if (cosLo <= -1 + EPS && cosHi >= 1 - EPS) return null
  const lo = cosHi >= 1 ? 0 : Math.acos(cosHi)
  const hi = cosLo <= -1 ? Math.PI : Math.acos(cosLo)
  // the working arc is symmetric about the frame line: it passes through 0, or through 180°, or neither
  if (lo === 0) return { lo: -hi, hi }
  if (hi === Math.PI) return { lo, hi: 2 * Math.PI - lo }
  return { lo, hi }
}

export interface Pose {
  /** crank pin */
  B: [number, number]
  /** coupler–rocker pin */
  C: [number, number]
  /** direction of A→B */
  theta2: number
  /** direction of B→C */
  theta3: number
  /** direction of D→C */
  theta4: number
  /** transmission angle: between the coupler and the rocker, 0…180° */
  gamma: number
  /** between the crank and the coupler, 0…180° */
  beta: number
  /** ω₄/ω₂ */
  velocityRatio: number
  /** output torque over input torque, −ω₂/ω₄ */
  mechanicalAdvantage: number
}

/** The assembly at crank angle theta2 (open branch: C on the +y side of BD), or null if it will not close. */
export function solve(l: FourBar, theta2: number, branch: 1 | -1 = 1): Pose | null {
  const { frame: d, crank: b, coupler: c, rocker: e } = l
  const B: [number, number] = [b * Math.cos(theta2), b * Math.sin(theta2)]
  const dx = d - B[0]
  const dy = -B[1]
  const s = Math.hypot(dx, dy)
  if (s < EPS || s > c + e + EPS || s < Math.abs(c - e) - EPS) return null
  const a = (c * c - e * e + s * s) / (2 * s)
  const h = Math.sqrt(Math.max(0, c * c - a * a))
  const ux = dx / s
  const uy = dy / s
  // to the left of B→D: above the frame, since D lies on +x
  const C: [number, number] = [B[0] + a * ux - branch * h * uy, B[1] + a * uy + branch * h * ux]
  const theta3 = Math.atan2(C[1] - B[1], C[0] - B[0])
  const theta4 = Math.atan2(C[1], C[0] - d)
  const gamma = Math.acos(clamp((c * c + e * e - s * s) / (2 * c * e)))
  const beta = Math.acos(clamp(-(Math.cos(theta2) * Math.cos(theta3) + Math.sin(theta2) * Math.sin(theta3))))
  // differentiate the loop closure: b e^{iθ₂} + c e^{iθ₃} = d + e e^{iθ₄}
  const velocityRatio = (b * Math.sin(theta3 - theta2)) / (e * Math.sin(theta3 - theta4))
  return { B, C, theta2, theta3, theta4, gamma, beta, velocityRatio, mechanicalAdvantage: -1 / velocityRatio }
}

const clamp = (x: number) => Math.max(-1, Math.min(1, x))

/** cos rule on the triangle coupler–rocker–diagonal: γ when the diagonal BD has length s. */
export const gammaAt = (l: FourBar, s: number) => Math.acos(clamp((l.coupler ** 2 + l.rocker ** 2 - s ** 2) / (2 * l.coupler * l.rocker)))

/**
 * For a crank that turns fully: γ runs between its extremes when the crank lies on the frame line,
 * diagonal d − r (least) and d + r (most).
 */
export function transmissionLimits(l: FourBar) {
  return { min: gammaAt(l, Math.abs(l.frame - l.crank)), max: gammaAt(l, l.frame + l.crank) }
}

/** The rocker's swing of a crank-rocker: the angle between its two dead-centre positions. */
export function rockerSwing(l: FourBar) {
  const { frame: d, crank: r, coupler: c, rocker: e } = l
  const at = (reach: number) => Math.acos(clamp((d * d + e * e - reach * reach) / (2 * d * e)))
  // crank and coupler stretched out in line, then folded back in line
  return Math.abs(at(c + r) - at(c - r))
}

/** Sampled over the crank's range: for the charts. Angles in degrees. */
export function sweep(l: FourBar, n = 181) {
  const range = crankRange(l)
  const lo = range ? range.lo : 0
  const hi = range ? range.hi : 2 * Math.PI
  const out: { theta2: number; theta4: number; gamma: number }[] = []
  for (let i = 0; i < n; i++) {
    const t = lo + ((hi - lo) * i) / (n - 1)
    const p = solve(l, t)
    if (p) out.push({ theta2: (t * 180) / Math.PI, theta4: (p.theta4 * 180) / Math.PI, gamma: (p.gamma * 180) / Math.PI })
  }
  return out
}
