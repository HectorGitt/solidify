/**
 * Tractor testing and power measurement — AEE502.
 *
 * Sources: "Tractor Tests and Performance (502).pdf" (textbook Ch 15: eq 3–5, Figs 15.2–15.5,
 * accuracies, N³D⁵ capacity); "Tractor power-measurement.pdf" (definitions, the four essential
 * elements, atmospheric correction, OECD codes). Dynamometer torque/power helpers and the
 * "Farmland" engine curve live in ./dynamometer.
 *
 * Units: kW, kPa, K, N, m, rpm.
 */
import { armPower, torquePower } from './dynamometer'

export { armPower, torquePower }

/* ------------------------------ atmospheric correction ------------------------------ */

/** Standard conditions used in the power-measurement notes: 99 kPa, 298 K (25 °C). */
export const STD_NOTES = { BP: 99, T: 298 }
/** Standard conditions in TESTS p2 and the 2016/17 marking guide: 101.3 kPa, 15.5 °C, dry air. */
export const STD_GUIDE = { BP: 101.3, T: 288.65 }

/** Air density ratio from the ideal gas law: ρs/ρo = (BPs/BPo)(To/Ts). */
export function airDensityRatio(BPo: number, To: number, BPs = STD_NOTES.BP, Ts = STD_NOTES.T) {
  return (BPs / BPo) * (To / Ts)
}

/**
 * Power correction factor fa = (BPs/BPo)(To/Ts)ⁿ. The notes give the form but no value of n;
 * 0.7 is the ISO 1585 value for naturally aspirated diesels and 0.5 the SAE J1349 value for
 * spark-ignition engines (beyond the notes).
 */
export function correctionFactor(BPo: number, To: number, n = 0.7, BPs = STD_NOTES.BP, Ts = STD_NOTES.T) {
  return (BPs / BPo) * Math.pow(To / Ts, n)
}

/** Corrected brake power Pbs = fa·Pbo + Pf(fa − 1); with Pf omitted, Pbs = fa·Pbo. */
export function correctedPower(Pbo: number, fa: number, Pf = 0) {
  return fa * Pbo + Pf * (fa - 1)
}

/* ------------------------------ absorption characteristics ------------------------------ */

/** Hydraulic dynamometer absorbing capacity ratio: (N/N₀)³(D/D₀)⁵ (TESTS p6, Culver 1937). */
export function capacityRatio(N: number, N0: number, D: number, D0: number) {
  return (N / N0) ** 3 * (D / D0) ** 5
}

/**
 * Cooling water needed by a hydraulic dynamometer: all the absorbed power leaves as heat in the
 * water, ṁ = P / (c_p ΔT) (energy balance — beyond the notes, which say only that the water
 * leaves hotter). Returns kg/s for P in kW.
 */
export function waterFlowFor(PkW: number, dT: number, cp = 4.18) {
  return PkW / (cp * dT)
}

/* ------------------------------ catalogue ------------------------------ */

export type DynoKindT = 'prony' | 'hydraulic' | 'eddy' | 'dc' | 'pto'

export interface DynoFacts {
  name: string
  figure?: string
  /** accuracy as stated in the notes */
  accuracy: string
  /** how torque is controlled / measured / power dissipated */
  control: string
  measure: string
  dissipate: string
  note: string
}

