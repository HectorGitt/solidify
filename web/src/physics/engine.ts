/**
 * Reciprocating engine geometry, kinematics and performance — AEE509.
 * Sources: extract fromtextbook(509) p9 (PD, TCV, CR); AEE 509 manual p6;
 * AEE 509 Miscellaneous Exercises p2–6 (IP, BP, bmep, efficiencies);
 * ENGINE SYSTEMS Supplementary notes (governor regulation).
 *
 * SI units unless stated: m, m², m³, rad, rpm for engine speed, W for power, N·m for torque.
 */

/* ------------------------------ Geometry ------------------------------ */

/** Piston displacement (swept volume) of one cylinder: PD = π/4 · D² · L */
export function sweptVolume(bore: number, stroke: number) {
  return (Math.PI / 4) * bore * bore * stroke
}

/** Compression ratio CR = TCV / CV = (Vs + Vc) / Vc */
export function compressionRatio(Vs: number, Vc: number) {
  return (Vs + Vc) / Vc
}

/** Clearance volume needed for a target compression ratio. */
export function clearanceForRatio(Vs: number, r: number) {
  return Vs / (r - 1)
}

/** Mean piston speed Sp = 2 L N / 60 (m/s) */
export function meanPistonSpeed(stroke: number, rpm: number) {
  return (2 * stroke * rpm) / 60
}

/* ------------------------------ Slider-crank ------------------------------ */

export interface SliderCrank {
  /** crank radius (half the stroke), m */
  r: number
  /** connecting-rod length (centre to centre), m */
  l: number
}

/**
 * Gudgeon-pin distance from the crank centre along the cylinder axis.
 * θ in radians, θ = 0 at TDC.
 */
export function pinHeight(sc: SliderCrank, theta: number) {
  const s = Math.sin(theta)
  return sc.r * Math.cos(theta) + Math.sqrt(sc.l * sc.l - sc.r * sc.r * s * s)
}

/** Piston displacement from TDC (m). */
export function pistonFromTDC(sc: SliderCrank, theta: number) {
  return sc.r + sc.l - pinHeight(sc, theta)
}

/** Connecting-rod angle to the cylinder axis (rad). Positive when the crank pin is on +x. */
export function rodAngle(sc: SliderCrank, theta: number) {
  return Math.asin((sc.r * Math.sin(theta)) / sc.l)
}

/** Piston velocity (m/s, positive moving away from TDC) for crank speed ω (rad/s). */
export function pistonVelocity(sc: SliderCrank, theta: number, omega: number) {
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const root = Math.sqrt(sc.l * sc.l - sc.r * sc.r * s * s)
  return omega * sc.r * (s + (sc.r * s * c) / root)
}

/** Fraction V/V1 of the total cylinder volume at crank angle θ. */
export function volumeFraction(sc: SliderCrank, theta: number, r: number) {
  const stroke = 2 * sc.r
  const x = pistonFromTDC(sc, theta) / stroke // 0 at TDC, 1 at BDC
  const vc = 1 / r
  return vc + (1 - vc) * x
}

/* ------------------------------ Performance ------------------------------ */

/** Strokes-per-cycle factor n: 2 for a four-stroke (one power stroke per 2 rev), 1 for a two-stroke. */
export type StrokeCycle = 2 | 4
const nFactor = (cycle: StrokeCycle) => (cycle === 4 ? 2 : 1)

/**
 * Indicated power IP = Pm·L·A·N·k / (60 n) — W.
 * pm in Pa, stroke m, area m², N rpm, k cylinders.
 */
export function indicatedPower(pm: number, stroke: number, area: number, rpm: number, cylinders: number, cycle: StrokeCycle) {
  return (pm * stroke * area * rpm * cylinders) / (60 * nFactor(cycle))
}

/** Brake power BP = 2πNT/60 — W. */
export function brakePower(rpm: number, torque: number) {
  return (2 * Math.PI * rpm * torque) / 60
}

/** Brake mean effective pressure from brake power — Pa. */
export function bmep(bp: number, stroke: number, area: number, rpm: number, cylinders: number, cycle: StrokeCycle) {
  return (bp * 60 * nFactor(cycle)) / (stroke * area * rpm * cylinders)
}

