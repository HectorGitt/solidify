/**
 * Vibration of lumped spring–mass–damper systems.
 *
 * Sources: AEE518 lecture notes (second-order systems, log decrement, vibration isolation),
 * AEE503 Module 12 (machine vibration), AEE510 "Human Engineering in tractor design"
 * (seat transmissibility eq 14–18, ISO 2631 Fig 10.6).
 *
 * SI units throughout: kg, N/m, N·s/m, rad/s, m, s.
 */

const { PI, sqrt, exp, cos, sin, abs, log } = Math

/* ------------------------------ single degree of freedom ------------------------------ */

/** ω_n = √(k/m), rad/s. */
export function naturalFrequency(k: number, m: number) {
  return sqrt(k / m)
}

/** Critical damping c_c = 2√(km) = 2mω_n. */
export function criticalDamping(k: number, m: number) {
  return 2 * sqrt(k * m)
}

/** ζ = c / c_c = c / (2√(km)). */
export function dampingRatio(c: number, k: number, m: number) {
  return c / criticalDamping(k, m)
}

/** c for a wanted ζ. */
export function dampingForRatio(zeta: number, k: number, m: number) {
  return zeta * criticalDamping(k, m)
}

/** ω_d = ω_n√(1 − ζ²) (zero when ζ ≥ 1). */
export function dampedFrequency(wn: number, zeta: number) {
  return zeta < 1 ? wn * sqrt(1 - zeta * zeta) : 0
}

export type DampingCase = 'undamped' | 'underdamped' | 'critical' | 'overdamped'

/** The four cases in the AEE518 notes. ζ within ±0.5 % of 1 counts as critical. */
export function dampingCase(zeta: number): DampingCase {
  if (zeta < 1e-6) return 'undamped'
  if (abs(zeta - 1) <= 0.005) return 'critical'
  return zeta < 1 ? 'underdamped' : 'overdamped'
}

export interface Roots {
  re1: number
  im1: number
  re2: number
  im2: number
}

/** Roots of m s² + c s + k = 0: s = −ζω_n ± ω_n√(ζ² − 1). */
export function characteristicRoots(m: number, c: number, k: number): Roots {
  const wn = naturalFrequency(k, m)
  const z = dampingRatio(c, k, m)
  if (z < 1) {
    const wd = wn * sqrt(1 - z * z)
    return { re1: -z * wn, im1: wd, re2: -z * wn, im2: -wd }
  }
  const r = wn * sqrt(z * z - 1)
  return { re1: -z * wn + r, im1: 0, re2: -z * wn - r, im2: 0 }
}

/* ------------------------------ logarithmic decrement ------------------------------ */

/** δ = 2πζ / √(1 − ζ²). */
export function logDecrement(zeta: number) {
  return (2 * PI * zeta) / sqrt(1 - zeta * zeta)
}

/** Inverse: ζ = δ / √(4π² + δ²). */
export function zetaFromLogDecrement(delta: number) {
  return delta / sqrt(4 * PI * PI + delta * delta)
}

/** δ = (1/n) ln(q₀ / qₙ) from two peaks n cycles apart. */
export function logDecrementFromPeaks(q0: number, qn: number, n: number) {
  return log(q0 / qn) / n
}

/* ------------------------------ time response ------------------------------ */

export type Deriv = (t: number, y: number[]) => number[]

/** One classical Runge–Kutta (RK4) step of size h. */
export function rk4Step(f: Deriv, t: number, y: number[], h: number): number[] {
  const n = y.length
  const k1 = f(t, y)
  const y2 = new Array<number>(n)
  for (let i = 0; i < n; i++) y2[i] = y[i] + (h / 2) * k1[i]
  const k2 = f(t + h / 2, y2)
  for (let i = 0; i < n; i++) y2[i] = y[i] + (h / 2) * k2[i]
  const k3 = f(t + h / 2, y2)
  for (let i = 0; i < n; i++) y2[i] = y[i] + h * k3[i]
  const k4 = f(t + h, y2)
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  return out
}

/** m ẍ + c ẋ + k x = F(t), state [x, ẋ]. */
export function smdDeriv(m: number, c: number, k: number, F: (t: number) => number): Deriv {
  return (t, [x, v]) => [v, (F(t) - c * v - k * x) / m]
}

