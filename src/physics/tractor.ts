/**
 * Ideal and lossy tractor speed / force / power analysis.
 * Source: Tractor Mechanics AEE502.pdf (Macmillan Ch. 2), eqs 2.1–2.15. SI units throughout:
 * speeds in rev/s or m/s unless the name says otherwise.
 */

const TAU = 2 * Math.PI

/** Eq 2.1: wheel speed (rev/s) from engine speed (rev/s) and overall ratio q. */
export function wheelSpeed(Ne: number, q: number) {
  return Ne / q
}

/** Eq 2.1: theoretical (no-slip) travel speed V0 = πD·Ne/q, m/s. */
export function theoreticalSpeed(D: number, Ne: number, q: number) {
  return (Math.PI * D * Ne) / q
}

/** Eq 2.2: ideal wheel torque Tw = q·Te. */
export function wheelTorque(Te: number, q: number) {
  return q * Te
}

/** Eq 2.2: ideal pull P = H = 2q·Te/D, N. */
export function idealPull(Te: number, q: number, D: number) {
  return (2 * q * Te) / D
}

/** Eq 2.3: engine power Qe = 2π·Te·Ne, W (Ne in rev/s). */
export function enginePower(Te: number, Ne: number) {
  return TAU * Te * Ne
}

/** Eq 2.5: wheelslip i = (V0 − V)/V0. */
export function slip(V0: number, V: number) {
  return V0 > 0 ? (V0 - V) / V0 : 0
}

/** Eq 2.6: actual speed V = V0(1 − i). */
export function actualSpeed(V0: number, i: number) {
  return V0 * (1 - i)
}

/** Eq 2.8: power loss = slip loss H·V0·i + rolling-resistance loss R·V. */
export function powerLosses(H: number, R: number, V0: number, i: number) {
  const V = V0 * (1 - i)
  const slipLoss = H * V0 * i
  const rollingLoss = R * V
  return { slipLoss, rollingLoss, total: slipLoss + rollingLoss }
}

/** Eq 2.10: tractive efficiency ηt = (P/(P+R))(1 − i). */
export function tractiveEfficiency(P: number, R: number, i: number) {
  return P + R > 0 ? (P / (P + R)) * (1 - i) : 0
}

/** Eq 2.13: engine efficiency ηe = 2π·Te·Ne/(1000·FC·C); FC kg/min, C kJ/kg, Ne rev/min. */
export function engineEfficiency(Te: number, NeRpm: number, FCkgPerMin: number, CkJPerKg: number) {
  return (TAU * Te * NeRpm) / (1000 * FCkgPerMin * CkJPerKg)
}

/** Eq 2.14: overall efficiency. */
export function overallEfficiency(etaEngine: number, etaTransmission: number, etaTractive: number) {
  return etaEngine * etaTransmission * etaTractive
}

/** MECH p8: ≈98% per gear pair, e.g. 5 pairs → 0.98⁵ ≈ 0.90. */
export function gearTrainEfficiency(pairs: number, perPair = 0.98) {
  return perPair ** pairs
}

/** Eq 2.15: tractive coefficient ψ = pull / weight on driving wheels. */
export function tractiveCoefficient(P: number, Wdriving: number) {
  return P / Wdriving
}

/* ----------------------- "Farmland" tractor (MECH p4, Fig 2.2) ----------------------- */

/** Engine curve (rpm, N·m) from Australian Test Report No 78 (Leyland 253), MECH p4. */
export const FARMLAND_ENGINE: EngineCurve = [
  [1000, 171],
  [1300, 173],
  [1730, 161],
  [2250, 142],
  [2325, 120],
  [2350, 80],
  [2370, 40],
  [2390, 0],
]

/** Overall ratios q for gears 3, 5 and 7 (MECH p4). */
export const FARMLAND_GEARS: Record<number, number> = { 3: 139.5, 5: 85.6, 7: 47.3 }

/** Rear wheel diameter implied by the MECH p4 table (≈ 1.26 m). */
export const FARMLAND_D = 1.26

export type EngineCurve = ReadonlyArray<readonly [number, number]>

/** Engine torque (N·m) at speed (rpm) by linear interpolation of a (rpm, N·m) curve. */
export function torqueAt(curve: EngineCurve, rpm: number) {
  if (rpm <= curve[0][0]) return curve[0][1]
  if (rpm >= curve[curve.length - 1][0]) return curve[curve.length - 1][1]
  for (let k = 1; k < curve.length; k++) {
    if (rpm <= curve[k][0]) {
      const [n0, t0] = curve[k - 1]
      const [n1, t1] = curve[k]
      return t0 + ((rpm - n0) / (n1 - n0)) * (t1 - t0)
    }
  }
  return 0
}

export const farmlandTorque = (rpm: number) => torqueAt(FARMLAND_ENGINE, rpm)

/** Ideal speed–pull curve in one gear: points (pull kN, speed km/h) along the engine curve. */
export function idealGearCurve(q: number, D = FARMLAND_D, curve: EngineCurve = FARMLAND_ENGINE) {
  return curve.map(([rpm, T]) => ({
    rpm,
    pullkN: idealPull(T, q, D) / 1000,
    speedKmh: theoreticalSpeed(D, rpm / 60, q) * 3.6,
  }))
}

/** Constant-power envelope (stepless transmission): speed km/h at pull kN for power kW. */
export function powerEnvelopeSpeed(pullkN: number, powerkW: number) {
  return (powerkW / pullkN) * 3.6
}

/** Maximum power (kW) on an engine curve. */
export function maxPower(curve: EngineCurve = FARMLAND_ENGINE) {
  let best = 0
  for (let rpm = curve[0][0]; rpm <= curve[curve.length - 1][0]; rpm += 5) best = Math.max(best, (2 * Math.PI * torqueAt(curve, rpm) * rpm) / 60 / 1000)
  return best
}

/**
 * Operating point with losses: given pull P (N), rolling resistance R (N), slip i, gear q and
 * wheel diameter D, find engine torque/speed on the governed engine curve and the outputs.
 * Assumes transmission efficiency etaR (MECH eq 2.12: geared drives lose torque, not speed).
 */
export function operatingPoint(P: number, R: number, i: number, q: number, D: number, etaR = 0.9, curve: EngineCurve = FARMLAND_ENGINE) {
  const H = P + R // eq 2.7
  const Tw = (H * D) / 2
  const Te = Tw / (q * etaR)
  // engine speed where the curve delivers Te (curve torque falls with rpm above peak)
  let rpm = curve[curve.length - 1][0]
  for (let n = curve[curve.length - 1][0]; n >= curve[0][0]; n -= 1) {
    if (torqueAt(curve, n) >= Te) {
      rpm = n
      break
    }
    if (n === curve[0][0]) rpm = NaN // stalled
  }
  const Ne = rpm / 60
  const V0 = theoreticalSpeed(D, Ne, q)
  const V = actualSpeed(V0, i)
  const Qe = enginePower(Te, Ne)
  const Qd = P * V
  return {
    H,
    Tw,
    Te,
    rpm,
    V0,
    V,
    Qe,
    Qd,
    stalled: Number.isNaN(rpm),
    etaT: tractiveEfficiency(P, R, i),
    losses: powerLosses(H, R, V0, i),
  }
}