export const DYNO_FACTS: Record<DynoKindT, DynoFacts> = {
  prony: {
    name: 'Prony brake',
    figure: 'Fig 15.2',
    accuracy: 'Lowest of the laboratory types (the hydraulic brake "should be somewhat better").',
    control: 'Handwheel tightens the wooden blocks on the pulley.',
    measure: 'Lever arm l bears on a scale reading F; T = F·l; tachometer for n.',
    dissipate: 'Friction heat in the blocks and pulley.',
    note: 'Its torque–speed curve is almost flat, like the engine’s, so speed control is difficult and the engine can “run away” if the load is lost.',
  },
  hydraulic: {
    name: 'Hydraulic (water) dynamometer',
    figure: 'Fig 15.3',
    accuracy: 'Error about 0.5 %.',
    control: 'Intake needle valves and the exhaust control set how much water works between rotors and casing.',
    measure: 'Casing on ball cradle bearings is restrained by a torque arm; T = F·l.',
    dissipate: 'Water friction heats the water, which leaves through the exhaust ports.',
    note: 'Absorbing capacity ∝ N³D⁵. Same power equation as the Prony brake.',
  },
  eddy: {
    name: 'Eddy-current dynamometer',
    accuracy: 'Not stated in the notes.',
    control: 'DC excitation of the stator field coils.',
    measure: 'Stator is mounted in bearings and reacts on a torque arm.',
    dissipate: 'Eddy currents heat the stator; coolant is circulated.',
    note: 'A solid steel rotor with tapered teeth acts as the poles.',
  },
  dc: {
    name: 'DC cradle dynamometer',
    figure: 'Fig 15.4',
    accuracy: 'Within 0.25 % — independent of the machine’s electrical efficiency.',
    control: 'Separately excited shunt-wound generator; load set by field and resistor bank.',
    measure: 'Field frame is free to rotate (cradled) and reacts against scales: P = 2πlFn/60 000 (eq 5).',
    dissipate: 'Electrical power is dumped in a resistor bank.',
    note: 'It can also run as a motor to turn the engine over — the way friction power is measured.',
  },
  pto: {
    name: 'Shop-type (PTO) dynamometer',
    figure: 'Fig 15.5',
    accuracy: 'Lower than laboratory dynamometers — not built or maintained to that precision.',
    control: 'Usually a hydraulic or Prony-type absorber (sometimes a hydraulic pump) driven from the PTO.',
    measure: 'Pressure gauge reads the force on the resisting torque arm; direct-reading PTO speed indicator.',
    dissipate: 'Heat in the absorber fluid.',
    note: 'Portable: used in the field or a dealer’s shop to check engine condition and show customers the gain after an overhaul.',
  },
}

/** Air (fan) brake: power ∝ rpm³ and error up to 20 % (TESTS p7). */
export const FAN_BRAKE_ERROR = 0.2

/** OECD tractor test codes (Tractor power-measurement p8). */
export const OECD_COMPULSORY = [
  'Main PTO',
  'Hydraulic power and lifting force',
  'Drawbar power, ballasted tractor',
  'Turning area and turning circle',
  'Position of centre of gravity',
  'Braking (wheeled tractors only)',
  'External (bystander) noise (wheeled tractors only)',
]
export const OECD_OPTIONAL = [
  'Engine',
  'Performance at the belt or belt-pulley shaft',
  'Performance in a hot atmosphere',
  'Low-temperature starting',
  'Drawbar power and fuel consumption, unballasted tractor',
]

/** Milestones of standardised testing (TESTS p2; AEE502 text). */
export const TEST_HISTORY: [string, string][] = [
  ['1919', 'Nebraska Tractor Test Law; the University of Nebraska Tractor Test Laboratory was the first independent tester.'],
  ['before 1959', 'Rated drawbar power = 0.75 × corrected maximum; rated belt power = 0.85 × corrected maximum.'],
  ['1959', 'ASAE/SAE Tractor Test Code: rated and corrected horsepower dropped.'],
  ['1971', 'Sound level in dB(A) at the operator’s ear added.'],
  ['1976', 'SI units from Nebraska Test No. 1218.'],
]

/** The four essential elements of an engine dynamometer (power-measurement p2). */
export const DYNO_ESSENTIALS = ['A means of controlling torque', 'A means of measuring torque', 'A means of measuring speed', 'A means of dissipating power']

/* ======================================================================================
 * Appended for testing/drawbar-test and field/field (append-only).
 * Drawbar testing: the Nebraska test car (TESTS §15.10, Fig 15.7), the Dillon spring dial
 * (§15.9, Fig 15.6), the strain-gauge link (§15.11, Fig 15.8) and the Uppsala chassis
 * dynamometer (§15.13, Fig 15.10), driven by the MECH Ch 2 tractor equations (eqs 2.1–2.15),
 * Macmillan eq 6.4 weight transfer and the L27 (Zoz & Grisso) traction relations.
 * ====================================================================================== */
import { FARMLAND, dynamicLoads, type Chassis } from './chassis'
import { DENSITY, heatingValue } from './fuel'
import { BRIXIUS, brixius, mobilityNumber } from './traction'
import { FARMLAND_D, FARMLAND_ENGINE, gearTrainEfficiency, theoreticalSpeed, torqueAt, tractiveEfficiency } from './tractor'

/** MECH p8: 3 gear pairs in the gearbox + 2 in the differential/final drive → 0.98⁵ ≈ 0.90. */
export const ETA_TRANSMISSION = gearTrainEfficiency(5)

/**
 * 14.9-28 rear tyre of the Farmland tractor for the Brixius equations (L27 eq 14): b = 14.9 in,
 * unloaded diameter d = 1.32 m (shared tractor dims), h = (d − 28 in rim)/2. The static deflection
 * δ = 45 mm is a typical value (beyond the notes).
 */
