/**
 * Strength of materials, beyond beams (see beam.ts): direct stress, thermal stress, composite bars,
 * torsion, buckling, plane stress and strain, pressure vessels, yield, fatigue, fracture and creep.
 * SI throughout: N, m, Pa, K differences.
 */
const PI = Math.PI

/* ------------------------------------------------------------------ direct stress */
export const directStress = (P: number, A: number) => P / A
export const directStrain = (sigma: number, E: number) => sigma / E
export const extension = (P: number, L: number, A: number, E: number) => (P * L) / (A * E)
export const circleArea = (d: number) => (PI * d * d) / 4
export const tubeArea = (D: number, d: number) => (PI * (D * D - d * d)) / 4

/* ------------------------------------------------------------------ stress–strain */
export interface TestMaterial {
  id: string
  name: string
  /** Young's modulus */
  E: number
  /** yield or proof stress */
  yield: number
  /** ultimate stress */
  uts: number
  /** strain at the ultimate stress */
  eU: number
  /** strain at fracture */
  eF: number
  /** stress at fracture, as engineering stress */
  fracture: number
  /** a yield plateau, as a strain */
  plateau: number
  ductile: boolean
}

/** typical values, for the test */
export const TEST_MATERIALS: TestMaterial[] = [
  { id: 'mild', name: 'Mild steel', E: 200e9, yield: 250e6, uts: 420e6, eU: 0.2, eF: 0.32, fracture: 300e6, plateau: 0.02, ductile: true },
  { id: 'alu', name: 'Aluminium alloy', E: 70e9, yield: 150e6, uts: 230e6, eU: 0.1, eF: 0.17, fracture: 190e6, plateau: 0, ductile: true },
  { id: 'brass', name: 'Brass', E: 100e9, yield: 130e6, uts: 340e6, eU: 0.3, eF: 0.45, fracture: 270e6, plateau: 0, ductile: true },
  { id: 'cast', name: 'Cast iron', E: 100e9, yield: 150e6, uts: 200e6, eU: 0.006, eF: 0.006, fracture: 200e6, plateau: 0, ductile: false },
  { id: 'concrete', name: 'Concrete (in tension)', E: 30e9, yield: 2.5e6, uts: 3e6, eU: 0.00012, eF: 0.00012, fracture: 3e6, plateau: 0, ductile: false },
]

/** Engineering stress at strain e, along a representative curve for the material. */
export function stressAt(m: TestMaterial, e: number) {
  const eY = m.yield / m.E
  if (e <= 0) return 0
  if (e > m.eF) return 0
  if (e <= eY) return m.E * e
  if (!m.ductile) {
    // no plateau, the curve simply bends over until it breaks
    const u = (e - eY) / (m.eF - eY)
    return m.yield + (m.uts - m.yield) * (1 - (1 - u) ** 2)
  }
  const e1 = eY + m.plateau
  if (e <= e1) return m.yield
  if (e <= m.eU) {
    const u = (e - e1) / (m.eU - e1)
    return m.yield + (m.uts - m.yield) * (1 - (1 - u) ** 2)
  }
  // necking: the engineering stress falls away to fracture
  const u = (e - m.eU) / (m.eF - m.eU)
  return m.uts + (m.fracture - m.uts) * u * u
}

export const percentElongation = (L0: number, Lf: number) => (100 * (Lf - L0)) / L0
export const percentReduction = (A0: number, Af: number) => (100 * (A0 - Af)) / A0
/** the energy absorbed per unit volume: the area under the curve */
export function toughness(m: TestMaterial, n = 2000) {
  let s = 0
  for (let i = 0; i < n; i++) s += (stressAt(m, (m.eF * (i + 0.5)) / n) * m.eF) / n
  return s
}

/* ------------------------------------------------------------------ elastic constants */
export const shearModulus = (E: number, nu: number) => E / (2 * (1 + nu))
export const bulkModulus = (E: number, nu: number) => E / (3 * (1 - 2 * nu))

/* ------------------------------------------------------------------ thermal */
export const thermalChange = (alpha: number, L: number, dT: number) => alpha * L * dT
/** the stress in a bar fully held at its ends: tension positive, for a rise dT */
export const thermalStress = (E: number, alpha: number, dT: number) => -E * alpha * dT

export interface RailGap {
  alpha: number
  L: number
  gap: number
  T0: number
  E: number
}
/** the temperature at which the ends meet */
export const railsTouchAt = (r: RailGap) => r.T0 + r.gap / (r.alpha * r.L)
/** the gap at temperature T, or 0 once touching */
export const railGapAt = (r: RailGap, T: number) => Math.max(0, r.gap - r.alpha * r.L * (T - r.T0))
/** the compressive stress at temperature T: zero until they touch */
export const railStressAt = (r: RailGap, T: number) => r.E * r.alpha * Math.max(0, T - railsTouchAt(r))

