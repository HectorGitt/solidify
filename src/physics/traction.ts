/**
 * Traction mechanics for tyres. Source: Lecture27.pdf (Zoz & Grisso), AEE510.
 * Ratios are dimensionless; loads in N, speeds in m/s.
 */

/** Eq 3: travel reduction ratio (slip) TRR = 1 − Va/Vt. */
export function travelReduction(Va: number, Vt: number) {
  return Vt > 0 ? 1 - Va / Vt : 0
}

/** Eq 4: theoretical speed Vt = rpm·rr·2π/60. */
export function theoreticalSpeedRpm(rpm: number, rr: number) {
  return (rpm * rr * 2 * Math.PI) / 60
}

/** Eq 6: TE = (NTR/GTR)(1 − TRR). */
export function tractiveEfficiencyRatios(NTR: number, GTR: number, TRR: number) {
  return GTR > 0 ? (NTR / GTR) * (1 - TRR) : 0
}

/** Fig 17 regression: NTR = DA(1 − e^(−C0·TRR%)), MRR = TA + AB·TRR%. */
export function regressionTraction(TRR: number, DA = 0.664, C0 = 0.098, TA = 0.09, AB = 0.001) {
  const pct = TRR * 100
  const NTR = DA * (1 - Math.exp(-C0 * pct))
  const MRR = TA + AB * pct
  const GTR = NTR + MRR
  return { NTR, MRR, GTR, TE: tractiveEfficiencyRatios(NTR, GTR, TRR) }
}

export interface BrixiusCoeffs {
  slipExp: number
  lead: number
  bnExp: number
  constant: number
  mrrNum: number
}

/** L27 Table 2. */
export const BRIXIUS: Record<'bias' | 'radial' | 'radialSheet', BrixiusCoeffs> = {
  bias: { slipExp: 7.5, lead: 0.88, bnExp: 0.1, constant: 0.04, mrrNum: 1 },
  radial: { slipExp: 9.5, lead: 0.88, bnExp: 0.1, constant: 0.0325, mrrNum: 0.9 },
  radialSheet: { slipExp: 7.0, lead: 0.88, bnExp: 0.08, constant: 0.03, mrrNum: 1.2 },
}

/** Eq 14: Brixius mobility number. CI Pa, b/d/delta/h m, W N. */
export function mobilityNumber(CI: number, b: number, d: number, W: number, delta: number, h: number) {
  return ((CI * b * d) / W) * ((1 + (5 * delta) / h) / (1 + (3 * b) / d))
}

/** Eqs 15–16 (with Table 2 coefficients): GTR, MRR, NTR and TE at slip s. */
export function brixius(Bn: number, s: number, k: BrixiusCoeffs = BRIXIUS.bias) {
  const GTR = k.lead * (1 - Math.exp(-k.bnExp * Bn)) * (1 - Math.exp(-k.slipExp * s)) + k.constant
  const MRR = k.mrrNum / Bn + 0.04 + (0.5 * s) / Math.sqrt(Bn)
  const NTR = GTR - MRR
  return { GTR, MRR, NTR, TE: tractiveEfficiencyRatios(NTR, GTR, s) }
}

