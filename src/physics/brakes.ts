/**
 * Brakes — AEE503 Module 9 (Brake design, Hall et al. Ch 15). SI units: N, m, rad, W.
 */

const { cos, exp, sin, PI } = Math

/* ------------------------------ Shoe (block) brakes ------------------------------ */

/** Normal force from the braking torque, T = f·N·R (M9 slide 8). */
export function shoeNormalForce(T: number, f: number, R: number) {
  return T / (f * R)
}

/**
 * Lever force for a single short shoe (Fig 15-10). Moments about the lever pivot:
 * N acts at arm a, the friction fN at arm c, the applied force F at arm b.
 * 'aiding' — drum rotation makes the friction moment help apply the brake (F·b = N·a − fN·c,
 * clockwise in Fig 15-10); 'opposing' — the other direction (F·b = N·a + fN·c).
 */
export function shoeLeverForce(N: number, f: number, a: number, b: number, c: number, sense: 'aiding' | 'opposing') {
  const fr = f * N * c
  return (N * a + (sense === 'aiding' ? -fr : fr)) / b
}

/** Self-locking (aiding direction) when a/c ≤ f, i.e. c ≥ a/f (M9 slide 8, Example 1d). */
export function selfLockingArm(a: number, f: number) {
  return a / f
}

/** Long pivoted shoe: T = f·N·4R sin(θ/2)/(θ + sin θ) (M9 slide 9). */
export function longShoeTorque(f: number, N: number, R: number, theta: number) {
  return (f * N * 4 * R * sin(theta / 2)) / (theta + sin(theta))
}

/** Double shoe (short): T = f(N_L + N_R)R (M9 slide 11). */
export function doubleShoeTorque(f: number, NL: number, NR: number, R: number) {
  return f * (NL + NR) * R
}

/* ------------------------------ Internal expanding shoe (Fig 15-6) ------------------------------ */

/** θ_m = 90° if θ₂ > 90°, else θ₂ (M9 slide 16). */
export const thetaMax = (theta2: number) => (theta2 > PI / 2 ? PI / 2 : theta2)

/** Moment of the friction forces about the shoe pivot: M_f = (f p_m w r / sin θ_m)∫ sin θ (r − a cos θ) dθ. */
export function internalShoeMf(f: number, pm: number, w: number, r: number, a: number, th1: number, th2: number) {
  const I = r * (cos(th1) - cos(th2)) - (a / 2) * (sin(th2) ** 2 - sin(th1) ** 2)
  return ((f * pm * w * r) / sin(thetaMax(th2))) * I
}

/** Moment of the normal forces about the shoe pivot: M_n = (p_m w r a / sin θ_m)∫ sin²θ dθ. */
export function internalShoeMn(pm: number, w: number, r: number, a: number, th1: number, th2: number) {
  const I = (th2 - th1) / 2 - (sin(2 * th2) - sin(2 * th1)) / 4
  return ((pm * w * r * a) / sin(thetaMax(th2))) * I
}

/** Braking torque of the symmetrical two-shoe brake: T = f w r²(cos θ₁ − cos θ₂)/sin θ_m·(p_m + p_m′). */
export function internalShoeTorque(f: number, w: number, r: number, th1: number, th2: number, pm: number, pm2: number) {
  return ((f * w * r * r * (cos(th1) - cos(th2))) / sin(thetaMax(th2))) * (pm + pm2)
}

/* ------------------------------ Band brakes ------------------------------ */

/** F₁/F₂ = e^(fα) (M9 slide 20). */
export const bandRatio = (f: number, alpha: number) => exp(f * alpha)

/** Band tensions from the torque, T = (F₁ − F₂)r (M9 Example 2). */
export function bandTensions(T: number, r: number, f: number, alpha: number) {
  const k = bandRatio(f, alpha)
  const dF = T / r
  const F2 = dF / (k - 1)
  return { k, F1: F2 * k, F2 }
}

/** Simple band brake (Fig 15-7): tight side on the fixed pivot, slack side at arm a, effort at arm b → F = F₂a/b. */
export function simpleBandLever(F2: number, a: number, b: number) {
  return (F2 * a) / b
}

/** Differential band brake (Fig 15-9): F·c + F₁a − F₂b = 0 → F = (F₂b − F₁a)/c. */
export function differentialBandForce(F1: number, F2: number, a: number, b: number, c: number) {
  return (F2 * b - F1 * a) / c
}

/** Differential band is self-locking when b ≤ a·e^(fα). */
export function differentialSelfLocking(a: number, b: number, f: number, alpha: number) {
  return b <= a * bandRatio(f, alpha)
}

/* ------------------------------ Heat ------------------------------ */

/** Rate of heat generated H_g = f·N·V (= p_av A f V) (M9 slide 25, Example 1e). */
export function heatGenerated(f: number, N: number, V: number) {
  return f * N * V
}

/** Heat dissipated H_d = C·Δt·A_r; C ≈ 29.5 W/m²K at Δt = 40 °C rising to 44 at 200 °C (M9 slide 26). */
export function heatDissipated(C: number, dt: number, Ar: number) {
  return C * dt * Ar
}

/** Linear interpolation of the notes' heat-transfer coefficient between Δt = 40 °C and 200 °C. */
export function dissipationCoefficient(dt: number) {
  const t = Math.min(1, Math.max(0, (dt - 40) / 160))
  return 29.5 + (44 - 29.5) * t
}