/** A step size that resolves the fastest dynamics (natural, forcing and damping time constants). */
export function stableStep(m: number, c: number, k: number, omegaForce = 0) {
  const wn = naturalFrequency(k, m)
  const fast = Math.max(wn, omegaForce, c / m, 1e-3)
  return Math.min(0.01, (2 * PI) / fast / 60)
}

export interface Trace {
  t: number[]
  x: number[]
  v: number[]
  a: number[]
}

/** Integrate m ẍ + c ẋ + k x = F(t) from (x₀, v₀) with RK4, sampling `samples` points. */
export function simulateSMD(
  m: number,
  c: number,
  k: number,
  F: (t: number) => number,
  x0: number,
  v0: number,
  tEnd: number,
  samples = 600,
  hMax?: number,
): Trace {
  const f = smdDeriv(m, c, k, F)
  const hCap = hMax ?? stableStep(m, c, k)
  const dtS = tEnd / (samples - 1)
  const sub = Math.max(1, Math.ceil(dtS / hCap))
  const h = dtS / sub
  const out: Trace = { t: [], x: [], v: [], a: [] }
  let y = [x0, v0]
  let t = 0
  for (let i = 0; i < samples; i++) {
    out.t.push(t)
    out.x.push(y[0])
    out.v.push(y[1])
    out.a.push((F(t) - c * y[1] - k * y[0]) / m)
    if (i === samples - 1) break
    for (let s = 0; s < sub; s++) {
      y = rk4Step(f, t, y, h)
      t += h
    }
  }
  return out
}

/**
 * Exact response to a step force F₀ applied at t = 0 to a system at rest
 * (final value F₀/k), for all four damping cases.
 */
export function stepResponse(m: number, c: number, k: number, F0: number, t: number) {
  const wn = naturalFrequency(k, m)
  const z = dampingRatio(c, k, m)
  const xs = F0 / k
  if (abs(z - 1) < 1e-9) return xs * (1 - exp(-wn * t) * (1 + wn * t))
  if (z < 1) {
    const wd = wn * sqrt(1 - z * z)
    return xs * (1 - exp(-z * wn * t) * (cos(wd * t) + (z / sqrt(1 - z * z)) * sin(wd * t)))
  }
  const r = wn * sqrt(z * z - 1)
  const s1 = -z * wn + r
  const s2 = -z * wn - r
  return xs * (1 + (s2 * exp(s1 * t) - s1 * exp(s2 * t)) / (s1 - s2))
}

/** Exact free response from x₀ (released at rest). */
export function freeResponse(m: number, c: number, k: number, x0: number, t: number) {
  // free response from rest = x0·(1 − step response normalised)
  return x0 * (1 - stepResponse(m, c, k, 1, t) * k)
}

/** Positive peaks of a sampled trace (local maxima above zero), as [t, x] pairs. */
export function positivePeaks(t: number[], x: number[]) {
  const out: [number, number][] = []
  for (let i = 1; i < x.length - 1; i++) if (x[i] > 0 && x[i] >= x[i - 1] && x[i] > x[i + 1]) out.push([t[i], x[i]])
  return out
}

/* ------------------------------ harmonic forcing ------------------------------ */

/** Steady amplitude X = F₀ / √((k − mω²)² + (cω)²). */
export function forcedAmplitude(F0: number, m: number, c: number, k: number, w: number) {
  return F0 / sqrt((k - m * w * w) ** 2 + (c * w) ** 2)
}

/** Phase lag φ = tan⁻¹(cω / (k − mω²)), 0…π. */
export function forcedPhase(m: number, c: number, k: number, w: number) {
  return Math.atan2(c * w, k - m * w * w)
}

/** Magnification factor X/(F₀/k) = 1 / √((1 − r²)² + (2ζr)²). */
export function magnification(r: number, zeta: number) {
  return 1 / sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)
}

/** Transmissibility TR = √(1 + (2ζr)²) / √((1 − r²)² + (2ζr)²) (force or base motion). */
export function transmissibility(r: number, zeta: number) {
  return sqrt(1 + (2 * zeta * r) ** 2) * magnification(r, zeta)
}

/** Isolation efficiency (1 − TR) × 100 %. Negative = amplification. */
export function isolationEfficiency(TR: number) {
  return (1 - TR) * 100
}

