/**
 * Input-coupled hydro-mechanical power-split CVT (the layout of the Fendt Vario family).
 *
 * The engine drives the planet CARRIER of a simple planetary set. The power splits there:
 *  - the SUN drives the output (summing) shaft directly — the mechanical branch;
 *  - the RING drives a variable axial-piston PUMP (gear ratio kr), whose oil drives a variable
 *    MOTOR geared to the same output shaft (ratio km) — the hydraulic branch.
 *
 * Kinematics (Willis): z_s·ω_o + z_r·ω_r = (z_s + z_r)·ω_e
 * Oil continuity (ideal): α·V·(kr·ω_r) = β·V·(km·ω_o), α = pump and β = motor displacement fractions.
 *
 * One drive lever L sweeps the ratio: phase 1 (0 ≤ L ≤ 1) swings the pump out (α = L, β = 1) from
 * active standstill; phase 2 (1 < L ≤ 2) swings the motor back (α = 1, β = 2 − L) until at L = 2 the
 * motor has no displacement, the ring and pump stop and all power goes through the gears. L < 0
 * swings the pump the other way for reverse. Values are typical, not a specific model.
 */

export interface CvtSpec {
  zs: number
  zp: number
  zr: number
  /** pump speed / ring speed */
  kr: number
  /** motor speed / output speed */
  km: number
  /** full displacement of each unit, m³/rev */
  V: number
  /** combined pump × motor efficiency of the hydraulic branch */
  etaHyd: number
  /** gear-branch efficiency */
  etaMech: number
  /** drive-lever limits */
  leverMin: number
  leverMax: number
  /** relief pressure, Pa */
  dpMax: number
}

export const CVT: CvtSpec = {
  zs: 42,
  zp: 18,
  zr: 78,
  kr: 72 / 48,
  km: 1,
  V: 181e-6,
  etaHyd: 0.84,
  etaMech: 0.97,
  leverMin: -0.35,
  leverMax: 2,
  dpMax: 50e6,
}

/** Pump (α) and motor (β) displacement fractions for a drive-lever position. */
export function swash(L: number, s: CvtSpec = CVT) {
  const l = Math.min(s.leverMax, Math.max(s.leverMin, L))
  if (l <= 1) return { alpha: l, beta: 1 }
  return { alpha: 1, beta: 2 - l }
}

/**
 * Speed ratio ω_output / ω_engine. At α = 0 (active standstill) the output is held by the motor
 * however fast the engine runs; at β = 0 it is (z_s + z_r)/z_s, pure gear drive.
 */
export function outputRatio(alpha: number, beta: number, s: CvtSpec = CVT) {
  // z_s·ω_o + z_r·ω_r = (z_s+z_r)ω_e with ω_r = (β·km/(α·kr))·ω_o  →  multiply through by α·kr
  const den = s.zs * alpha * s.kr + s.zr * beta * s.km
  if (Math.abs(den) < 1e-12) return 0
  return ((s.zs + s.zr) * alpha * s.kr) / den
}

/** Ring speed / engine speed. */
export function ringRatio(alpha: number, beta: number, s: CvtSpec = CVT) {
  return ((s.zs + s.zr) - s.zs * outputRatio(alpha, beta, s)) / s.zr
}

/** All shaft speeds (rad/s) for an engine speed. */
export function speeds(L: number, omegaE: number, s: CvtSpec = CVT) {
  const { alpha, beta } = swash(L, s)
  const out = outputRatio(alpha, beta, s) * omegaE
  const ring = ringRatio(alpha, beta, s) * omegaE
  return { alpha, beta, engine: omegaE, out, ring, pump: s.kr * ring, motor: s.km * out }
}

/** Planet spin (absolute) for drawing. */
export function planetOmega(omegaSun: number, omegaCarrier: number, s: CvtSpec = CVT) {
  return omegaCarrier - (s.zs / s.zp) * (omegaSun - omegaCarrier)
}

/** Drive-lever position giving an output/engine ratio (bisection; the ratio rises monotonically with L). */
export function leverForRatio(ratio: number, s: CvtSpec = CVT) {
  const f = (L: number) => {
    const { alpha, beta } = swash(L, s)
    return outputRatio(alpha, beta, s)
  }
  let lo = s.leverMin
  let hi = s.leverMax
  if (ratio <= f(lo)) return lo
  if (ratio >= f(hi)) return hi
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < ratio) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Torques and power flow for an output torque T_o (N·m, at the summing shaft).
 * Ideal split: T_s = T_c·z_s/(z_s+z_r), T_r = T_c·z_r/(z_s+z_r); the motor adds the rest of T_o.
 * The hydraulic share h is the fraction of output power carried by the oil; h > 1 means power
 * circulates (the gear branch runs backwards), as it does in reverse.
 */
