/**
 * Power-train formulas for the M2 scenes: hydrostatic drive (built on ./hydraulics), torque
 * converter, crown wheel & differential, final drives and brakes.
 *
 * Sources:
 *  - AEE510 Power Transmission (PT), Tractor Transmission System (TTS, Bell Ch 5),
 *    Transmission of Power (TOP, Culpin App 2) — mostly qualitative;
 *  - AEE503 Module 9 (brakes) — short-shoe and internal expanding-shoe formulas;
 *  - AEE502 Tractor Mechanics p8 — ≈ 98 % efficiency per gear pair.
 * Anything the notes do not give is marked BEYOND NOTES in its doc comment.
 *
 * SI units unless stated: N, m, N·m, rad, rad/s; speeds in rpm where noted.
 */

import { hydraulicPower, motor, pump, theoreticalTorque } from './hydraulics'

const { PI } = Math
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ================================ Hydrostatic drive ================================ */

/**
 * Displacement of an axial-piston swashplate unit (cm³/rev): D = z·(π/4)d²·2R·tan β.
 * Signed: a negative swashplate angle reverses the flow. BEYOND NOTES (PT p8 is qualitative).
 */
export function axialPistonDisplacement(pistons: number, boreM: number, pitchRadiusM: number, swashRad: number) {
  return pistons * (PI / 4) * boreM ** 2 * 2 * pitchRadiusM * Math.tan(swashRad) * 1e6
}

/** Piston position along the axis (m, from mid-stroke) for a piston at angle φ on the barrel. */
export function pistonOffset(pitchRadiusM: number, swashRad: number, phi: number) {
  return pitchRadiusM * Math.tan(swashRad) * Math.cos(phi)
}

export interface HydrostaticInput {
  /** pump displacement, cm³/rev (signed: negative = reverse) */
  Dp: number
  /** motor displacement, cm³/rev (> 0) */
  Dm: number
  /** pump (engine) speed, rpm */
  Np: number
  /** loop pressure difference, MPa */
  dp: number
  pumpEtaV: number
  pumpEtaT: number
  motorEtaV: number
  motorEtaT: number
}

export interface HydrostaticResult {
  /** pump theoretical and actual delivery, L/min (signed) */
  QT: number
  QA: number
  /** pump shaft torque, N·m (≥ 0) */
  pumpTorque: number
  /** pump shaft power and hydraulic power, kW */
  inputPower: number
  hydraulicPower: number
  /** motor speed, rpm (signed), torque N·m (≥ 0), power kW */
  motorSpeed: number
  motorTorque: number
  outputPower: number
  /** overall efficiency (pump × motor) */
  eta: number
  /** heat put into the oil, kW */
  heat: number
  /** N_motor / N_pump and T_motor / T_pump */
  speedRatio: number
  torqueRatio: number
}

/**
 * Pump → motor closed loop. Pump: Q_A = η_v·D·N/1000, T = Δp·D/(2π·η_T). Motor: N = η_v·Q·1000/D,
 * T = η_T·Δp·D/2π (AEE502 2016/17 & 2017/18 marking guides; pump/motor table). Flow direction
 * follows the sign of the pump displacement (PT p8: flow direction → travel direction).
 */
export function hydrostaticDrive(i: HydrostaticInput): HydrostaticResult {
  const sign = Math.sign(i.Dp)
  const Dp = Math.abs(i.Dp)
  const p = pump(Dp, i.Np, i.dp, i.pumpEtaV, i.pumpEtaT)
  const m = Dp > 0 && i.Dm > 0 ? motor(i.Dm, p.QA, i.dp, i.motorEtaV, i.motorEtaT) : { N: 0, TA: 0, P: 0 }
  const inputPower = Dp > 0 ? p.Ps : 0
  const eta = inputPower > 0 ? m.P / inputPower : 0
  return {
    QT: sign * p.QT,
    QA: sign * p.QA,
    pumpTorque: Dp > 0 ? p.TA : 0,
    inputPower,
    hydraulicPower: Dp > 0 ? hydraulicPower(p.QA, i.dp) : 0,
    motorSpeed: sign * m.N,
    motorTorque: Dp > 0 ? m.TA : 0,
    outputPower: m.P,
    eta,
    heat: inputPower - m.P,
    speedRatio: i.Np > 0 ? (sign * m.N) / i.Np : 0,
    torqueRatio: p.TA > 0 && Dp > 0 ? m.TA / p.TA : 0,
  }
}