/**
 * Frequency ratio r > √2 that gives a wanted transmissibility TR < 1 at damping ζ.
 * Solves TR²[(1 − u)² + 4ζ²u] = 1 + 4ζ²u for u = r².
 */
export function ratioForTransmissibility(TR: number, zeta: number) {
  const z2 = 4 * zeta * zeta
  const a = TR * TR
  const b = z2 * a - 2 * a - z2
  const c = a - 1
  const u = (-b + sqrt(b * b - 4 * a * c)) / (2 * a)
  return sqrt(u)
}

/** Rotating/reciprocating unbalance force amplitude F₀ = m_u e ω². */
export function unbalanceForce(mu: number, e: number, w: number) {
  return mu * e * w * w
}

/* ------------------------------ complex helpers (frequency response) ------------------------------ */

export interface Cx {
  re: number
  im: number
}
export const cx = (re: number, im = 0): Cx => ({ re, im })
export const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im })
export const csub = (a: Cx, b: Cx): Cx => ({ re: a.re - b.re, im: a.im - b.im })
export const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re })
export const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b.re * b.re + b.im * b.im
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}
export const cabs = (a: Cx) => Math.hypot(a.re, a.im)
export const cexpi = (phi: number): Cx => ({ re: cos(phi), im: sin(phi) })

/** Base-excited single DOF: X/Y = (k + icω)/(k − mω² + icω). |X/Y| equals transmissibility(r, ζ). */
export function baseTransfer(m: number, c: number, k: number, w: number): Cx {
  return cdiv(cx(k, c * w), cx(k - m * w * w, c * w))
}

/* ------------------------------ two-DOF seat (AEE510 HE Fig 10.9) ------------------------------ */

export interface SeatParams {
  /** operator (man) mass on the cushion, kg */
  m1: number
  /** cushion stiffness and damping */
  k1: number
  c1: number
  /** seat (pan + frame) mass on the suspension, kg */
  m2: number
  /** suspension stiffness and damping */
  k2: number
  c2: number
}

/**
 * Seat transfer functions from chassis (floor) motion z₀ to seat z₂ and man z₁:
 *   m₁z̈₁ = −k₁(z₁ − z₂) − c₁(ż₁ − ż₂)
 *   m₂z̈₂ =  k₁(z₁ − z₂) + c₁(ż₁ − ż₂) − k₂(z₂ − z₀) − c₂(ż₂ − ż₀)
 */
export function seatTransfer(p: SeatParams, w: number): { man: Cx; seat: Cx } {
  const a11 = cx(p.k1 - p.m1 * w * w, p.c1 * w)
  const a12 = cx(-p.k1, -p.c1 * w)
  const a22 = cx(p.k1 + p.k2 - p.m2 * w * w, (p.c1 + p.c2) * w)
  const rhs = cx(p.k2, p.c2 * w)
  // [a11 a12; a12 a22][Z1; Z2] = [0; rhs]
  const det = csub(cmul(a11, a22), cmul(a12, a12))
  const seat = cdiv(cmul(a11, rhs), det)
  const man = cdiv(cmul(cx(-a12.re, -a12.im), seat), a11)
  return { man, seat }
}

/** State [z1, ż1, z2, ż2]; floor motion and velocity supplied as functions of t. Optional bump stops. */
export function seatDeriv(
  p: SeatParams,
  floor: (t: number) => number,
  floorVel: (t: number) => number,
  stops?: { travel: number; k: number },
): Deriv {
  return (t, [z1, v1, z2, v2]) => {
    const z0 = floor(t)
    const v0 = floorVel(t)
    const fc = p.k1 * (z1 - z2) + p.c1 * (v1 - v2)
    let fs = p.k2 * (z2 - z0) + p.c2 * (v2 - v0)
    if (stops) {
      const d = z2 - z0
      if (d > stops.travel) fs += stops.k * (d - stops.travel)
      else if (d < -stops.travel) fs += stops.k * (d + stops.travel)
    }
    return [v1, -fc / p.m1, v2, (fc - fs) / p.m2]
  }
}

/* ------------------------------ tractor body on tyres ------------------------------ */

/**
 * Tyre-sprung axle end: mass m on tyre stiffness k and damping c, excited by the ground.
 * The tractor's pitch inertia is approximated by splitting the body mass between the axles
 * (dynamic index = 1), so the front and rear ends respond independently.
 */