/** bmep from torque and total displacement: bmep = 2π n T / Vd — Pa. */
export function bmepFromTorque(torque: number, totalDisplacement: number, cycle: StrokeCycle) {
  return (2 * Math.PI * nFactor(cycle) * torque) / totalDisplacement
}

export function mechanicalEfficiency(bp: number, ip: number) {
  return bp / ip
}

/** Brake thermal efficiency = BP / (ṁf · HV). ṁf kg/s, HV J/kg. */
export function brakeThermalEfficiency(bp: number, fuelRate: number, heatingValue: number) {
  return bp / (fuelRate * heatingValue)
}

/** Volumetric efficiency ηv = ṁa / (ρa · Vd · N / (60 n)). */
export function volumetricEfficiency(airRate: number, rhoAir: number, totalDisplacement: number, rpm: number, cycle: StrokeCycle) {
  return airRate / ((rhoAir * totalDisplacement * rpm) / (60 * nFactor(cycle)))
}

/** Air mass flow for a given volumetric efficiency — kg/s. */
export function airFlow(etaV: number, rhoAir: number, totalDisplacement: number, rpm: number, cycle: StrokeCycle) {
  return (etaV * rhoAir * totalDisplacement * rpm) / (60 * nFactor(cycle))
}

/** Specific fuel consumption — kg/kWh, from fuel rate kg/h and power kW. */
export function sfc(fuelKgPerHour: number, powerKW: number) {
  return fuelKgPerHour / powerKW
}

/** Governor speed regulation R = (N1 − N2) / ((N1 + N2)/2) × 100 %. */
export function governorRegulation(noLoadRpm: number, fullLoadRpm: number) {
  return ((noLoadRpm - fullLoadRpm) / ((noLoadRpm + fullLoadRpm) / 2)) * 100
}

/* ------------------------------ Multi-cylinder ------------------------------ */

/** Firing interval for a four-stroke engine: 720°/n. */
export function firingInterval(cylinders: number, cycle: StrokeCycle = 4) {
  return (cycle === 4 ? 720 : 360) / cylinders
}

/**
 * For a firing order (1-based cylinder numbers), the crank angle (deg) at which
 * each cylinder begins its power stroke, relative to cylinder `order[0]`.
 */
export function firingAngles(order: number[], cycle: StrokeCycle = 4): Map<number, number> {
  const step = firingInterval(order.length, cycle)
  const m = new Map<number, number>()
  order.forEach((cyl, i) => m.set(cyl, i * step))
  return m
}

/* ------------------------------ Valve timing ------------------------------ */

export interface ValveTiming {
  /** inlet opens, degrees before TDC */
  ivoBTDC: number
  /** inlet closes, degrees after BDC */
  ivcABDC: number
  /** exhaust opens, degrees before BDC */
  evoBBDC: number
  /** exhaust closes, degrees after TDC */
  evcATDC: number
  /** max valve lift, m */
  maxLift: number
}

/**
 * Typical diesel timing — NOT given in the AEE509 notes (flagged "beyond notes").
 * Values are representative of naturally aspirated tractor diesels.
 */
export const TYPICAL_DIESEL_TIMING: ValveTiming = {
  ivoBTDC: 15,
  ivcABDC: 40,
  evoBBDC: 45,
  evcATDC: 15,
  maxLift: 0.010,
}

/** Smooth lift profile (raised cosine) between open and close angles (deg, 0–720 cycle). */
function bump(theta: number, open: number, close: number, maxLift: number) {
  let t = theta
  let o = open
  let c = close
  // unwrap so that open < close and theta lies in the same revolution frame
  while (c < o) c += 720
  while (t < o) t += 720
  if (t > c) return 0
  const u = (t - o) / (c - o)
  return maxLift * 0.5 * (1 - Math.cos(2 * Math.PI * u))
}

/**
 * Valve lifts at crank angle θ (deg). Cycle convention: 0° = TDC at the start of intake,
 * 180° BDC, 360° TDC firing, 540° BDC, 720° = 0°.
 */
export function valveLifts(thetaDeg: number, vt: ValveTiming) {
  const th = ((thetaDeg % 720) + 720) % 720
  const inlet = bump(th, 720 - vt.ivoBTDC, 180 + vt.ivcABDC, vt.maxLift)
  const exhaust = bump(th, 540 - vt.evoBBDC, 720 + vt.evcATDC, vt.maxLift)
  return { inlet, exhaust }
}