/* ------------------------------------------------------------------ composite bars */
export interface Composite {
  A1: number
  E1: number
  A2: number
  E2: number
}
/** a bar of two materials between rigid plates: the same extension, and the load shared by stiffness */
export function compositeBar(c: Composite, P: number, L: number) {
  const stiff = c.A1 * c.E1 + c.A2 * c.E2
  const strain = P / stiff
  const s1 = c.E1 * strain
  const s2 = c.E2 * strain
  return { strain, s1, s2, P1: s1 * c.A1, P2: s2 * c.A2, delta: strain * L }
}

/* ------------------------------------------------------------------ torsion */
export const polarSolid = (d: number) => (PI * d ** 4) / 32
export const polarTube = (D: number, d: number) => (PI * (D ** 4 - d ** 4)) / 32
export const shaftStress = (T: number, r: number, J: number) => (T * r) / J
export const twist = (T: number, L: number, G: number, J: number) => (T * L) / (G * J)
export const shaftTorque = (P: number, revPerSec: number) => P / (2 * PI * revPerSec)
/** the solid shaft a stress limit allows */
export const solidShaftForStress = (T: number, tau: number) => Math.cbrt((16 * T) / (PI * tau))

/* ------------------------------------------------------------------ columns */
export const END_FACTORS = { 'pinned-pinned': 1, 'fixed-fixed': 0.5, 'fixed-pinned': 0.7, 'fixed-free': 2 } as const
export type ColumnEnds = keyof typeof END_FACTORS

export const secondMomentCircle = (d: number) => (PI * d ** 4) / 64
export const secondMomentTube = (D: number, d: number) => (PI * (D ** 4 - d ** 4)) / 64
export const eulerLoad = (E: number, I: number, L: number, ends: ColumnEnds) => (PI * PI * E * I) / (END_FACTORS[ends] * L) ** 2
/** the slenderness below which Euler overstates the strength, for a proportional limit */
export const eulerLimitSlenderness = (E: number, sigmaP: number) => PI * Math.sqrt(E / sigmaP)
/** Rankine: blends crushing and buckling */
export const rankineLoad = (sigmaC: number, A: number, a: number, slenderness: number) => (sigmaC * A) / (1 + a * slenderness ** 2)

/* ------------------------------------------------------------------ plane stress */
export interface Plane {
  sx: number
  sy: number
  txy: number
}
/** Transformation equations; θ is the plane's normal from x, anticlockwise. */
export function rotateStress(p: Plane, theta: number) {
  const m = (p.sx + p.sy) / 2
  const d = (p.sx - p.sy) / 2
  const c = Math.cos(2 * theta)
  const s = Math.sin(2 * theta)
  return { sn: m + d * c + p.txy * s, tn: -d * s + p.txy * c, st: m - d * c - p.txy * s }
}
export function principal(p: Plane) {
  const m = (p.sx + p.sy) / 2
  const R = Math.hypot((p.sx - p.sy) / 2, p.txy)
  return { s1: m + R, s2: m - R, tauMax: R, centre: m, thetaP: 0.5 * Math.atan2(2 * p.txy, p.sx - p.sy) }
}

/* ------------------------------------------------------------------ strain gauges */
/** from three gauges at angles from x, solve for εx, εy, γxy */
export function rosette(strains: [number, number, number], angles: [number, number, number]) {
  const row = (a: number) => [Math.cos(a) ** 2, Math.sin(a) ** 2, Math.sin(a) * Math.cos(a)]
  const [r1, r2, r3] = angles.map(row)
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const A = [r1, r2, r3]
  const D = det(A)
  const swap = (k: number) => A.map((r, i) => r.map((v, j) => (j === k ? strains[i] : v)))
  return { ex: det(swap(0)) / D, ey: det(swap(1)) / D, gxy: det(swap(2)) / D }
}
export function principalStrains(ex: number, ey: number, gxy: number) {
  const m = (ex + ey) / 2
  const R = Math.hypot((ex - ey) / 2, gxy / 2)
  return { e1: m + R, e2: m - R, gMax: 2 * R, thetaP: 0.5 * Math.atan2(gxy, ex - ey) }
}
/** plane stress from strain, by Hooke's law */
export function stressFromStrain(ex: number, ey: number, gxy: number, E: number, nu: number): Plane {
  const k = E / (1 - nu * nu)
  return { sx: k * (ex + nu * ey), sy: k * (ey + nu * ex), txy: (E / (2 * (1 + nu))) * gxy }
}