export function axleTransfer(m: number, c: number, k: number, w: number) {
  return baseTransfer(m, c, k, w)
}

/* ------------------------------ ground roughness ------------------------------ */

export interface ProfileComponent {
  /** wavelength, m */
  lambda: number
  /** amplitude, m */
  amp: number
  phase: number
}

/** Small deterministic PRNG so the field looks the same every visit. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Periodic rough-ground profile (period L metres) as a sum of sinusoids whose amplitudes follow
 * a displacement PSD G(n) = G₀(n/n₀)⁻², n₀ = 0.1 cycle/m (the ISO 8608 road-class form).
 * Wavelengths are L/j for integers j, so the profile repeats exactly every L metres.
 */
export function roughProfile(G0: number, period = 64, count = 40, seed = 7, lambdaMin = 0.3): ProfileComponent[] {
  const rnd = mulberry32(seed)
  const jMax = Math.floor(period / lambdaMin)
  const js: number[] = []
  for (let i = 0; i < count; i++) {
    const j = Math.round(Math.exp(Math.log(1) + (Math.log(jMax) * i) / (count - 1)))
    if (!js.includes(j)) js.push(j)
  }
  const n0 = 0.1
  return js.map((j, i) => {
    const n = j / period
    const lo = i > 0 ? (js[i - 1] + j) / 2 : j - 0.5
    const hi = i < js.length - 1 ? (js[i + 1] + j) / 2 : j + 0.5
    const dn = (hi - lo) / period
    const G = G0 * (n / n0) ** -2
    return { lambda: period / j, amp: sqrt(2 * G * dn), phase: rnd() * 2 * PI }
  })
}

/** Ground height and slope at distance x along a profile. */
export function profileAt(p: ProfileComponent[], x: number) {
  let h = 0
  let dh = 0
  for (const c of p) {
    const k = (2 * PI) / c.lambda
    h += c.amp * sin(k * x + c.phase)
    dh += c.amp * k * cos(k * x + c.phase)
  }
  return { h, dh }
}

/* ------------------------------ whole-body vibration criteria ------------------------------ */

/** RMS of a sinusoid's acceleration: Ẍ_RMS = ω²A/√2 (HE eq 9). */
export function accelRms(A: number, w: number) {
  return (w * w * A) / Math.SQRT2
}

/** Vibration acceleration level, dB re 1 m/s² RMS (HE eq 10). */
export function vibrationLevel(aRms: number) {
  return 20 * Math.log10(aRms / 1)
}

/**
 * ISO 2631 (1974) fatigue-decreased proficiency (FDP) boundary for vertical vibration,
 * HE Fig 10.6: flat 4–8 Hz, rising as f^−½ below 4 Hz and as f above 8 Hz.
 * Values at 4–8 Hz by exposure time (h), m/s² RMS, read from the figure.
 */
export const ISO_FDP_FLAT: [number, number][] = [
  [1 / 60, 2.0],
  // Fig 10.6 labels this curve "10 min"; the standard tabulates 1.6 m/s² at 16 min
  [16 / 60, 1.6],
  [25 / 60, 1.4],
  [1, 1.06],
  [2.5, 0.71],
  [4, 0.53],
  [8, 0.315],
  [16, 0.212],
  [24, 0.14],
]

/** Flat (4–8 Hz) FDP level for an exposure time in hours (log–log interpolation). */
export function fdpFlat(hours: number) {
  const T = ISO_FDP_FLAT
  if (hours <= T[0][0]) return T[0][1]
  if (hours >= T[T.length - 1][0]) return T[T.length - 1][1]
  for (let i = 0; i < T.length - 1; i++) {
    const [h0, a0] = T[i]
    const [h1, a1] = T[i + 1]
    if (hours <= h1) {
      const u = Math.log(hours / h0) / Math.log(h1 / h0)
      return a0 * Math.pow(a1 / a0, u)
    }
  }
  return T[T.length - 1][1]
}

/** Frequency shape of the ISO 2631 vertical boundaries (1 at 4–8 Hz). */
export function isoShape(f: number) {
  if (f < 4) return Math.sqrt(4 / f)
  if (f <= 8) return 1
  return f / 8
}