export const REAR_TYRE = { b: 0.378, d: 1.32, h: (1.32 - 0.7112) / 2, delta: 0.045 }
/** 7.50-16 front tyre, same basis (typical deflection, beyond the notes). */
export const FRONT_TYRE = { b: 0.19, d: 0.78, h: (0.78 - 0.4064) / 2, delta: 0.025 }

/**
 * Tyre on concrete. L27 p37: on concrete a tyre runs at about 2 % motion resistance and 5 % slip
 * with TE = 92.5 %. The curve GTR = a(1 − e^(−c·s)) has the shape of the Brixius slip term and is
 * calibrated (beyond the notes) to pass through that point.
 */
export const CONCRETE = { a: 0.9, MRR: 0.02, c: -Math.log(1 - 0.02 / (1 - 0.925 / 0.95) / 0.9) / 0.05 }

export type Surface = { kind: 'concrete' } | { kind: 'soil'; CI: number }

/** Traction ratios of one tyre at slip s with wheel load W (N) on a surface. */
export function tractionAt(surface: Surface, W: number, s: number, tyre = REAR_TYRE) {
  if (surface.kind === 'concrete') {
    const GTR = CONCRETE.a * (1 - Math.exp(-CONCRETE.c * s))
    const MRR = CONCRETE.MRR
    const NTR = GTR - MRR
    return { GTR, MRR, NTR, TE: GTR > 0 ? (NTR / GTR) * (1 - s) : 0, Bn: Infinity }
  }
  const Bn = mobilityNumber(surface.CI, tyre.b, tyre.d, Math.max(W, 1), tyre.delta, tyre.h)
  return { ...brixius(Bn, s, BRIXIUS.bias), Bn }
}