export function valveOverlapDeg(vt: ValveTiming) {
  return vt.ivoBTDC + vt.evcATDC
}

/* ======================================================================================
 * Additions for the two-stroke, multi-cylinder, lubrication and performance scenes.
 * Sources: AEE 509 Miscellaneous Exercises p4–7 (Examples 1–7); 509 Lecture 3/4;
 * extract fromtextbook(509) §2.6.4, Ch 6; ENGINE SYSTEMS Supplementary notes.
 * ====================================================================================== */

/* ------------------------------ Slider-crank inverse ------------------------------ */

/**
 * Crank angle (rad, 0…π, measured from TDC) at which the piston has travelled `x` from TDC.
 * Used to turn port heights into port-timing angles (two-stroke). Bisection on the
 * monotonic half-revolution.
 */
export function crankAngleForTravel(sc: SliderCrank, x: number) {
  const stroke = 2 * sc.r
  if (x <= 0) return 0
  if (x >= stroke) return Math.PI
  let lo = 0
  let hi = Math.PI
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (pistonFromTDC(sc, mid) < x) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/* ------------------------------ Performance (Misc. Exercises p4–7) ------------------------------ */

/** Density of air ρ = p / (R T) — kg/m³ (p in Pa, T in K). Misc Ex 4. */
export function airDensity(p: number, T: number, R = 287) {
  return p / (R * T)
}

/** Indicated power from brake power and mechanical efficiency: IP = BP / ηm. */
export function indicatedFromBrake(bp: number, etaM: number) {
  return bp / etaM
}

/** Friction power FP = IP − BP. */
export function frictionPower(ip: number, bp: number) {
  return ip - bp
}

/** imep = bmep / ηm (Misc Ex 2). */
export function imepFromBmep(bmepPa: number, etaM: number) {
  return bmepPa / etaM
}

/** Fuel mass flow needed for a power at a thermal efficiency: ṁf = P / (HV · η) — kg/s. Misc Ex 1. */
export function fuelRateForPower(power: number, heatingValue: number, eta: number) {
  return power / (heatingValue * eta)
}

/** Indicated thermal efficiency ηith = IP / (ṁf · HV). Misc Ex 5. */
export function indicatedThermalEfficiency(ip: number, fuelRate: number, heatingValue: number) {
  return ip / (fuelRate * heatingValue)
}

/** Total swept volume needed for a torque at a given bmep: Vd = 2π n T / bmep (Misc Ex 6). */
export function displacementForTorque(torque: number, bmepPa: number, cycle: StrokeCycle) {
  return (2 * Math.PI * nFactor(cycle) * torque) / bmepPa
}

/** Bore (= stroke) of a "square" engine with swept volume Vs per cylinder: π/4·D³ = Vs. Misc Ex 6. */
export function squareBore(VsPerCylinder: number) {
  return Math.cbrt((4 * VsPerCylinder) / Math.PI)
}

/** Brake torque from brake power: T = 60 BP / (2πN). */
export function torqueFromPower(bp: number, rpm: number) {
  return (60 * bp) / (2 * Math.PI * rpm)
}

/** Cycles per second for a 2- or 4-stroke engine: N / (60 n). */
export function cyclesPerSecond(rpm: number, cycle: StrokeCycle) {
  return rpm / (60 * nFactor(cycle))
}

export interface HeatShares {
  /** fraction of the fuel energy (0…1) */
  exhaust: number
  cooling: number
  label: string
}

/** Heat balances quoted in the notes. Supp: 40 / 30 / 30. TB §3.3: exhaust 31, cooling 40, friction 5.5, PTO 23.5. */
export const HEAT_BALANCE_SUPP: HeatShares = { exhaust: 0.4, cooling: 0.3, label: 'Supplementary notes (40/30/30)' }
export const HEAT_BALANCE_TB: HeatShares = { exhaust: 0.31, cooling: 0.4, label: 'Textbook §3.3 (31/40)' }

/**
 * Engine heat balance (W). Fuel energy Qf = ṁf·HV is split into brake power, friction power
 * and the remainder Qf − IP, which is shared between exhaust and cooling in the ratio of `shares`.
 */
export function heatBalance(fuelPower: number, bp: number, ip: number, shares: HeatShares) {
  const rest = fuelPower - ip
  const w = shares.exhaust + shares.cooling
  return {
    fuel: fuelPower,
    brake: bp,
    friction: ip - bp,
    exhaust: (rest * shares.exhaust) / w,
    cooling: (rest * shares.cooling) / w,
    consistent: rest >= 0,
  }
}

/* ------------------------------ Multi-cylinder ------------------------------ */

export type FourStroke = 'intake' | 'compression' | 'power' | 'exhaust'

/**
 * Stroke a cylinder is on at engine crank angle θ (deg), given the crank angle φ at which it
 * fires (begins its power stroke). Four-stroke: ψ = θ − φ + 360 (mod 720), ψ = 0 at the TDC
 * that starts the intake stroke.
 */
export function cylinderCycleAngle(crankDeg: number, firingDeg: number) {
  return (((crankDeg - firingDeg + 360) % 720) + 720) % 720
}

export function strokeAt(cycleDeg: number): FourStroke {
  const p = ((cycleDeg % 720) + 720) % 720
  return p < 180 ? 'intake' : p < 360 ? 'compression' : p < 540 ? 'power' : 'exhaust'
}

/** Crank-throw angle (deg, 0…360) of a cylinder that fires at φ: its piston is at TDC when θ ≡ φ (mod 360). */
export function throwAngle(firingDeg: number) {
  return ((firingDeg % 360) + 360) % 360
}

/* ------------------------------ Lubrication circuit ------------------------------ */

export interface LubeInput {
  /** engine speed, rpm */
  rpm: number
  /** pump displacement per pump revolution, m³ (gear pump driven by the camshaft) */
  pumpDisp: number
  /** pump speed / engine speed (camshaft drive = 0.5) */
  pumpRatio: number
  /** pump volumetric efficiency */
  pumpEff: number
  /** bearing leakage conductance with hot oil, m³/s per Pa */
  bearingG: number
  /** oil viscosity relative to hot oil (cold oil ≫ 1) */
  viscosity: number
  /** filter resistance, Pa per m³/s (clean) */
  filterR: number
  /** filter condition: 1 clean, larger = clogged */
  filterClog: number
  /** relief valve cracking pressure, Pa */
  reliefCrack: number
  /** relief valve flow gain, m³/s per Pa above cracking */
  reliefK: number
  /** over-pressure at which the relief valve is fully open, Pa */
  reliefFull: number
}

export interface LubeState {
  /** pump delivery, m³/s */
  pumpFlow: number
  /** pump outlet pressure (before the filter), Pa */
  pumpPressure: number
  /** main gallery pressure (gauge), Pa */
  galleryPressure: number
  /** flow through the bearings, m³/s */
  bearingFlow: number
  /** flow spilled back to the sump by the relief valve, m³/s */
  reliefFlow: number
  /** relief valve opening, 0…1 */
  reliefOpen: number
  filterDrop: number
}

/**
 * Steady force-feed circuit (TB Fig 6.2): gear pump → relief valve (to sump) → filter → main
 * gallery → bearings. Pump flow Q = Qbearings(p) + Qrelief(p), solved for the pump pressure p.
 * Bearings behave as a laminar leak (Q ∝ p / μ) in series with the filter.
 */
export function lubeCircuit(i: LubeInput): LubeState {
  const Q = (i.pumpDisp * i.pumpRatio * i.pumpEff * i.rpm) / 60
  const G = i.bearingG / i.viscosity
  const Rf = i.filterR * i.filterClog * i.viscosity
  const qBear = (p: number) => p / (Rf + 1 / G)
  const qRel = (p: number) => Math.max(0, i.reliefK * (p - i.reliefCrack))
  let lo = 0
  let hi = 1e8
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2
    if (qBear(mid) + qRel(mid) < Q) lo = mid
    else hi = mid
  }
  const p = (lo + hi) / 2
  const qb = qBear(p)
  const qr = qRel(p)
  return {
    pumpFlow: Q,
    pumpPressure: p,
    galleryPressure: qb / G,
    bearingFlow: qb,
    reliefFlow: qr,
    reliefOpen: Math.max(0, Math.min(1, (p - i.reliefCrack) / i.reliefFull)),
    filterDrop: qb * Rf,
  }
}