export type IsoBoundary = 'fdp' | 'exposure' | 'comfort'

/**
 * ISO 2631 vertical boundary at frequency f for an exposure time.
 * 'fdp' is in the notes (Fig 10.6). The exposure limit (FDP × 2, +6 dB) and reduced-comfort
 * boundary (FDP ÷ 3.15, −10 dB) are from the standard itself, not the notes.
 */
export function isoBoundary(f: number, hours: number, kind: IsoBoundary = 'fdp') {
  const a = fdpFlat(hours) * isoShape(f)
  return kind === 'fdp' ? a : kind === 'exposure' ? a * 2 : a / 3.15
}

/** Longest exposure (h) whose FDP boundary is not exceeded by a band level a at frequency f. */
export function allowedHours(aBand: number, f: number) {
  const flat = aBand / isoShape(f)
  const T = ISO_FDP_FLAT
  if (flat <= T[T.length - 1][1]) return 24
  if (flat > T[0][1]) return 0
  for (let i = 0; i < T.length - 1; i++) {
    const [h0, a0] = T[i]
    const [h1, a1] = T[i + 1]
    if (flat <= a0 && flat >= a1) {
      const u = Math.log(flat / a0) / Math.log(a1 / a0)
      return h0 * Math.pow(h1 / h0, u)
    }
  }
  return 0
}

/** One-third-octave band centre frequencies, 1–80 Hz (the range of Fig 10.6). */
export const THIRD_OCTAVES = [1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8, 10, 12.5, 16, 20, 25, 31.5, 40, 50, 63, 80]

/** Sum sinusoidal components (frequency Hz, RMS) into one-third-octave band RMS levels. */
export function bandRms(components: { f: number; rms: number }[]) {
  const k = Math.pow(2, 1 / 6)
  return THIRD_OCTAVES.map((fc) => {
    let s = 0
    for (const c of components) if (c.f >= fc / k && c.f < fc * k) s += c.rms * c.rms
    return Math.sqrt(s)
  })
}

/* ================================================================================
 * AEE518 lab additions (spring–mass–damper and isolation scenes). Append-only.
 * ================================================================================ */

/* ------------------------------ generic second-order coefficients ------------------------------ */

/** a₂q̈ + a₁q̇ + a₀q = qᵢ  →  ω_n = √(a₀/a₂), ζ = a₁ / (2√(a₀a₂)), ω_d = ω_n√(1 − ζ²) (AEE518 LN). */
export function secondOrderParams(a2: number, a1: number, a0: number) {
  const wn = sqrt(a0 / a2)
  const zeta = a1 / (2 * sqrt(a0 * a2))
  return { wn, zeta, wd: dampedFrequency(wn, zeta) }
}

/* ------------------------------ first-order systems ------------------------------ */

/** Time constant of a₁q̇ + a₀q = qᵢ: τ = a₁/a₀. */
export function firstOrderTau(a1: number, a0: number) {
  return a1 / a0
}

/** Step response of a₁q̇ + a₀q = b₀ from q(0) = q₀: q = b₀/a₀ + (q₀ − b₀/a₀)e^(−t/τ). */
export function firstOrderStep(a1: number, a0: number, b0: number, q0: number, t: number) {
  const qf = b0 / a0
  return qf + (q0 - qf) * exp(-t / firstOrderTau(a1, a0))
}

export interface FirstOrderHarmonic {
  tau: number
  /** forced amplitude b₀ / √(a₀² + (a₁ω)²) */
  amp: number
  /** phase lag φ = tan⁻¹(a₁ω/a₀) */
  phase: number
  /** natural-response constant from q(0) = q₀ */
  Cn: number
}

/**
 * a₁q̇ + a₀q = b₀ cos ωt with q(0) = q₀ (AEE518 LN first-order Example 1):
 * q(t) = C_n e^(−t/τ) + A cos(ωt − φ), C_n = q₀ − A cos φ.
 */
export function firstOrderCosine(a1: number, a0: number, b0: number, w: number, q0: number): FirstOrderHarmonic {
  const amp = b0 / sqrt(a0 * a0 + (a1 * w) ** 2)
  const phase = Math.atan2(a1 * w, a0)
  return { tau: a1 / a0, amp, phase, Cn: q0 - amp * cos(phase) }
}