/** Ideal (loss-free) motor speed for a pump/motor pair: N_m = N_p·D_p/D_m. */
export function idealMotorSpeed(Np: number, Dp: number, Dm: number) {
  return Dm > 0 ? (Np * Dp) / Dm : 0
}

/** Ideal motor torque for a loop pressure: T = Δp·D/2π (N·m, Δp in MPa, D in cm³/rev). */
export const idealMotorTorque = theoreticalTorque

export type HydroCombo = 'FDP-FDM' | 'VDP-FDM' | 'FDP-VDM' | 'VDP-VDM'

/** The four pump/motor combinations (PT p8, exam 2022/23 Q4). */
export const HYDRO_COMBOS: Record<HydroCombo, { pumpVariable: boolean; motorVariable: boolean; label: string; note: string }> = {
  'FDP-FDM': {
    pumpVariable: false,
    motorVariable: false,
    label: 'Fixed pump → fixed motor',
    note: 'Simplest and cheapest. Motor speed is set only by engine speed; it behaves like a fixed ratio.',
  },
  'VDP-FDM': {
    pumpVariable: true,
    motorVariable: false,
    label: 'Variable pump → fixed motor',
    note: 'The usual tractor arrangement: tilting the pump swashplate sets speed and direction from one lever.',
  },
  'FDP-VDM': {
    pumpVariable: false,
    motorVariable: true,
    label: 'Fixed pump → variable motor',
    note: 'Speed set by the motor angle: a small motor angle gives high speed and low torque. Cannot reverse by itself.',
  },
  'VDP-VDM': {
    pumpVariable: true,
    motorVariable: true,
    label: 'Variable pump → variable motor',
    note: 'Best performance (widest speed and torque range) but the most complex and expensive.',
  },
}

/* ================================ Torque converter ================================ */

export interface ConverterSpec {
  /** torque ratio at stall (turbine held), typically 2–2.5 */
  stallRatio: number
  /** speed ratio at the coupling point, where the stator starts to freewheel */
  couplingSR: number
  /** largest speed ratio reached (slip never quite vanishes) */
  maxSR: number
}

/** Typical tractor/loader converter. BEYOND NOTES: PT p8–11 describe it only qualitatively. */
export const TYPICAL_CONVERTER: ConverterSpec = { stallRatio: 2.2, couplingSR: 0.85, maxSR: 0.97 }

/**
 * Torque ratio TR = T_turbine / T_impeller vs speed ratio SR = N_turbine / N_impeller.
 * Converter range (stator held by its one-way clutch): TR falls linearly from the stall ratio to 1
 * at the coupling point. Coupling range (stator freewheels): TR = 1, a plain fluid coupling.
 * BEYOND NOTES (idealised characteristic).
 */
export function converterTorqueRatio(SR: number, c: ConverterSpec = TYPICAL_CONVERTER) {
  const s = clamp(SR, 0, c.maxSR)
  if (s >= c.couplingSR) return 1
  return c.stallRatio - ((c.stallRatio - 1) * s) / c.couplingSR
}

/** Efficiency η = TR·SR (output power / input power). BEYOND NOTES. */
export function converterEfficiency(SR: number, c: ConverterSpec = TYPICAL_CONVERTER) {
  return converterTorqueRatio(SR, c) * clamp(SR, 0, c.maxSR)
}

/** Stator is held by the one-way clutch below the coupling point and freewheels above it (PT p10). */
export function statorHeld(SR: number, c: ConverterSpec = TYPICAL_CONVERTER) {
  return SR < c.couplingSR
}

/**
 * Share of the oil's motion that is vortex flow (round the torus, pump → turbine → stator) as
 * opposed to rotary flow (round the axis with the casing). Vortex flow is driven by the speed
 * difference: all vortex at stall, almost none near lock-up (PT p10).
 */
