/**
 * Rolling-bearing load capacity and life — AEE503 Module 7 (Bearings). SI units: N, m, rad, rev/min.
 */

const { cos, log, pow, PI } = Math

/** Stribeck static capacity of a ball bearing: C₀ = K·Z·D²/5 (M7 slide 17). */
export function stribeckBall(K: number, Z: number, D: number) {
  return (K * Z * D * D) / 5
}

/** Stribeck static capacity of a straight roller bearing: C₀ = K·Z·D·L/5 (M7 slide 17). */
export function stribeckRoller(K: number, Z: number, D: number, L: number) {
  return (K * Z * D * L) / 5
}

/** AFBMA basic static rating: C₀ = f₀·i·Z·D²·cos α (M7 slide 16). */
export function afbmaStatic(f0: number, i: number, Z: number, D: number, alpha = 0) {
  return f0 * i * Z * D * D * cos(alpha)
}

/** Static equivalent load P₀ = X₀F_r + Y₀F_a, but never less than F_r (M7 slide 18, Example 2). */
export function staticEquivalentLoad(X0: number, Y0: number, Fr: number, Fa: number) {
  const raw = X0 * Fr + Y0 * Fa
  return { raw, P0: Math.max(raw, Fr), governedByFr: raw < Fr }
}

/** Basic dynamic load rating C = f_c(i cos α)^0.7·Z^(2/3)·D^1.8 (M7 slide 20; f_c from tables). */
export function dynamicRating(fc: number, i: number, alpha: number, Z: number, D: number) {
  return fc * pow(i * cos(alpha), 0.7) * pow(Z, 2 / 3) * pow(D, 1.8)
}

/** Rotation factor V: 1.0 when the inner ring rotates relative to the load, 1.2 when it is stationary (M7 slide 22). */
export const ROTATION_FACTOR = { inner: 1.0, outer: 1.2 } as const

/** Dynamic equivalent load P = X·V·F_r + Y·F_a (M7 slide 22). */
export function equivalentLoad(X: number, V: number, Fr: number, Y: number, Fa: number) {
  return X * V * Fr + Y * Fa
}

/**
 * Rating (L10) life in millions of revolutions, L = (C/P)^p. The notes give p = 3 for ball
 * bearings; p = 10/3 for roller bearings is the ISO value (beyond notes).
 */
export function ratingLife(C: number, P: number, exponent = 3) {
  return pow(C / P, exponent)
}

/** Life in hours at constant speed: L_h = L·10⁶ / (60·N). */
export function lifeHours(Lmillion: number, rpm: number) {
  return (Lmillion * 1e6) / (60 * rpm)
}

/** Load that gives a required life: P = C / L^(1/p). */
export function loadForLife(C: number, Lmillion: number, exponent = 3) {
  return C / pow(Lmillion, 1 / exponent)
}

/**
 * Fraction of a group still running at life L (beyond notes): Weibull scatter with slope e
 * anchored so that 90 % survive to L10 — S = exp(ln 0.9·(L/L10)^e). e ≈ 1.5 for ball bearings.
 */
export function survival(L: number, L10: number, slope = 1.5) {
  return Math.exp(log(0.9) * pow(L / L10, slope))
}

/** Median (50 %) life relative to L10 for Weibull slope e: (ln 0.5/ln 0.9)^(1/e) (beyond notes). */
export function medianOverL10(slope = 1.5) {
  return pow(log(0.5) / log(0.9), 1 / slope)
}

/** Cage (ball-set) speed for an inner-ring-rotating bearing: ω_c = ω/2·(1 − (D/D_p) cos α) (beyond notes). */
export function cageSpeed(omegaInner: number, ballD: number, pitchD: number, alpha = 0) {
  return (omegaInner / 2) * (1 - (ballD / pitchD) * cos(alpha))
}

/** Rolling element spin about its own axis for inner-ring rotation (beyond notes). */
export function ballSpin(omegaInner: number, ballD: number, pitchD: number, alpha = 0) {
  const g = (ballD / pitchD) * cos(alpha)
  return (omegaInner * pitchD) / (2 * ballD) * (1 - g * g)
}

export const RPM = (omega: number) => (omega * 60) / (2 * PI)