export function firstOrderCosineAt(r: FirstOrderHarmonic, w: number, t: number) {
  return r.Cn * exp(-t / r.tau) + r.amp * cos(w * t - r.phase)
}

/**
 * Time constant of a first-order instrument from one reading (thermometer example):
 * T(t) = T₀ + (T_f − T₀)(1 − e^(−t/τ))  →  τ = −t / ln(1 − (T − T₀)/(T_f − T₀)).
 */
export function timeConstantFromReading(T0: number, Tf: number, Tt: number, t: number) {
  return -t / log(1 - (Tt - T0) / (Tf - T0))
}

/* ------------------------------ equivalent systems ------------------------------ */

/** Springs in parallel: k = k₁ + k₂ + … */
export function springsParallel(...ks: number[]) {
  return ks.reduce((s, k) => s + k, 0)
}

/** Springs in series: 1/k = 1/k₁ + 1/k₂ + … */
export function springsSeries(...ks: number[]) {
  return 1 / ks.reduce((s, k) => s + 1 / k, 0)
}

/** Mass on a helical spring of mass M_s: M_e = M + M_s/3. */
export function springEffectiveMass(M: number, Ms: number) {
  return M + Ms / 3
}

/** Second moment of area of a b × h rectangle about its neutral axis: bh³/12. */
export function rectSecondMoment(b: number, h: number) {
  return (b * h ** 3) / 12
}

/** Tip stiffness of a cantilever: k = 3EI/L³. */
export function cantileverStiffness(E: number, I: number, L: number) {
  return (3 * E * I) / L ** 3
}

/** Mass at the tip of a cantilever of mass m_s: M_e = m + 0.23 m_s. */
export function cantileverEffectiveMass(m: number, ms: number) {
  return m + 0.23 * ms
}

/** Weightless bar pivoted at A: mass M at L, damper b at a, spring k at c (AEE518 MG 2018/19). */
export interface PivotedBar {
  M: number
  L: number
  a: number
  b: number
  c: number
  k: number
}

/** ML²θ̈ + a²bθ̇ + kc²θ = 0: ω_n = √(kc²/ML²), ζ = a²b / (2√(kc²·ML²)). */
export function pivotedBarCoefficients(p: PivotedBar) {
  const a2 = p.M * p.L * p.L
  const a1 = p.a * p.a * p.b
  const a0 = p.k * p.c * p.c
  return { a2, a1, a0, ...secondOrderParams(a2, a1, a0) }
}

/* ------------------------------ isolation ------------------------------ */

/** Phase of the transmitted force (or motion) behind the excitation: tan⁻¹(2ζr³ / (1 − r² + 4ζ²r²)). */
export function transmissibilityPhase(r: number, zeta: number) {
  return Math.atan2(2 * zeta * r ** 3, 1 - r * r + 4 * zeta * zeta * r * r)
}

/**
 * Machine of mass M on isolators (k, c) over a support that may move:
 *   M ẍ = f(t) − c(ẋ − ẏ) − k(x − y),  state [x, ẋ].
 * Force excitation: y ≡ 0. Base excitation: f ≡ 0.
 */
export function isolatorDeriv(M: number, c: number, k: number, f: (t: number) => number, y: (t: number) => number, yd: (t: number) => number): Deriv {
  return (t, [x, v]) => [v, (f(t) - c * (v - yd(t)) - k * (x - y(t))) / M]
}

/** Force passed to the floor through the isolators: F_T = k(x − y) + c(ẋ − ẏ). */
export function transmittedForce(c: number, k: number, x: number, v: number, y = 0, yd = 0) {
  return k * (x - y) + c * (v - yd)
}

/* ------------------------------ polynomials and Routh–Hurwitz ------------------------------ */

/** Determinant by Gaussian elimination with partial pivoting. */
export function determinant(m: number[][]) {
  const a = m.map((r) => r.slice())
  const n = a.length
  let det = 1
  for (let i = 0; i < n; i++) {
    let p = i
    for (let r = i + 1; r < n; r++) if (abs(a[r][i]) > abs(a[p][i])) p = r
    if (abs(a[p][i]) < 1e-300) return 0
    if (p !== i) {
      const tmp = a[p]
      a[p] = a[i]
      a[i] = tmp
      det = -det
    }
    det *= a[i][i]
    for (let r = i + 1; r < n; r++) {
      const f = a[r][i] / a[i][i]
      for (let c = i; c < n; c++) a[r][c] -= f * a[i][c]
    }
  }
  return det
}