export function vortexShare(SR: number) {
  return clamp(1 - SR, 0, 1)
}

/** Speed ratio at which converter efficiency peaks in the converter range. BEYOND NOTES. */
export function converterPeak(c: ConverterSpec = TYPICAL_CONVERTER) {
  // η = s(a − b s), a = TR0, b = (TR0 − 1)/SRc → peak at s = a/2b
  const a = c.stallRatio
  const b = (c.stallRatio - 1) / c.couplingSR
  const s = Math.min(c.couplingSR, a / (2 * b))
  return { SR: s, eta: converterEfficiency(s, c) }
}

/* ================================ Crown wheel & differential ================================ */

/** Crown wheel & pinion reduction: i = z_crown / z_pinion (TTS p7; gear rule D·N = d·n, TOP p3). */
export function crownWheelRatio(zPinion: number, zCrown: number) {
  return zCrown / zPinion
}

/** Differential cage speed is the mean of the wheel speeds: N_case = (N_L + N_R)/2 (TTS p8, PT p11). */
export function diffCaseSpeed(nLeft: number, nRight: number) {
  return (nLeft + nRight) / 2
}

export type DiffMode = 'straight' | 'cornering' | 'held'

export interface DiffWheelSpeeds {
  left: number
  right: number
}

/**
 * Wheel speeds for a given cage speed.
 *  - straight: both = cage (pinions do not spin);
 *  - cornering (turning left, radius R to the tractor centre, track t): each wheel's speed is
 *    proportional to its path radius, N_inner/N_outer = (R − t/2)/(R + t/2) (BEYOND NOTES geometry);
 *  - held: left wheel held, right turns at twice cage speed (TTS p8);
 *  - locked: diff lock forces both to cage speed whatever the mode (TTS p8, PT p12).
 */
export function diffWheelSpeeds(nCase: number, mode: DiffMode, locked: boolean, turnRadius = 6, track = 1.5): DiffWheelSpeeds {
  if (locked || mode === 'straight') return { left: nCase, right: nCase }
  if (mode === 'held') return { left: 0, right: 2 * nCase }
  const R = Math.max(turnRadius, track / 2)
  return { left: (nCase * (R - track / 2)) / R, right: (nCase * (R + track / 2)) / R }
}

/** Spin of the planet (spider) pinions on their cross-pin, relative to the cage: (N_L − N_R)/2 · z_side/z_planet. */
export function spiderSpin(nLeft: number, nRight: number, zSide: number, zSpider: number) {
  return ((nLeft - nRight) / 2) * (zSide / zSpider)
}

/**
 * Torque reaching each half shaft. An open differential always divides torque equally, so
 * both sides are limited by the wheel with less grip. A locked differential lets the wheel
 * with grip take the rest. BEYOND NOTES (the notes give the speed rule only).
 */
export function diffTorqueSplit(Tcase: number, locked: boolean, gripLeft = Infinity, gripRight = Infinity) {
  if (!locked) {
    const each = Math.min(Tcase / 2, gripLeft, gripRight)
    return { left: each, right: each, delivered: 2 * each }
  }
  let left = Math.min(Tcase / 2, gripLeft)
  let right = Math.min(Tcase / 2, gripRight)
  const spare = Tcase - left - right
  if (spare > 0) {
    if (gripLeft > left) left = Math.min(gripLeft, left + spare)
    else if (gripRight > right) right = Math.min(gripRight, right + spare)
  }
  return { left, right, delivered: left + right }
}

/* ================================ Final drives & reductions ================================ */

/** Spur (pinion) final reduction: i = z_gear / z_pinion. */
export function spurReduction(zPinion: number, zGear: number) {
  return zGear / zPinion
}

/**
 * Epicyclic final reduction, sun driven, ring held, carrier to the wheel: i = 1 + z_ring/z_sun.
 * PT p6 says the carrier then turns the same way as the sun, but slower; the ratio itself is
 * BEYOND NOTES (Willis equation; TOP p4 says epicyclic ratios are "not discussed here").
 */
export function epicyclicReduction(zSun: number, zRing: number) {
  return 1 + zRing / zSun
}

