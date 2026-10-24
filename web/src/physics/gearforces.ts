/**
 * Gear geometry and tooth forces — AEE503 Module 5 (Gear forces). SI units: m, N, N·m, rad, W.
 */

const { PI, cos, sin, tan, atan2, sqrt } = Math

/* ------------------------------ Nomenclature ------------------------------ */

/** Module m = D/N (M5 slide 5). */
export const gearModule = (D: number, N: number) => D / N

/** Circular pitch P_c = πD/N; note P_c/m = π (M5 slide 5). */
export const circularPitch = (D: number, N: number) => (PI * D) / N

/**
 * Standard full-depth proportions (beyond notes — the notes define the circles but give no
 * proportions): addendum a = m, dedendum b = 1.25m, base circle r_b = r cos φ.
 */
export function spurCircles(N: number, m: number, phi: number) {
  const r = (N * m) / 2
  return { pitch: r, addendum: r + m, dedendum: r - 1.25 * m, base: r * cos(phi), addendumDepth: m, dedendumDepth: 1.25 * m, toothThickness: (PI * m) / 2 }
}

/** Centre distance of an external pair: a = m(z₁ + z₂)/2. */
export const centreDistance = (m: number, z1: number, z2: number) => (m * (z1 + z2)) / 2

/* ------------------------------ Torque & speed ------------------------------ */

/** Torque from power and speed: T = P/ω = 60P/(2πN). */
export const torqueFromPower = (P: number, rpm: number) => (60 * P) / (2 * PI * rpm)

/** Gear train with an idler: the idler changes direction only, so T_C = T_A·z_C/z_A and N_C = N_A·z_A/z_C (MG17 / MG21 Q2c). */
export function idlerTrain(P: number, rpmA: number, zA: number, zB: number, zC: number) {
  const TA = torqueFromPower(P, rpmA)
  return { TA, TB: 0, TC: (TA * zC) / zA, rpmB: (rpmA * zA) / zB, rpmC: (rpmA * zA) / zC }
}

/* ------------------------------ Forces ------------------------------ */

/** Spur gear (M5 slide 8): F_t = M_t/r, F_r = F_t tan φ (radial force points to the gear centre). */
export function spurForces(Mt: number, r: number, phi: number) {
  const Ft = Mt / r
  const Fr = Ft * tan(phi)
  return { Ft, Fr, F: sqrt(Ft * Ft + Fr * Fr) }
}

/**
 * Helical gear (M5 slides 10–12). φ measured in the plane of rotation (transverse):
 * F_r = F_t tan φ; measured normal to the tooth (φ_n): F_r = F_t tan φ_n / cos α.
 * Thrust F_a = F_t tan α, α = helix angle from the axis.
 */
export function helicalForces(Mt: number, r: number, phi: number, helix: number, plane: 'transverse' | 'normal' = 'transverse') {
  const Ft = Mt / r
  const Fr = plane === 'transverse' ? Ft * tan(phi) : (Ft * tan(phi)) / cos(helix)
  const Fa = Ft * tan(helix)
  return { Ft, Fr, Fa, F: sqrt(Ft * Ft + Fr * Fr + Fa * Fa) }
}

/** Pitch-cone angle of a bevel pinion on shafts at 90°: tan β = r_pinion / r_gear. */
export function pinionConeAngle(rPinion: number, rGear: number) {
  return atan2(rPinion, rGear)
}

/** Mean pitch radius of a bevel gear: r_m = R − (b/2) sin β (MG15 Q3c). */
export function bevelMeanRadius(R: number, faceWidth: number, beta: number) {
  return R - (faceWidth / 2) * sin(beta)
}

/**
 * Straight bevel (M5 slides 14–15). F_t = M_t/r_m at the mean radius; the separating force
 * F_t tan φ splits into the pinion thrust F_p = F_t tan φ sin β and the gear thrust
 * F_g = F_t tan φ cos β (β = pinion pitch-cone angle).
 */
export function bevelForces(Mt: number, rMean: number, phi: number, beta: number) {
  const Ft = Mt / rMean
  const Fs = Ft * tan(phi)
  return { Ft, Fs, Fp: Fs * sin(beta), Fg: Fs * cos(beta) }
}