/**
 * The determinants R₁…R_(n−1) of the AEE518 notes for aₙDⁿ + … + a₁D + a₀ = 0, laid out from the
 * low-order end: R₁ = a₁, R₂ = |a₁ a₀; a₃ a₂|, R₃ = |a₁ a₀ 0; a₃ a₂ a₁; a₅ a₄ a₃|, …
 * Row i holds a_(2i+1), a_(2i), a_(2i−1), … (missing coefficients are 0).
 * `desc` lists the coefficients from the highest power down, e.g. D³ + 4D² + 8D + 12 → [1, 4, 8, 12].
 */
export function hurwitzDeterminants(desc: number[]) {
  const n = desc.length - 1
  const a = (k: number) => (k < 0 || k > n ? 0 : desc[n - k])
  const R: number[] = []
  const mats: number[][][] = []
  for (let m = 1; m <= n - 1; m++) {
    const M: number[][] = []
    for (let i = 0; i < m; i++) {
      const row: number[] = []
      for (let j = 0; j < m; j++) row.push(a(2 * i + 1 - j))
      M.push(row)
    }
    mats.push(M)
    R.push(determinant(M))
  }
  return { R, mats }
}

export interface RouthResult {
  /** condition 1: every coefficient present and of the same sign */
  sameSign: boolean
  /** condition 2 determinants R₁…R_(n−1) (sign-normalised so aₙ > 0) */
  R: number[]
  mats: number[][][]
  stable: boolean
}

/** Routh–Hurwitz stability test exactly as set out in the AEE518 notes. */
export function routhHurwitz(desc: number[]): RouthResult {
  const s = desc[0] < 0 ? -1 : 1
  const d = desc.map((c) => c * s)
  const sameSign = d.every((c) => c > 0)
  const { R, mats } = hurwitzDeterminants(d)
  return { sameSign, R, mats, stable: sameSign && R.every((r) => r > 0) }
}

/** Value of a polynomial (descending coefficients) at a complex point. */
export function polyAt(desc: number[], s: Cx): Cx {
  let acc = cx(0)
  for (const c of desc) acc = cadd(cmul(acc, s), cx(c))
  return acc
}

/** All roots of a real polynomial (descending coefficients), Durand–Kerner iteration. */
export function polyRoots(desc: number[]): Cx[] {
  let i0 = 0
  while (i0 < desc.length - 1 && abs(desc[i0]) < 1e-14) i0++
  const p = desc.slice(i0).map((c) => c / desc[i0])
  const n = p.length - 1
  if (n < 1) return []
  if (n === 1) return [cx(-p[1])]
  const R = 1 + Math.max(...p.slice(1).map(abs))
  let z: Cx[] = Array.from({ length: n }, (_, k) => {
    const a = (2 * PI * k) / n + 0.4
    return { re: R * 0.9 * cos(a), im: R * 0.9 * sin(a) }
  })
  for (let it = 0; it < 500; it++) {
    let delta = 0
    const next = z.map((zi, i) => {
      let den = cx(1)
      for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(zi, z[j]))
      const step = cdiv(polyAt(p, zi), den)
      delta = Math.max(delta, cabs(step))
      return csub(zi, step)
    })
    z = next
    if (delta < 1e-13) break
  }
  // snap tiny imaginary parts; sort by real part, then imaginary part
  return z.map((r) => (abs(r.im) < 1e-9 * (1 + abs(r.re)) ? cx(r.re) : r)).sort((a, b) => a.re - b.re || a.im - b.im)
}

/** Range of K (the constant term) within [lo, hi] for which the polynomial [...desc, K] is stable. */
export function stableGainRange(descWithoutK: number[], lo: number, hi: number, steps = 4000) {
  let first: number | null = null
  let last: number | null = null
  for (let i = 0; i <= steps; i++) {
    const K = lo + ((hi - lo) * i) / steps
    if (routhHurwitz([...descWithoutK, K]).stable) {
      if (first === null) first = K
      last = K
    }
  }
  return first === null || last === null ? null : { from: first, to: last }
}