/** Ring teeth for a simple planetary set to assemble: z_ring = z_sun + 2·z_planet. */
export function ringTeeth(zSun: number, zPlanet: number) {
  return zSun + 2 * zPlanet
}

/** Efficiency per gear pair ≈ 0.98 (AEE502 Tractor Mechanics p8: 0.98⁵ ≈ 90 % for five pairs). */
export const GEAR_PAIR_EFFICIENCY = 0.98

export interface Stage {
  name: string
  ratio: number
  /** gear pairs in mesh in this stage */
  pairs: number
}

export interface StageRow extends Stage {
  /** speed after the stage, rpm */
  rpm: number
  /** torque after the stage, N·m */
  torque: number
  /** cumulative reduction from the engine */
  overall: number
  /** cumulative efficiency */
  eta: number
}

/**
 * Speed and torque after each reduction: N ÷ i, T × i × η^pairs. Torque rises at three points
 * — gearbox, crown wheel & pinion, final reduction (TTS p10).
 */
export function reductionTable(engineRpm: number, engineTorque: number, stages: Stage[], etaPair = GEAR_PAIR_EFFICIENCY): StageRow[] {
  let rpm = engineRpm
  let torque = engineTorque
  let overall = 1
  let eta = 1
  return stages.map((s) => {
    const e = etaPair ** s.pairs
    rpm /= s.ratio
    torque *= s.ratio * e
    overall *= s.ratio
    eta *= e
    return { ...s, rpm, torque, overall, eta }
  })
}

/** Ground speed (km/h) from wheel rpm and rolling radius (m): v = 2πrN·60/1000. */
export function groundSpeedKmh(wheelRpm: number, radius: number) {
  return (2 * PI * radius * wheelRpm * 60) / 1000
}

/** Shaft power P = 2πNT/60 (W). */
export function shaftPower(rpm: number, torque: number) {
  return (2 * PI * rpm * torque) / 60
}

/**
 * Brake torque needed on a shaft that turns i times faster than the wheel: T_brake = T_wheel / i.
 * This is why the brakes sit on the fast, low-torque shaft between the differential and the
 * final reduction (TTS p11).
 */
export function brakeTorqueOnShaft(wheelTorque: number, ratioToWheel: number) {
  return wheelTorque / ratioToWheel
}

/* ================================ Brakes ================================ */

export interface ShortShoeInput {
  /** braking torque required, N·m */
  T: number
  f: number
  /** drum radius, m */
  R: number
  /** pivot → line of the normal force, m */
  a: number
  /** pivot → line of the lever force F, m */
  b: number
  /** pivot offset along the friction force, m */
  c: number
}

/**
 * Single block (short shoe) brake on a pivoted lever (AEE503 M9, Fig 15-10):
 * N = T/(fR), F·b = N·a ∓ f·N·c (− when the friction helps apply the shoe).
 * Self-locking when the friction moment exceeds N·a, i.e. c ≥ a/f.
 */
export function shortShoeBrake(i: ShortShoeInput) {
  const N = i.T / (i.f * i.R)
  const Ff = i.f * N
  const Fhelped = (N * i.a - Ff * i.c) / i.b
  const Fopposed = (N * i.a + Ff * i.c) / i.b
  return { N, Ff, Fhelped, Fopposed, selfLockC: i.a / i.f }
}

export interface ExpandingShoeGeometry {
  /** drum radius r, m */
  r: number
  /** lining width w, m */
  w: number
  /** pivot distance from the drum centre a, m */
  a: number
  /** distance from the pivot to the line of the actuating force c, m */
  c: number
  f: number
  /** lining start and end angles, measured from the line centre → pivot, rad */
  theta1: number
  theta2: number
}

/** sin θ_m: θ_m = 90° if the lining passes 90°, else θ_m = θ2 (max pressure position). */
export function sinThetaMax(g: Pick<ExpandingShoeGeometry, 'theta2'>) {
  return g.theta2 >= PI / 2 ? 1 : Math.sin(g.theta2)
}

/**
 * Moments about the pivot per unit maximum pressure p_m (AEE503 M9):
 *  M_f = (f·w·r/sin θm) ∫ sin θ (r − a cos θ) dθ,  M_n = (w·r·a/sin θm) ∫ sin²θ dθ,
 *  T   = f·w·r²(cos θ1 − cos θ2)/sin θm.
 */