export function powerFlow(L: number, omegaE: number, To: number, s: CvtSpec = CVT) {
  const sp = speeds(L, omegaE, s)
  const { alpha, beta } = sp
  // ideal: T_o = T_s·(1 + (z_r/z_s)·(β·km)/(α·kr))
  const k = Math.abs(alpha) < 1e-9 ? Infinity : (s.zr / s.zs) * ((beta * s.km) / (alpha * s.kr))
  const Ts = Number.isFinite(k) ? To / (1 + k) : 0
  const Tr = (s.zr / s.zs) * Ts
  const Tmotor = (To - Ts) / s.km
  const Tpump = Tr / s.kr
  // loop pressure from whichever unit has displacement
  const dp = Math.abs(alpha) > 0.05 ? (2 * Math.PI * Tpump) / (alpha * s.V) : beta > 1e-6 ? (2 * Math.PI * Tmotor) / (beta * s.V) : 0
  const hydShare = To === 0 ? (Number.isFinite(k) ? k / (1 + k) : 1) : (To - Ts) / To
  const Pout = To * sp.out
  const Phyd = hydShare * Pout
  const Pmech = Pout - Phyd
  const loss = Math.abs(Pmech) * (1 / s.etaMech - 1) + Math.abs(Phyd) * (1 / s.etaHyd - 1)
  const Pin = Pout + loss
  const efficiency = Pin > 1e-6 ? Pout / Pin : 0
  return {
    ...sp,
    To,
    Ts,
    Tr,
    Tmotor,
    Tpump,
    Te: Pin / Math.max(1e-6, omegaE),
    dp,
    hydShare,
    Pout,
    Phyd,
    Pmech,
    Pin,
    efficiency,
  }
}

/** Overall efficiency at a lever position (independent of torque in this model). */
export function efficiencyAt(L: number, s: CvtSpec = CVT) {
  const r = powerFlow(L, 200, 1000, s)
  return r.efficiency
}

/* ------------------------------ Tractor application ------------------------------ */

export interface CvtTractor {
  /** mass, kg */
  mass: number
  /** rolling radius, m */
  r: number
  /** rolling-resistance coefficient */
  rr: number
  /** output shaft → wheel ratio for the field and road ranges */
  iField: number
  iRoad: number
  etaFinal: number
  /** engine: rated power W at rated rpm, torque ceiling N·m */
  Prated: number
  nRated: number
  Tpeak: number
}

/** Ranges sized so the top of each range is 30 and 60 km/h at rated speed. */
function rangeRatio(vmaxKmh: number, nRated: number, r: number, s: CvtSpec = CVT) {
  const wo = outputRatio(1, 0, s) * ((nRated * 2 * Math.PI) / 60)
  return wo / (vmaxKmh / 3.6 / r)
}

export const TRACTOR: CvtTractor = {
  mass: 9000,
  r: 0.85,
  rr: 0.05,
  iField: rangeRatio(30, 2100, 0.85),
  iRoad: rangeRatio(60, 2100, 0.85),
  etaFinal: 0.95,
  Prated: 200e3,
  nRated: 2100,
  Tpeak: 1100,
}

/** Engine power available at a speed: torque-limited below rated, power-limited at rated. */
export const enginePower = (rpm: number, t: CvtTractor = TRACTOR) => Math.min(t.Prated, (t.Tpeak * rpm * 2 * Math.PI) / 60)

/** Ground speed (km/h) for an output-shaft speed (rad/s) in a range. */
export const groundSpeed = (omegaOut: number, range: 'field' | 'road', t: CvtTractor = TRACTOR) => (omegaOut / (range === 'field' ? t.iField : t.iRoad)) * t.r * 3.6

export interface DriveState {
  rpm: number
  range: 'field' | 'road'
  /** requested ground speed, km/h (negative = reverse) */
  target: number
  /** drawbar pull, N */
  pull: number
}

/**
 * Operating point: the lever that gives the requested speed, then the engine load. If the engine
 * cannot supply the power, the transmission controller lowers the ratio until it can (that is
 * what the "limit load" control of a CVT tractor does) — the tractor slows instead of stalling.
 */
export function operate(d: DriveState, t: CvtTractor = TRACTOR, s: CvtSpec = CVT) {
  const we = (d.rpm * 2 * Math.PI) / 60
  const i = d.range === 'field' ? t.iField : t.iRoad
  const resist = d.pull + t.rr * t.mass * 9.81
  const wheelTorque = resist * t.r
  const sign = d.target < 0 ? -1 : 1
  const To = (sign * wheelTorque) / (i * t.etaFinal)
  const avail = enginePower(d.rpm, t)
  const at = (v: number) => {
    const wo = (v / 3.6 / t.r) * i
    const L = leverForRatio(wo / we, s)
    return { L, pf: powerFlow(L, we, To, s) }
  }
  let v = d.target
  let r = at(v)
  let limited = false
  if (r.pf.Pin > avail) {
    limited = true
    let lo = 0
    let hi = v
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2
      if (at(mid).pf.Pin > avail) hi = mid
      else lo = mid
    }
    v = lo
    r = at(v)
  }
  const actual = groundSpeed(r.pf.out, d.range, t)
  return { ...r.pf, L: r.L, speed: actual, limited, avail, resist, wheelTorque, pressureLimited: Math.abs(r.pf.dp) > s.dpMax }
}
