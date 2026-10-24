/**
 * Flat and V-belt drives — AEE503 Module 4 (selection by calculation) and Module 2 (selection
 * from the Fenner catalogue). SI units: m, N, Pa, kg, s, rad, W.
 */

const { PI, asin, cos, exp, sin, sqrt } = Math

/* ------------------------------ Geometry ------------------------------ */

/**
 * Open belt (M4 slide 10): sin β = (R − r)/C; small pulley α₁ = 180° − 2β, large α₂ = 180° + 2β.
 * R, r are the large and small pulley radii (either order is accepted), C the centre distance.
 */
export function openBeltWrap(R: number, r: number, C: number) {
  const big = Math.max(R, r)
  const small = Math.min(R, r)
  const beta = asin((big - small) / C)
  return { beta, small: PI - 2 * beta, large: PI + 2 * beta }
}

/** Crossed belt (M4 slide 12): α₁ = α₂ = 180° + 2 sin⁻¹((R + r)/C). */
export function crossedBeltWrap(R: number, r: number, C: number) {
  const beta = asin((R + r) / C)
  return { beta, wrap: PI + 2 * beta }
}

/** Exact open-belt length: 2C cos β + R(π + 2β) + r(π − 2β). */
export function openBeltLength(R: number, r: number, C: number) {
  const { beta } = openBeltWrap(R, r, C)
  const big = Math.max(R, r)
  const small = Math.min(R, r)
  return 2 * C * cos(beta) + big * (PI + 2 * beta) + small * (PI - 2 * beta)
}

/** Exact crossed-belt length: 2C cos β + (R + r)(π + 2β). */
export function crossedBeltLength(R: number, r: number, C: number) {
  const { beta, wrap } = crossedBeltWrap(R, r, C)
  return 2 * C * cos(beta) + (R + r) * wrap
}

/** Catalogue (Fenner) approximation, diameters: L = 2C + 1.57(D + d) + (D − d)²/4C (M2). */
export function fennerBeltLength(D: number, d: number, C: number) {
  return 2 * C + 1.57 * (D + d) + (D - d) ** 2 / (4 * C)
}

/** Catalogue minimum centre distance (M2): C = 2√((D + d)·d). */
export function fennerCentreDistance(D: number, d: number) {
  return 2 * sqrt((D + d) * d)
}

/** Centre distance that gives a small-pulley open-belt wrap α₁ (rad): C = (R − r)/sin((π − α₁)/2). */
export function centreForSmallWrap(R: number, r: number, alphaSmall: number) {
  return (Math.abs(R - r)) / sin((PI - alphaSmall) / 2)
}

/* ------------------------------ Kinematics ------------------------------ */

/** Belt speed v = πdN/60 (m/s) for a pulley of diameter d (m) at N rev/min. */
export function beltSpeed(d: number, rpm: number) {
  return (PI * d * rpm) / 60
}

/** Mass of 1 m of belt: m = b·t·ρ (kg/m) (M4 slide 5). */
export function beltMassPerMetre(b: number, t: number, rho: number) {
  return b * t * rho
}

/* ------------------------------ Tensions ------------------------------ */

/**
 * The capstan factor e^(fα / sin(θ/2)) (M4 slides 5–8). θ is the full groove angle;
 * θ = 180° for a flat belt so the factor reduces to e^(fα).
 */
export function tensionFactor(f: number, alpha: number, grooveAngle = PI) {
  return exp((f * alpha) / sin(grooveAngle / 2))
}

/** The pulley with the smaller e^(…) governs the drive (M4 slide 8). */
export function governingFactor(pulleys: { f: number; alpha: number; groove?: number }[]) {
  const ks = pulleys.map((p) => tensionFactor(p.f, p.alpha, p.groove ?? PI))
  let i = 0
  for (let j = 1; j < ks.length; j++) if (ks[j] < ks[i]) i = j
  return { k: ks[i], index: i, all: ks }
}

/** Centrifugal tension T_c = m v² (N). */
export function centrifugalTension(m: number, v: number) {
  return m * v * v
}

/** Slack-side tension from (T₁ − mv²)/(T₂ − mv²) = k: T₂ = mv² + (T₁ − mv²)/k. */
export function slackTension(T1: number, m: number, v: number, k: number) {
  const Tc = m * v * v
  return Tc + (T1 - Tc) / k
}

/** Power transmitted P = (T₁ − T₂)v (W) (M4 slide 2). */
export function beltPower(T1: number, T2: number, v: number) {
  return (T1 - T2) * v
}

export interface FlatBeltCapacity {
  v: number
  m: number
  Tc: number
  T1: number
  T2: number
  P: number
}

/** Power capacity of a belt whose tight-side tension T₁ is limited (flat or one V-belt). */
export function beltCapacity(T1: number, m: number, v: number, k: number): FlatBeltCapacity {
  const Tc = centrifugalTension(m, v)
  const T2 = slackTension(T1, m, v, k)
  return { v, m, Tc, T1, T2, P: beltPower(T1, T2, v) }
}

/**
 * Required flat-belt width for power P (M4 slides 3–4), using stresses:
 * (s₁ − m′v²)/(s₂ − m′v²) = e^(fα), with m′ = ρ (mass of 1 m of belt of 1 m² section);
 * A = (T₁ − T₂)/(s₁ − s₂), b = A/t.
 */
export function flatBeltWidth(P: number, v: number, s1: number, rho: number, k: number, t: number) {
  const cs = rho * v * v
  const s2 = cs + (s1 - cs) / k
  const dT = P / v
  const A = dT / (s1 - s2)
  return { centrifugalStress: cs, s2, dT, A, b: A / t }
}

/**
 * Belt speed for maximum power at a fixed allowable T₁ (standard result, not in the notes):
 * P = (T₁ − mv²)(1 − 1/k)v is greatest when T_c = mv² = T₁/3, i.e. v = √(T₁/3m).
 */
export function maxPowerSpeed(T1: number, m: number) {
  return sqrt(T1 / (3 * m))
}

/* ------------------------------ Catalogue selection (M2) ------------------------------ */

/** Corrected power per belt = (basic + speed-ratio increment) × length factor × arc factor. */
export function correctedPowerPerBelt(basic: number, increment: number, lengthFactor: number, arcFactor: number) {
  return (basic + increment) * lengthFactor * arcFactor
}

/** Number of belts = design power ÷ corrected power per belt, rounded up. */
export function beltsRequired(designPower: number, perBelt: number) {
  const exact = designPower / perBelt
  return { exact, n: Math.ceil(exact - 1e-9) }
}