/** Solve slip for a target NTR by bisection (the "iterative solution" of L27 p32). */
export function slipForNTR(Bn: number, NTR: number, k: BrixiusCoeffs = BRIXIUS.bias) {
  let lo = 0
  let hi = 0.99
  if (brixius(Bn, hi, k).NTR < NTR) return NaN
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2
    if (brixius(Bn, mid, k).NTR < NTR) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** L27 p22: dynamic axle loads RWD = RWS + P·Dh/Wb, FWD = FWS − P·Dh/Wb. */
export function axleTransfer(rearStatic: number, frontStatic: number, P: number, Dh: number, Wb: number) {
  const dW = (P * Dh) / Wb
  return { rear: rearStatic + dW, front: frontStatic - dW, dW }
}

/** Exam 2022/23 Q3c: drawbar pull = μ·W. */
export function frictionPull(mu: number, W: number) {
  return mu * W
}

/* ---------------------- appended for the traction lab (L27 p34–44, TT p9–10) ---------------------- */

/** L27 eqs 24–27: W·Vt/P = k/GTR; k = 383 for kg/kW with km/h (375 for lb/hp with mph). */
export const BALLAST_K_SI = 383

/** L27 Table 5 ballast numbers (kg/kW at km/h) at the optimum GTR 0.54. */
export const BALLAST_NUMBERS = { axle: 709, pto: 680, flywheel: 580 } as const

/** Ballast number k/GTR (kg/kW·km/h). */
export function ballastNumber(GTR: number, k = BALLAST_K_SI) {
  return k / GTR
}

/**
 * Tractor mass (kg) for a power (kW) at a travel speed (km/h): mass = number × power / speed,
 * reduced by 0.4·tan(draft angle) for an upward-pulling implement (L27 p43).
 */
export function ballastMass(powerkW: number, speedKmh: number, number: number = BALLAST_NUMBERS.axle, draftAngle = 0) {
  return ((number * powerkW) / speedKmh) * (1 - 0.4 * Math.tan(draftAngle))
}

/** TT p9–10 chalk-mark test: slip = (R2 − R1)/R2, R1 revolutions with no load, R2 with load, same distance. */
export function chalkMarkSlip(R1: number, R2: number) {
  return R2 > 0 ? (R2 - R1) / R2 : 0
}

/** L27 Fig 47: axle power delivery efficiency on concrete / good / medium / poor soil. */
export const AXLE_PDE = {
  '2WD': [0.91, 0.75, 0.7, 0.57],
  MFWD: [0.91, 0.79, 0.75, 0.66],
  '4WD': [0.92, 0.8, 0.78, 0.73],
  Tracks: [0.92, 0.85, 0.83, 0.81],
} as const

/* ------------- appended for the traction lab: power conversions, WSP, wheel offset (L27 p6, p40–43) ------------- */

/** L27 eqs 28–29: axle power = 0.96 × PTO power; PTO power = 0.85 × flywheel power. */
export const AXLE_PER_PTO = 0.96
export const PTO_PER_FLYWHEEL = 0.85

/** L27 p43: tractor weight-to-power ratio = ballast number / no-slip travel speed (same unit system). */
export function weightPerPower(number: number, speed: number) {
  return speed > 0 ? number / speed : Infinity
}

/** L27 p43: theoretical travel speed = ballast number / weight-to-power ratio. */
export function speedForWeightPerPower(number: number, ratio: number) {
  return ratio > 0 ? number / ratio : Infinity
}

/** Inverse of L27 eq 25: the GTR a tractor of mass m (kg) works at, for axle power (kW) at Vt (km/h). */
export function gtrFromWeight(massKg: number, speedKmh: number, powerkW: number, k = BALLAST_K_SI) {
  return massKg > 0 && speedKmh > 0 ? (k * powerkW) / (massKg * speedKmh) : 0
}

/** L27 eq 1: horizontal offset of the soil reaction ahead of the axle, eh = slr·MR/Wd. */
export function reactionOffset(slr: number, MR: number, Wd: number) {
  return Wd > 0 ? (slr * MR) / Wd : 0
}

/** Peak of the Brixius tractive efficiency over slip (grid search, 0.1 % steps). */
export function peakTractiveEfficiency(Bn: number, k: BrixiusCoeffs = BRIXIUS.bias) {
  let best = { slip: 0, NTR: 0, TE: 0 }
  for (let s = 0.001; s < 0.6; s += 0.001) {
    const r = brixius(Bn, s, k)
    if (r.TE > best.TE) best = { slip: s, NTR: r.NTR, TE: r.TE }
  }
  return best
}