export function shoeMomentsPerPressure(g: ExpandingShoeGeometry) {
  const { r, w, a, f, theta1: t1, theta2: t2 } = g
  const s = sinThetaMax(g)
  const intF = r * (Math.cos(t1) - Math.cos(t2)) - (a / 2) * (Math.sin(t2) ** 2 - Math.sin(t1) ** 2)
  const intN = (t2 - t1) / 2 - (Math.sin(2 * t2) - Math.sin(2 * t1)) / 4
  return {
    Mf: (f * w * r * intF) / s,
    Mn: (w * r * a * intN) / s,
    T: (f * w * r * r * (Math.cos(t1) - Math.cos(t2))) / s,
  }
}

/**
 * Two-shoe internal expanding brake with the same actuating force F on both shoes (AEE503 M9).
 * Leading (self-energising) shoe: F·c = M_n − M_f; trailing shoe: F·c = M_n + M_f.
 * Total torque T = f·w·r²(cos θ1 − cos θ2)(p_m + p_m′)/sin θm.
 */
export function expandingShoeBrake(F: number, g: ExpandingShoeGeometry) {
  const m = shoeMomentsPerPressure(g)
  const leadDen = m.Mn - m.Mf
  const selfLocking = leadDen <= 0
  const pLead = selfLocking ? Infinity : (F * g.c) / leadDen
  const pTrail = (F * g.c) / (m.Mn + m.Mf)
  const TLead = m.T * pLead
  const TTrail = m.T * pTrail
  return { pLead, pTrail, TLead, TTrail, T: TLead + TTrail, selfLocking, perPressure: m }
}

/** Pressure distribution on a long shoe: p = p_m·sin θ / sin θm (AEE503 M9). */
export function shoePressure(pMax: number, theta: number, g: Pick<ExpandingShoeGeometry, 'theta2'>) {
  return (pMax * Math.sin(theta)) / sinThetaMax(g)
}

export interface BallRampInput {
  /** tangential pull of the actuating link at the ball radius, N */
  P: number
  /** ramp (ball-seat) angle, rad */
  rampAngle: number
  /** ball pitch radius, m */
  rBall: number
  /** friction radius of the linings, m */
  rFriction: number
  f: number
  /** friction surfaces */
  surfaces: number
}

/**
 * Ball-ramp (expander) dry disc brake, TOP p9 Fig A2.14 / TTS Fig 37. The link turns the two
 * actuating discs apart; balls climbing the tapered grooves give F₀ = P/tan α. Once the discs
 * grip, friction drags an actuating disc further round, adding f·F·R_f/r_b of pull, so
 * F = P/(tan α − f·R_f/r_b): self-energising, and self-locking if tan α ≤ f·R_f/r_b.
 * The notes state that the degree depends on the friction coefficient and the ball-seat angle;
 * the formula is BEYOND NOTES.
 */
export function ballRampBrake(i: BallRampInput) {
  const t = Math.tan(i.rampAngle)
  const servo = (i.f * i.rFriction) / i.rBall
  const F0 = i.P / t
  const selfLocking = t <= servo
  const F = selfLocking ? Infinity : i.P / (t - servo)
  const T = i.surfaces * i.f * F * i.rFriction
  return { F0, F, T, servoFactor: selfLocking ? Infinity : t / (t - servo), selfLocking }
}

/**
 * Hydraulically applied wet multi-plate brake: F = p·A_piston − F_return, T = n·f·F·R_f
 * (same capacity law as the multi-plate clutch, AEE503 M8; wet plates, TOP p9).
 */
export function wetPlateBrake(pPa: number, pistonArea: number, returnForce: number, f: number, rFriction: number, surfaces: number) {
  const F = Math.max(0, pPa * pistonArea - returnForce)
  return { F, T: surfaces * f * F * rFriction }
}

/** Rate of heat generation H = T·ω (W) — AEE503 M9: H_g = p_av·A·f·V. */
export function brakeHeat(T: number, rpm: number) {
  return shaftPower(rpm, T)
}
