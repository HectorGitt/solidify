/**
 * Friction clutch (and disc brake) capacity — AEE503 Module 8 (Fig 14-1), used by the AEE510
 * tractor clutches. SI units: N, m, Pa, N·m.
 */

/** Number of friction pairs: n = n_driving + n_driven − 1 (e.g. 10 + 9 → 18 surfaces). */
export function frictionPairs(nDriving: number, nDriven: number) {
  return nDriving + nDriven - 1
}

/** Friction radius, uniform-pressure assumption (new clutch): R_f = ⅔ (Ro³ − Ri³)/(Ro² − Ri²). */
export function frictionRadiusUniformPressure(Ro: number, Ri: number) {
  return ((2 / 3) * (Ro ** 3 - Ri ** 3)) / (Ro ** 2 - Ri ** 2)
}

/** Friction radius, uniform-wear assumption (run-in clutch): R_f = (Ro + Ri)/2. */
export function frictionRadiusUniformWear(Ro: number, Ri: number) {
  return (Ro + Ri) / 2
}

export type ClutchTheory = 'pressure' | 'wear'

export function frictionRadius(Ro: number, Ri: number, theory: ClutchTheory) {
  return theory === 'pressure' ? frictionRadiusUniformPressure(Ro, Ri) : frictionRadiusUniformWear(Ro, Ri)
}

/** Torque capacity T = F·f·R_f·n. */
export function clutchTorque(F: number, f: number, Rf: number, n: number) {
  return F * f * Rf * n
}

/** Axial force for a uniform pressure p over the annulus: F = p·π(Ro² − Ri²). */
export function axialForceUniformPressure(p: number, Ro: number, Ri: number) {
  return p * Math.PI * (Ro ** 2 - Ri ** 2)
}

/** Uniform wear: p·r is constant, p_max at Ri. F = 2π·p_max·Ri·(Ro − Ri). */
export function axialForceUniformWear(pMax: number, Ro: number, Ri: number) {
  return 2 * Math.PI * pMax * Ri * (Ro - Ri)
}

/** Pressure at radius r under uniform wear: p = F / (2π r (Ro − Ri)). */
export function pressureUniformWear(F: number, r: number, Ro: number, Ri: number) {
  return F / (2 * Math.PI * r * (Ro - Ri))
}

/** Cone clutch torque (semi-cone angle α): T = F·f·R_f / sin α. */
export function coneClutchTorque(F: number, f: number, alpha: number, Ro: number, Ri: number, theory: ClutchTheory) {
  return (F * f * frictionRadius(Ro, Ri, theory)) / Math.sin(alpha)
}

/** Shaft power from torque and speed: P = 2πNT/60 (W). */
export function powerFromTorque(T: number, rpm: number) {
  return (2 * Math.PI * rpm * T) / 60
}