/* ------------------------------------------------------------------ pressure vessels */
export const hoopStress = (p: number, r: number, t: number) => (p * r) / t
export const axialStress = (p: number, r: number, t: number) => (p * r) / (2 * t)
export const sphereStress = (p: number, r: number, t: number) => (p * r) / (2 * t)
export const isThinWall = (r: number, t: number) => r / t >= 10
/** the strains in a closed thin cylinder */
export function cylinderStrains(p: number, r: number, t: number, E: number, nu: number) {
  const h = hoopStress(p, r, t)
  const a = axialStress(p, r, t)
  return { hoop: (h - nu * a) / E, axial: (a - nu * h) / E, volumetric: (2 * (h - nu * a) + (a - nu * h)) / E }
}

/* ------------------------------------------------------------------ yield criteria */
export const trescaEquivalent = (s1: number, s2: number, s3: number) => Math.max(s1, s2, s3) - Math.min(s1, s2, s3)
export const vonMisesEquivalent = (s1: number, s2: number, s3: number) => Math.sqrt(((s1 - s2) ** 2 + (s2 - s3) ** 2 + (s3 - s1) ** 2) / 2)

/* ------------------------------------------------------------------ fatigue */
export function cycleStresses(sMax: number, sMin: number) {
  const a = (sMax - sMin) / 2
  const m = (sMax + sMin) / 2
  return { amplitude: a, mean: m, range: sMax - sMin, R: sMin / sMax, A: m !== 0 ? a / m : Infinity }
}
export type MeanLine = 'goodman' | 'gerber' | 'soderberg'
/** the allowed amplitude at a mean stress */
export function allowedAmplitude(line: MeanLine, Se: number, Su: number, Sy: number, mean: number) {
  const m = Math.max(0, mean)
  if (line === 'goodman') return Se * (1 - m / Su)
  if (line === 'gerber') return Se * (1 - (m / Su) ** 2)
  return Se * (1 - m / Sy)
}
/** Basquin: S = A N^b, through (10³, 0.9 Su) and (10⁶, Se) */
export function basquinLife(S: number, Su: number, Se: number) {
  if (S <= Se) return Infinity
  const b = Math.log10(Se / (0.9 * Su)) / 3
  const a = (0.9 * Su) / 10 ** (3 * b)
  return (S / a) ** (1 / b)
}
/** the stress at life N, on the same line */
export function basquinStress(N: number, Su: number, Se: number) {
  const b = Math.log10(Se / (0.9 * Su)) / 3
  const a = (0.9 * Su) / 10 ** (3 * b)
  return Math.max(Se, Math.min(Su, a * N ** b))
}
/** Miner: the share of life used by blocks of [cycles, life] */
export const minerDamage = (blocks: [number, number][]) => blocks.reduce((s, [n, N]) => s + n / N, 0)

/* ------------------------------------------------------------------ fracture */
export const stressIntensity = (Y: number, sigma: number, a: number) => Y * sigma * Math.sqrt(PI * a)
export const criticalStress = (Y: number, KIc: number, a: number) => KIc / (Y * Math.sqrt(PI * a))
export const criticalCrack = (Y: number, KIc: number, sigma: number) => (KIc / (Y * sigma)) ** 2 / PI
/** Griffith's stress for a brittle plate: γ surface energy per unit area, a half crack length */
export const griffithStress = (E: number, gamma: number, a: number) => Math.sqrt((2 * E * gamma) / (PI * a))
/** Paris: cycles to grow from a0 to af, by steps */
export function parisLife(C: number, m: number, Y: number, dSigma: number, a0: number, af: number, n = 4000) {
  let N = 0
  const h = (af - a0) / n
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + 0.5) * h
    const dK = stressIntensity(Y, dSigma, a) / 1e6
    N += h / (C * dK ** m)
  }
  return N
}

/* ------------------------------------------------------------------ creep */
/** a three-stage curve: an initial strain, a falling primary rate, steady secondary, and a rising tertiary */
export function creepStrain(e0: number, primary: number, tau: number, rate: number, t: number, tRupture: number) {
  const base = e0 + primary * (1 - Math.exp(-t / tau)) + rate * t
  if (t <= 0.75 * tRupture) return base
  const u = (t - 0.75 * tRupture) / (0.25 * tRupture)
  return base + rate * tRupture * 0.25 * (Math.exp(2.5 * u) - 1) * 0.5
}
/** Norton's steady creep law: ε̇ = A σⁿ exp(−Q/RT) */
export const nortonRate = (A: number, sigma: number, n: number, Q: number, T: number) => A * sigma ** n * Math.exp(-Q / (8.314 * T))
/** Larson–Miller parameter, T in kelvin and t in hours */
export const larsonMiller = (T: number, t: number, C = 20) => T * (C + Math.log10(t))
export const larsonMillerLife = (P: number, T: number, C = 20) => 10 ** (P / T - C)
