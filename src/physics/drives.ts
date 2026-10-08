/**
 * Power-train drives for the M2 scenes (hydrostatic, torque converter, differential, final
 * drives, brakes). Builds on ./transmission (the core formulas) and ./hydraulics (pump/motor).
 *
 * Sources: AEE510 Power Transmission (PT), Tractor Transmission System (TTS, Bell Ch 5),
 * Transmission of Power (TOP, Culpin App 2); AEE503 Module 9 (brakes). Anything the notes do
 * not give is marked BEYOND NOTES. SI units unless stated; speeds in rpm where named.
 */

import { axialPistonDisplacement, converterEfficiency, converterTorqueRatio, hydrostaticDrive, reductionTable, statorHeld, TYPICAL_CONVERTER, type ConverterSpec, type HydroCombo, type HydrostaticResult, type Stage } from './transmission'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ================================ Hydrostatic drive ================================ */

/** Axial-piston unit geometry: z pistons of bore d on pitch radius R, swashplate up to βmax. */
export interface PistonUnit {
  pistons: number
  bore: number
  pitchR: number
  /** maximum swashplate angle, rad */
  maxAngle: number
}

/** Displacement (cm³/rev) at a swashplate angle (signed). BEYOND NOTES: D = z·(π/4)d²·2R·tan β. */
export const unitDisplacement = (u: PistonUnit, angle: number) => axialPistonDisplacement(u.pistons, u.bore, u.pitchR, clamp(angle, -u.maxAngle, u.maxAngle))

export interface ComboSetting {
  /** pump swashplate lever −1…1 (fraction of βmax; negative = reverse). Ignored for a fixed pump. */
  pumpLever: number
  /** motor swashplate lever (fraction of βmax). Ignored for a fixed motor. */
  motorLever: number
}

/** Smallest motor swashplate fraction allowed: at zero the motor would have to spin infinitely fast. */
export const MOTOR_MIN_FRACTION = 0.3

/**
 * Swashplate angles each of the four combinations can actually use (PT p8, exam 2022/23 Q4):
 * a fixed pump always delivers full, one-way flow; a fixed motor always runs at full angle.
 * Only a variable pump can pass through zero to reverse (PT p8: "varies flow and can reverse it").
 */
export function comboAngles(combo: HydroCombo, s: ComboSetting, pump: PistonUnit, motor: PistonUnit) {
  const pumpVariable = combo === 'VDP-FDM' || combo === 'VDP-VDM'
  const motorVariable = combo === 'FDP-VDM' || combo === 'VDP-VDM'
  const pumpAngle = pumpVariable ? clamp(s.pumpLever, -1, 1) * pump.maxAngle : pump.maxAngle
  const motorAngle = motorVariable ? clamp(s.motorLever, MOTOR_MIN_FRACTION, 1) * motor.maxAngle : motor.maxAngle
  return { pumpAngle, motorAngle, pumpVariable, motorVariable, canReverse: pumpVariable, canStop: pumpVariable }
}

export interface HydroLoopInput {
  combo: HydroCombo
  setting: ComboSetting
  pump: PistonUnit
  motor: PistonUnit
  /** engine (pump) speed, rpm */
  Np: number
  /** loop pressure (high − low side), MPa */
  dp: number
  etaV: number
  etaT: number
}

export interface HydroLoopResult extends HydrostaticResult {
  pumpAngle: number
  motorAngle: number
  Dp: number
  Dm: number
  /** piston stroke of pump and motor, m */
  pumpStroke: number
  motorStroke: number
  canReverse: boolean
}

/**
 * Whole loop: lever positions → swashplate angles → displacements → flow → motor speed and
 * torque (wraps hydraulics.ts pump/motor through transmission.hydrostaticDrive). The same
 * volumetric and torque efficiency is used for pump and motor.
 */
export function hydroLoop(i: HydroLoopInput): HydroLoopResult {
  const a = comboAngles(i.combo, i.setting, i.pump, i.motor)
  const Dp = unitDisplacement(i.pump, a.pumpAngle)
  const Dm = unitDisplacement(i.motor, a.motorAngle)
  const r = hydrostaticDrive({ Dp, Dm, Np: i.Np, dp: i.dp, pumpEtaV: i.etaV, pumpEtaT: i.etaT, motorEtaV: i.etaV, motorEtaT: i.etaT })
  return {
    ...r,
    pumpAngle: a.pumpAngle,
    motorAngle: a.motorAngle,
    Dp,
    Dm,
    pumpStroke: 2 * i.pump.pitchR * Math.abs(Math.tan(a.pumpAngle)),
    motorStroke: 2 * i.motor.pitchR * Math.abs(Math.tan(a.motorAngle)),
    canReverse: a.canReverse,
  }
}

