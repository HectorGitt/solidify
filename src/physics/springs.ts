/**
 * Springs (AEE503 Module 10) and welded joints (Module 11). SI units: N, m, Pa.
 */

const { PI, sqrt, cbrt } = Math

/* ------------------------------ Helical springs ------------------------------ */

/** Spring index C = D/d (D mean coil diameter, d wire diameter). */
export const springIndex = (D: number, d: number) => D / d

/** Wahl factor K = (4C − 1)/(4C − 4) + 0.615/C (M10 slide 12). */
export const wahlFactor = (C: number) => (4 * C - 1) / (4 * C - 4) + 0.615 / C

/** Direct-shear stress factor K_s = 1 + 0.5/C, as used in the 2021/22 marking guide. */
export const shearStressFactor = (C: number) => 1 + 0.5 / C

/** Shear stress s_s = K·8FD/(πd³) (M10 slide 12). */
export function helicalStress(F: number, D: number, d: number, K: number) {
  return (K * 8 * F * D) / (PI * d ** 3)
}

/** Deflection y = 8FD³n/(d⁴G) (M10 slide 13). */
export function helicalDeflection(F: number, D: number, d: number, n: number, G: number) {
  return (8 * F * D ** 3 * n) / (d ** 4 * G)
}

/** Stiffness k = F/y = d⁴G/(8D³n). */
export function helicalStiffness(D: number, d: number, n: number, G: number) {
  return (d ** 4 * G) / (8 * D ** 3 * n)
}

/** Wire diameter for an allowable stress τ at index C: τ = K·8FC/(πd²) → d = √(8KFC/(πτ)). */
export function wireDiameter(F: number, C: number, tau: number, K: number) {
  return sqrt((8 * K * F * C) / (PI * tau))
}

/** Active coils for a deflection y: n = y d G/(8 F C³). */
export function activeCoils(y: number, F: number, C: number, d: number, G: number) {
  return (y * d * G) / (8 * F * C ** 3)
}

/** Shear-stress distribution across the wire (beyond notes): torsion τ_t = 16T/(πd³) ± direct shear 4F/(πd²) (inside of the coil worst). */
export function wireShear(F: number, D: number, d: number, x: number) {
  // x from −d/2 (outside of coil) to +d/2 (inside of coil)
  const T = (F * D) / 2
  const torsion = (T * x) / ((PI * d ** 4) / 32)
  const direct = (4 * F) / (PI * d * d)
  return torsion + direct
}

/* ------------------------------ Leaf springs ------------------------------ */

/** Stress in the extra full-length leaves, no pre-stress: s_e = 18FL/[bt²(3n_e + 2n_g)] (M10 slide 7). */
export function leafStressFull(F: number, L: number, b: number, t: number, ne: number, ng: number) {
  return (18 * F * L) / (b * t * t * (3 * ne + 2 * ng))
}

/** Stress in the graduated leaves: s_g = 12FL/[bt²(3n_e + 2n_g)] = ⅔s_e (M10 slide 8). */
export function leafStressGraduated(F: number, L: number, b: number, t: number, ne: number, ng: number) {
  return (12 * F * L) / (b * t * t * (3 * ne + 2 * ng))
}

/** Deflection y = 12FL³/[bt³E(3n_e + 2n_g)] (M10 slide 9). */
export function leafDeflection(F: number, L: number, b: number, t: number, E: number, ne: number, ng: number) {
  return (12 * F * L ** 3) / (b * t ** 3 * E * (3 * ne + 2 * ng))
}

/** Leaf thickness for a deflection y (inverse of leafDeflection). */
export function leafThickness(F: number, L: number, b: number, y: number, E: number, ne: number, ng: number) {
  return cbrt((12 * F * L ** 3) / (b * y * E * (3 * ne + 2 * ng)))
}

/** Pre-stressed (equal stress in every leaf): s = 6FL/(nbt²) (M10 slide 10). */
export function leafStressPrestressed(F: number, L: number, b: number, t: number, n: number) {
  return (6 * F * L) / (n * b * t * t)
}

/** Nip (pre-stress gap) h = 2FL³/(nbt³E) (M10 slide 11). */
export function leafNip(F: number, L: number, b: number, t: number, n: number, E: number) {
  return (2 * F * L ** 3) / (n * b * t ** 3 * E)
}

/* ------------------------------ Welds (Module 11) ------------------------------ */

/** AWS allowable shear stress on the throat, 94 MN/m² (M11 slide 20). */
export const WELD_ALLOWABLE = 94e6

/** Butt weld: F = s_t·t·L·e (M11 slide 18). */
export const buttWeldForce = (st: number, t: number, L: number, e = 1) => st * t * L * e

/** Parallel fillet: F = s·w·cos 45°·L = 0.707 s w L (throat at 45°) (M11 slide 20). */
export const filletParallel = (s: number, w: number, L: number) => s * w * Math.cos(PI / 4) * L

/**
 * Transverse fillet: F = s·A/sin 67.5°, A = wL/(cos 67.5° + sin 67.5°) — the throat at 67½°
 * is 0.765w — giving 0.828 s w L (M11 slide 21).
 */
export function filletTransverse(s: number, w: number, L: number) {
  const th = (67.5 * PI) / 180
  const A = (w * L) / (Math.cos(th) + Math.sin(th))
  return (s * A) / Math.sin(th)
}

/** Throat of a fillet at failure angle θ from the leg: t′ = w/(sin θ + cos θ). */
export const filletThroat = (w: number, thetaDeg: number) => w / (Math.sin((thetaDeg * PI) / 180) + Math.cos((thetaDeg * PI) / 180))

/** Weld treated as a line: section modulus of a circular weld round a bar, Z_w = πd²/4 (m²). */
export const circularWeldZ = (d: number) => (PI * d * d) / 4

/**
 * Bar of diameter d welded all round to a plate, load V at arm e (MG15 Q6c, MG17, MG19, MG21):
 * bending f_b = M/Z_w, shear f_s = V/(πd), resultant f, leg w = f/(0.707 s).
 */
export function barWeld(V: number, e: number, d: number, s = WELD_ALLOWABLE) {
  const M = V * e
  const fb = M / circularWeldZ(d)
  const fs = V / (PI * d)
  const f = sqrt(fb * fb + fs * fs)
  return { M, Zw: circularWeldZ(d), fb, fs, f, w: f / (0.707 * s) }
}

/**
 * C-shaped weld (two flanges b, web d) carrying V at arm e from the web, as a line (M11 Example 1):
 * N_y = b²/(2b + d), J_w = (2b + d)³/12 − b²(b + d)²/(2b + d). The worst point is a flange tip.
 */
export function bracketWeld(V: number, e: number, b: number, d: number, s = WELD_ALLOWABLE) {
  const Lw = 2 * b + d
  const Ny = (b * b) / Lw
  const Jw = Lw ** 3 / 12 - (b * b * (b + d) ** 2) / Lw
  const T = V * e
  const fv0 = V / Lw
  const ch = b - Ny // horizontal distance c.g. → flange tip
  const cv = d / 2 // vertical distance
  const fh = (T * cv) / Jw
  const fvT = (T * ch) / Jw
  const f = sqrt(fh * fh + (fv0 + fvT) ** 2)
  return { Lw, Ny, Jw, T, fv0, fh, fvT, f, w: f / (0.707 * s) }
}