/** Slip needed for a net traction ratio NTR (bisection, the "iterative solution" of L27 p32). NaN if the tyre cannot develop it. */
export function slipForPull(surface: Surface, W: number, NTR: number, tyre = REAR_TYRE, sMax = 0.99) {
  if (tractionAt(surface, W, 0, tyre).NTR >= NTR) return 0
  if (tractionAt(surface, W, sMax, tyre).NTR < NTR) return NaN
  let lo = 0
  let hi = sMax
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2
    if (tractionAt(surface, W, m, tyre).NTR < NTR) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/* ------------------------------ engine with a governor ------------------------------ */

export const HIGH_IDLE = FARMLAND_ENGINE[FARMLAND_ENGINE.length - 1][0]
export const LUG_MIN = FARMLAND_ENGINE[0][0]
export const RATED_RPM = 2250

/** High-idle speed for a hand-throttle setting 0…1 (1 = the tested 2390 rpm; linear, beyond the notes). */
export const highIdleFor = (throttle: number) => LUG_MIN + 150 + Math.max(0, Math.min(1, throttle)) * (HIGH_IDLE - LUG_MIN - 150)

/**
 * Torque available at speed n and throttle setting: the full-load (lugging) curve of MECH Fig 2.2,
 * cut off by a governor run-out line of the same shape as the tested one (2390 → 2250 rpm) moved
 * to the high idle the throttle sets. At throttle 1 it is exactly the Fig 2.2 curve.
 */
export function availableTorque(n: number, throttle = 1) {
  if (n < LUG_MIN) return 0
  const d = highIdleFor(throttle) - n
  if (d <= 0) return 0
  const span = HIGH_IDLE - RATED_RPM
  const gov = d <= span ? torqueAt(FARMLAND_ENGINE, HIGH_IDLE - d) : 142 + ((142 - 120) / 75) * (d - span)
  return Math.min(torqueAt(FARMLAND_ENGINE, n), gov)
}

/** Engine speed at which the governed engine delivers torque Te (scan down from high idle). NaN = stalled. */
export function engineSpeedFor(Te: number, throttle = 1) {
  const hi = highIdleFor(throttle)
  if (Te <= 0) return hi
  for (let n = hi; n >= LUG_MIN; n -= 0.5) if (availableTorque(n, throttle) >= Te) return n
  return NaN
}

/* ------------------------------ fuel (beyond the notes) ------------------------------ */

/** Indicated efficiency of the Willans-line fuel model (typical DI diesel, beyond the notes). */
export const ETA_INDICATED = 0.38
/** MECH p9 (eq 2.14 example): engine efficiency ≈ 0.30; diesel maximum ≈ 35 %. */
export const ETA_ENGINE_RATED = 0.3
const HV_DIESEL = heatingValue('hsd')
const RATED_POWER = (2 * Math.PI * 142 * RATED_RPM) / 60
/** Friction ("no-load") fuel per rpm, chosen so the rated point has η_e = 0.30. */
const FRICTION_FUEL = (RATED_POWER / (ETA_ENGINE_RATED * HV_DIESEL) - RATED_POWER / (ETA_INDICATED * HV_DIESEL)) / RATED_RPM

/**
 * Fuel use (Willans line, beyond the notes): ṁf = Pe/(ηi·HV) + k·n, with HV of high-speed diesel
 * (10 550 kcal/kg, Supplementary notes). Returns kg/h, L/h (ρ = 835 kg/m³) and η_e.
 */
export function fuelUse(PeW: number, rpm: number) {
  if (!(rpm > 0)) return { kgh: 0, Lh: 0, etaE: 0 }
  const kgs = Math.max(0, PeW) / (ETA_INDICATED * HV_DIESEL) + FRICTION_FUEL * rpm
  return { kgh: kgs * 3600, Lh: (kgs * 3600) / (DENSITY.diesel / 1000), etaE: PeW > 0 ? PeW / (kgs * HV_DIESEL) : 0 }
}

/* ------------------------------ the drawbar test ------------------------------ */

export interface DrawbarInput {
  /** drawbar pull, N */
  P: number
  /** overall gear ratio q (MECH p4: gear 3 = 139.5, 5 = 85.6, 7 = 47.3) */
  q: number
  surface: Surface
  throttle?: number
  /** ideal analysis: no slip, no rolling resistance, ηr = 1 (MECH p1–3) */
  ideal?: boolean
  /** front wheels rolling (false on the chassis dynamometer, where the tractor is restrained) */
  frontRolls?: boolean
  D?: number
  chassis?: Chassis
  etaR?: number
}

export interface DrawbarPoint {
  P: number
  /** rear / front axle loads with the pull (Macmillan eq 6.4), N */
  Vr: number
  Vf: number
  NTR: number
  slip: number
  /** rolling resistance R, N, and the gross soil reaction H = P + R (MECH eq 2.7) */
  R: number
  H: number
  Te: number
  rpm: number
  V0: number
  V: number
  /** drawbar power P·V and engine power 2πTeNe, W */
  Pd: number
  Pe: number
  etaT: number
  fuel: ReturnType<typeof fuelUse>
  stalled: boolean
  /** the tyres cannot develop this pull */
  spinning: boolean
}

/** Rolling resistance of the tractor at pull P with rear slip s. */
function rollingResistance(surface: Surface, Vr: number, Vf: number, slip: number, frontRolls: boolean) {
  const rear = tractionAt(surface, Vr / 2, Math.min(slip, 0.99))
  const front = frontRolls ? tractionAt(surface, Math.max(Vf, 0) / 2, 0, FRONT_TYRE).MRR * Math.max(Vf, 0) : 0
  return rear.MRR * Vr + front
}

/** One steady test point: pull P in gear q → slip, rolling resistance, engine speed, speed and powers. */
export function drawbarPoint(inp: DrawbarInput): DrawbarPoint {
  const { P, q, surface, throttle = 1, ideal = false, frontRolls = true, D = FARMLAND_D, chassis = FARMLAND } = inp
  const etaR = ideal ? 1 : (inp.etaR ?? ETA_TRANSMISSION)
  const { Vr, Vf } = dynamicLoads(chassis, P)
  const NTR = Vr > 0 ? P / Vr : 0
  let slip = 0
  let R = 0
  let spinning = false
  if (!ideal) {
    // NTR = NT/Wd with NT = P (L27 eq 5): find the rear slip that develops it
    const s = slipForPull(surface, Vr / 2, NTR)
    spinning = Number.isNaN(s)
    slip = spinning ? 1 : s
    R = rollingResistance(surface, Vr, Vf, slip, frontRolls)
  }
  const H = P + R
  const Te = (H * D) / (2 * q * etaR)
  const rpm = spinning ? NaN : engineSpeedFor(Te, throttle)
  const stalled = !spinning && Number.isNaN(rpm)
  const n = Number.isNaN(rpm) ? 0 : rpm
  const V0 = theoreticalSpeed(D, n / 60, q)
  const V = V0 * (1 - slip)
  const Pe = (2 * Math.PI * Te * n) / 60
  return { P, Vr, Vf, NTR, slip, R, H, Te, rpm, V0, V, Pd: P * V, Pe, etaT: ideal ? 1 : tractiveEfficiency(P, R, slip), fuel: fuelUse(Pe, n), stalled, spinning }
}

/**
 * The standard test run (TESTS p1: "drawbar pull vs speed in one gear at open throttle"): the
 * pull is raised in steps from zero until the engine stalls, the tyres pass `slipLimit`, or they
 * cannot develop more pull.
 */
export function pullSpeedRun(q: number, surface: Surface, opts: { ideal?: boolean; throttle?: number; steps?: number; maxPull?: number; slipLimit?: number } = {}) {
  const { ideal = false, throttle = 1, steps = 80, maxPull = 45000, slipLimit = 0.3 } = opts
  const out: DrawbarPoint[] = []
  for (let k = 0; k <= steps; k++) {
    const pt = drawbarPoint({ P: (maxPull * k) / steps, q, surface, ideal, throttle })
    if (pt.stalled || pt.spinning || pt.slip > slipLimit) break
    out.push(pt)
  }
  return out
}

/** Hydraulic drawbar cylinder of the test car: oil pressure p = P/A for piston bore d (m), Pa. */
export function cylinderPressure(P: number, bore: number) {
  return P / ((Math.PI / 4) * bore * bore)
}

/** Spring (Dillon) dynamometer: elongation x = P/k (Hooke's law). */
export function springElongation(P: number, k: number) {
  return P / k
}

/** Strain-gauge link: axial strain ε = P/(E·A) (beyond the notes — standard elasticity). */
export function linkStrain(P: number, E: number, A: number) {
  return P / (E * A)
}

/* ------------------------------ Uppsala chassis dynamometer ------------------------------ */

/**
 * Chassis dynamometer of TESTS Fig 15.10 (Uppsala): concrete-covered drums under the drive
 * wheels → 1:18 gearbox → 1:1–7.7 gearbox → hydraulic dynamometer, on a pendulum frame that
 * reacts on a scale. Drum radius, arm length and absorber size are typical (beyond the notes).
 */
export const UPPSALA = { step1: 18, rangeMin: 1, rangeMax: 7.7, drumR: 0.6, arm: 1.2, absorberTmax: 300, absorberNref: 3000 }

export interface ChassisDynoPoint extends DrawbarPoint {
  nDrum: number
  nAbsorber: number
  /** torque on the drum shaft, N·m, and the scale reading on the pendulum arm, N */
  Tdrum: number
  scaleF: number
  /** power from the scale reading, TESTS eq 3: 2πlFn/60 000, kW */
  scalePowerkW: number
}

/**
 * Steady point on the chassis dynamometer for gear q, range ratio k (1…7.7) and absorber setting
 * s (0…1). The absorber torque rises as n² (power ∝ n³, TESTS p6); the drum force it reflects is
 * the pull the restraint carries. The tractor is restrained, so the front wheels do not roll.
 */
export function chassisDynoPoint(q: number, k: number, s: number, throttle = 1): ChassisDynoPoint {
  const U = UPPSALA
  const ratio = U.step1 * k
  const surface: Surface = { kind: 'concrete' }
  const pullAt = (n: number) => {
    let slip = 0.02
    let P = 0
    for (let it = 0; it < 5; it++) {
      const V = theoreticalSpeed(FARMLAND_D, n / 60, q) * (1 - slip)
      const nAbs = (V / (2 * Math.PI * U.drumR)) * 60 * ratio
      P = (s * U.absorberTmax * (nAbs / U.absorberNref) ** 2 * ratio) / U.drumR
      const Vr = dynamicLoads(FARMLAND, P).Vr
      const sl = slipForPull(surface, Vr / 2, P / Vr)
      slip = Number.isNaN(sl) ? 0.99 : sl
    }
    const { Vr } = dynamicLoads(FARMLAND, P)
    const R = rollingResistance(surface, Vr, 0, slip, false)
    return { P, Te: ((P + R) * FARMLAND_D) / (2 * q * ETA_TRANSMISSION) }
  }
  let found = NaN
  let P = 0
  for (let n = highIdleFor(throttle); n >= LUG_MIN; n -= 2) {
    const r = pullAt(n)
    if (availableTorque(n, throttle) >= r.Te) {
      found = n
      P = r.P
      break
    }
  }
  const pt = Number.isNaN(found)
    ? { ...drawbarPoint({ P: 0, q, surface, throttle, frontRolls: false }), rpm: NaN, stalled: true, V: 0, V0: 0, Pd: 0, Pe: 0 }
    : drawbarPoint({ P, q, surface, throttle, frontRolls: false })
  const nDrum = (pt.V / (2 * Math.PI * U.drumR)) * 60
  const Tdrum = pt.P * U.drumR
  const scaleF = Tdrum / U.arm
  return { ...pt, nDrum, nAbsorber: nDrum * ratio, Tdrum, scaleF, scalePowerkW: armPower(U.arm, scaleF, nDrum) }
}