/** The ten advantages of the hydrostatic drive (PT p9), in the notes' order. */
export const HYDRO_ADVANTAGES = [
  'Infinite speeds and torques',
  'Easy one-lever control',
  'Smooth shifting without “steps”',
  'Shifts “on the go”',
  'High torque available for starting up',
  'Flexible location, no drive lines',
  'Compact size for big power',
  'Eliminates clutches and large gear trains',
  'Reduces shock loads',
  'Low maintenance and service',
] as const

/** What greatly reduces the life of a hydrostatic unit (PT p9). */
export const HYDRO_LIFE_FACTORS = ['Too much speed', 'Too much heat', 'Too much pressure', 'Contamination'] as const

/* ================================ Torque converter ================================ */

export interface ConverterPoint {
  SR: number
  /** turbine speed, rpm */
  Nt: number
  /** torque ratio Tt/Ti */
  TR: number
  /** impeller (engine) and turbine torque, N·m */
  Ti: number
  Tt: number
  /** reaction torque the one-way clutch holds on the stator, N·m (0 once it freewheels) */
  Ts: number
  eta: number
  statorHeld: boolean
  /** power lost as heat in the oil, kW */
  heat: number
}

/**
 * Operating point for an engine speed/torque and a speed ratio. Torque balance on the three
 * elements: T_turbine = T_impeller + T_stator, so the stator (held by its one-way clutch) is the
 * "fluid fulcrum" that lets the turbine torque exceed the engine torque (PT p10). The torque-ratio
 * curve itself is BEYOND NOTES (see transmission.converterTorqueRatio).
 */
export function converterPoint(Ni: number, Ti: number, SR: number, c: ConverterSpec = TYPICAL_CONVERTER): ConverterPoint {
  const s = clamp(SR, 0, c.maxSR)
  const TR = converterTorqueRatio(s, c)
  const Tt = TR * Ti
  const eta = converterEfficiency(s, c)
  const Pin = (2 * Math.PI * Ni * Ti) / 60 / 1000
  return { SR: s, Nt: s * Ni, TR, Ti, Tt, Ts: Tt - Ti, eta, statorHeld: statorHeld(s, c), heat: Pin * (1 - eta) }
}

/** The element-count table of PT p10 (designs A–D). "The design employed is dependent on the power needed." */
export const TC_DESIGNS = [
  { design: 'A', pumps: 2, stators: 2, turbines: 1 },
  { design: 'B', pumps: 1, stators: 1, turbines: 2 },
  { design: 'C', pumps: 1, stators: 2, turbines: 1 },
  { design: 'D', pumps: 1, stators: 1, turbines: 1 },
] as const

/* ================================ Differential ================================ */

export type DiffCase = 'straight' | 'cornering' | 'held' | 'mud'

/**
 * Half-shaft speeds for each demonstration (TTS p8; PT p11–12).
 *  - straight: both at cage speed, planet pinions still;
 *  - cornering (turning left about radius R to the tractor centre line, track t): speeds in
 *    proportion to the wheel path radii (BEYOND NOTES geometry); "as one wheel turns faster the
 *    other turns slower by the same amount" (PT p11);
 *  - held: left wheel held → right at twice cage speed (TTS p8);
 *  - mud: right wheel on mud. The firm (left) wheel cannot move the tractor with only the mud
 *    wheel's torque, so it stands still and the mud wheel spins at 2× cage speed;
 *  - diff lock: both half shafts at cage speed whatever the ground (TTS p8).
 */
export function diffSpeeds(nCase: number, mode: DiffCase, locked: boolean, R = 6, track = 1.5) {
  if (locked || mode === 'straight') return { left: nCase, right: nCase }
  if (mode === 'held') return { left: 0, right: 2 * nCase }
  if (mode === 'mud') return { left: 0, right: 2 * nCase }
  const r = Math.max(R, track / 2)
  return { left: (nCase * (r - track / 2)) / r, right: (nCase * (r + track / 2)) / r }
}

/** Ratio inner/outer wheel speed on a turn of radius R (to the centre line) with track t. BEYOND NOTES. */
export const turnSpeedRatio = (R: number, track: number) => (R - track / 2) / (R + track / 2)

/** Cage (case) torque from the pinion: T_case = T_pinion × i × η. */
export const caseTorque = (Tpinion: number, ratio: number, eta = 0.98) => Tpinion * ratio * eta

/* ================================ Final drives ================================ */

export type FinalDriveLayout = 'straight' | 'spur' | 'epicyclic' | 'mf2000'

/** Typical tooth counts for the final-drive arrangements (the notes give none). */
export const FINAL_DRIVE = {
  /** Fig 35a spur reduction: small pinion on the differential shaft, large gear on the axle */
  spur: { pinion: 13, gear: 62 },
  /** Fig 35b / A2.15 epicyclic: sun on the half shaft, ring held in the trumpet, carrier to the axle */
  epicyclic: { sun: 15, planet: 21, ring: 57 },
}

/**
 * The three speed reductions (TTS p1, p10): gearbox → crown wheel & pinion → final reduction.
 * Returns the stage table (speed ÷ i, torque × i × η per stage; 98 % per gear pair, AEE502 p8).
 */
export function threeReductions(engineRpm: number, engineTorque: number, gearbox: number, crown: number, final: number, gearboxPairs = 2) {
  const stages: Stage[] = [
    { name: 'Gearbox', ratio: gearbox, pairs: gearboxPairs },
    { name: 'Crown wheel & pinion', ratio: crown, pairs: 1 },
    { name: 'Final reduction', ratio: final, pairs: final > 1 ? 1 : 0 },
  ]
  return reductionTable(engineRpm, engineTorque, stages)
}

/* ================================ Brakes ================================ */

/** Plain friction brake torque T = μ·N·r per surface, × the number of friction surfaces. */
export const frictionBrakeTorque = (mu: number, N: number, r: number, surfaces = 1) => mu * N * r * surfaces

/**
 * Hydraulic brake (TTS p13): pedal force × pedal ratio pushes the master cylinder; the same
 * pressure acts on the brake piston. p = F·i/A_m, F_piston = p·A_p (Pascal; BEYOND the brake
 * chapter but the same principle as the hydraulic notes).
 */
export function hydraulicBrake(pedalForce: number, pedalRatio: number, masterArea: number, pistonArea: number) {
  const p = (pedalForce * pedalRatio) / masterArea
  return { p, F: p * pistonArea }
}

/**
 * Two independent pedals, each with its own master cylinder. Latched together, the balancing
 * valve joins the two circuits so both brakes get the same (mean) pressure (TTS p13).
 */
export function balancedPressures(pLeft: number, pRight: number, latched: boolean) {
  if (!latched) return { left: pLeft, right: pRight }
  const m = (pLeft + pRight) / 2
  return { left: m, right: m }
}

/**
 * Turning brake: braking one rear wheel through the open differential stops that wheel and
 * drives the other at twice cage speed, so the tractor pivots about the braked wheel (TTS p11,
 * p8). Returns wheel speeds for a cage speed and the brake states.
 */
export function turningBrakeSpeeds(nCase: number, leftBraked: boolean, rightBraked: boolean) {
  if (leftBraked && rightBraked) return { left: 0, right: 0 }
  if (leftBraked) return { left: 0, right: 2 * nCase }
  if (rightBraked) return { left: 2 * nCase, right: 0 }
  return { left: nCase, right: nCase }
}

/**
 * Same wheel torque, brake on the fast shaft or on the wheel: the shaft turns i times faster so
 * it needs only 1/i of the torque — and 1/i of the clamping force for the same disc (TTS p11).
 */
export function brakePlacement(wheelTorque: number, ratio: number, mu: number, r: number, surfaces: number) {
  const onShaft = wheelTorque / ratio
  return {
    torqueOnShaft: onShaft,
    torqueOnWheel: wheelTorque,
    forceOnShaft: onShaft / (mu * r * surfaces),
    forceOnWheel: wheelTorque / (mu * r * surfaces),
  }
}
