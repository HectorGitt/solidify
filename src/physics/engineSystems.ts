/**
 * Engine systems — AEE509 Farm Power I: air intake, governor, lubrication, cooling, carburettor.
 *
 * Sources (file names as in the AEE509 folder):
 *  - extract fromtextbook(509) §4.3 (air cleaners; dust 0.565 / 0.283 / 0.141 g/m³), §4.4 (carburettor,
 *    1 : 15 by weight), §4.6 + Fig 4.10 (flyweight governor), Ch 6 (lubrication), Ch 7 (cooling);
 *  - ENGINE SYSTEMS-Supplementary notes (governor regulation R = (N1 − N2)/((N1 + N2)/2), heat balance
 *    40 / 30 / 30, functions of oil, SAE grades);
 *  - 509 Lecture 4 (operating temperature 60–93 °C);
 *  - AEE 518 lecture notes (Routh–Hurwitz stability, used for governor hunting).
 *
 * The notes describe these systems qualitatively. Everything numeric below that is NOT in the notes
 * (flyweight dimensions, oil viscosities, pump sizes, heat-transfer coefficients, the Bernoulli
 * venturi model) is a typical textbook value and is flagged "beyond notes" where the UI shows it.
 * Shared helpers from ./engine, ./fuel and ./cooling are used read-only.
 *
 * SI units unless stated (m, kg, s, N, Pa, W, rad/s, K or °C for differences).
 */
import { capBoilingPointC } from './cooling'
import { HEAT_BALANCE_SUPP, airFlow, governorRegulation, lubeCircuit, type HeatShares, type LubeState } from './engine'
import { DENSITY, jetFuelFlow, mixtureStrength, type MixtureStrength } from './fuel'

const G = 9.80665
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const rpmToRad = (rpm: number) => (rpm * 2 * Math.PI) / 60
const radToRpm = (w: number) => (w * 60) / (2 * Math.PI)

/* ====================================================================================== */
/*  1. Air intake                                                                          */
/* ====================================================================================== */

/** Dust concentration measured above a tractor dashboard (TB §4.3): height (m) → g/m³. */
export const DUST_DATA: readonly { h: number; c: number }[] = [
  { h: 0, c: 0.565 },
  { h: 0.45, c: 0.283 },
  { h: 0.74, c: 0.141 },
]

/**
 * Dust concentration at a height above the dashboard (g/m³). Log-linear interpolation between the
 * three measured points of TB §4.3 (each step roughly halves the dust); outside them the end
 * segments are extended (flagged as an extrapolation in the UI). Height is clamped to −0.3…1.5 m.
 */
export function dustConcentration(h: number) {
  const d = DUST_DATA
  const x = clamp(h, -0.3, 1.5)
  let i = 0
  if (x > d[1].h) i = 1
  const a = d[i]
  const b = d[i + 1]
  const u = (x - a.h) / (b.h - a.h)
  return Math.exp(Math.log(a.c) + (Math.log(b.c) - Math.log(a.c)) * u)
}

/** Is a height inside the measured range of TB §4.3? */
export const dustMeasured = (h: number) => h >= DUST_DATA[0].h - 1e-9 && h <= DUST_DATA[DUST_DATA.length - 1].h + 1e-9

/** Engine air consumption (m³/s of ambient air) for a four-stroke: ηv·Vd·N/120. */
export function engineAirVolume(displacement: number, rpm: number, etaV = 0.85) {
  const rho = 1.18
  return airFlow(etaV, rho, displacement, rpm, 4) / rho
}

/** Dust carried in with the air, g/h = C (g/m³) × Q (m³/s) × 3600. */
export function dustIngestion(concentration: number, airVolume: number) {
  return concentration * airVolume * 3600
}

export type CleanerKind = 'oil-bath' | 'dry'

/**
 * Cleaning efficiency (fraction of dust removed) — beyond notes, typical values.
 *  - Oil bath: ≈ 97–98 % when the oil is at the mark and the air speed is high enough to fling dust into
 *    the oil as the air turns over its surface; with little oil only the wetted mesh works (≈ 80 %);
 *    at low air flow (idle) the dust is not thrown out so well.
 *  - Dry paper element: ≈ 99.5 %, falling slightly when the element is loaded with dust.
 */
export function cleanerEfficiency(kind: CleanerKind, opts: { oilLevel?: number; flowFraction?: number; loading?: number } = {}) {
  const flow = clamp(opts.flowFraction ?? 1, 0, 1.2)
  if (kind === 'dry') return clamp(0.995 - 0.01 * clamp(opts.loading ?? 0, 0, 1), 0, 1)
  const level = clamp(opts.oilLevel ?? 1, 0, 1.4)
  const base = 0.8 + 0.18 * Math.min(1, level)
  const flowFactor = 0.9 + 0.1 * clamp(flow / 0.5, 0, 1)
  return clamp(base * flowFactor, 0, 0.985)
}

/** Oil-bath cleaner overfilled: oil is carried over into the engine (beyond notes; typical warning). */
export const oilCarryOver = (oilLevel: number) => oilLevel > 1.15

/* ====================================================================================== */
/*  2. Centrifugal (flyweight) governor — TB §4.6, Fig 4.10                                */
/* ====================================================================================== */

/**
 * Flyweight governor geometry. Each flyweight is a bell crank pivoted on the spindle carrier: the
 * weight arm b swings out as speed rises and the toe arm c pushes the thrust sleeve along the
 * spindle against the governor spring. With sleeve lift x = c·sin φ the weight radius is
 * r = rp + (b/c)·x, and the sleeve force from n weights is F = n·m·(b/c)·r·Ω².
 */
export interface FlyweightGovernor {
  n: number
  /** mass of each flyweight, kg */
  m: number
  /** pivot radius from the spindle axis, m */
  rp: number
  /** weight arm (pivot → centre of mass), m */
  b: number
  /** toe arm (pivot → sleeve contact), m */
  c: number
  /** spindle speed / engine speed */
  ratio: number
  /** sleeve travel from full fuel (x = 0) to no fuel, m */
  xStop: number
  /** mechanical stop for the sleeve, m */
  xMax: number
  /** flyweight + sleeve inertia referred to the sleeve, kg */
  M: number
}

/** Governed engine: T = u·Tfull·(1 + backup·(1 − ω/ωref)) − (f0 + f1·ω). */
export interface GovernedEngine {
  /** engine + flywheel + driven inertia, kg·m² */
  J: number
  /** full-fuel torque at ωref, N·m */
  Tfull: number
  wRef: number
  /** torque back-up as speed falls */
  backup: number
  f0: number
  f1: number
}

/** Typical values for a ≈ 35 kW four-cylinder tractor diesel and its governor (beyond notes). */
export const TYPICAL_GOVERNOR: FlyweightGovernor = { n: 2, m: 0.4, rp: 0.035, b: 0.05, c: 0.025, ratio: 0.5, xStop: 0.008, xMax: 0.0095, M: 3.3 }
export const TYPICAL_GOVERNED_ENGINE: GovernedEngine = { J: 0.8, Tfull: 270, wRef: rpmToRad(1500), backup: 0.12, f0: 12, f1: 0.06 }

export const flyweightRadius = (g: FlyweightGovernor, x: number) => g.rp + (g.b / g.c) * x
/** Flyweight swing angle φ from sleeve lift: x = c·sin φ. */
export const flyweightAngle = (g: FlyweightGovernor, x: number) => Math.asin(clamp(x / g.c, -1, 1))

/** Sleeve force from the flyweights at engine speed ω (rad/s), N. */
export function sleeveForce(g: FlyweightGovernor, x: number, omega: number) {
  const W = g.ratio * omega
  return g.n * g.m * (g.b / g.c) * flyweightRadius(g, x) * W * W
}

/** Fuel (rack or throttle) fraction 0…1: the rising sleeve pulls the rack towards "stop". */
export const fuelFraction = (g: FlyweightGovernor, x: number) => clamp(1 - x / g.xStop, 0, 1)

export const fullTorqueAt = (e: GovernedEngine, omega: number) => e.Tfull * (1 + e.backup * (1 - omega / e.wRef))

/** Net engine torque (after friction), N·m. */
export function engineTorque(e: GovernedEngine, u: number, omega: number) {
  return u * fullTorqueAt(e, omega) - (e.f0 + e.f1 * omega)
}

/** Engine speed (rad/s) at which the flyweights balance the spring with the sleeve at x. */
export function equilibriumSpeed(g: FlyweightGovernor, k: number, s0: number, x: number) {
  const A = g.n * g.m * (g.b / g.c) * flyweightRadius(g, x)
  return Math.sqrt((k * (x + s0)) / A) / g.ratio
}

/** Sleeve position where the governor balances at engine speed ω (clamped to the stops). */
export function governorSleeveAt(g: FlyweightGovernor, k: number, s0: number, omega: number) {
  const W2 = (g.ratio * omega) ** 2
  const A = g.n * g.m * (g.b / g.c)
  const den = k - A * (g.b / g.c) * W2
  if (den <= 0) return g.xMax
  return clamp((A * g.rp * W2 - k * s0) / den, 0, g.xMax)
}

/** Steady fuel fraction needed to carry a load torque at speed ω. */
export const fuelForLoad = (e: GovernedEngine, load: number, omega: number) => (load + e.f0 + e.f1 * omega) / fullTorqueAt(e, omega)

/**
 * Choose the spring rate k and preload s0 so the governor holds `noLoadRpm` with no load and
 * `fullLoadRpm` with `fullLoadTorque` — i.e. a set speed regulation (Supp: R = (N1 − N2)/N̄).
 */
export function designGovernor(g: FlyweightGovernor, e: GovernedEngine, target: { noLoadRpm: number; fullLoadRpm: number; fullLoadTorque: number }) {
  const w1 = rpmToRad(target.noLoadRpm)
  const w2 = rpmToRad(target.fullLoadRpm)
  const x1 = g.xStop * (1 - fuelForLoad(e, 0, w1))
  const x2 = g.xStop * (1 - fuelForLoad(e, target.fullLoadTorque, w2))
  const F1 = sleeveForce(g, x1, w1)
  const F2 = sleeveForce(g, x2, w2)
  const k = (F1 - F2) / (x1 - x2)
  const s0 = F1 / k - x1
  return { k, s0, x1, x2 }
}

/** Spring preload (speed-control lever setting) that gives a chosen no-load speed. */
export function preloadForNoLoadSpeed(g: FlyweightGovernor, e: GovernedEngine, k: number, noLoadRpm: number) {
  const w = rpmToRad(noLoadRpm)
  const x = g.xStop * (1 - fuelForLoad(e, 0, w))
  return sleeveForce(g, x, w) / k - x
}

export interface GovernorSettings {
  /** load torque, N·m */
  load: number
  /** spring rate, N/m */
  k: number
  /** spring preload (speed lever), m */
  s0: number
  /** sleeve damping, N·s/m */
  c: number
}

/** Steady operating point for a load (bisection on speed). `stalled` when the load exceeds full fuel. */
export function governorSteady(g: FlyweightGovernor, e: GovernedEngine, s: GovernorSettings) {
  const net = (w: number) => engineTorque(e, fuelFraction(g, governorSleeveAt(g, s.k, s.s0, w)), w) - s.load
  let lo = 1
  let hi = 4 * e.wRef
  if (net(lo) < 0) return { omega: 0, rpm: 0, x: 0, u: 1, stalled: true }
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (net(mid) > 0) lo = mid
    else hi = mid
  }
  const omega = (lo + hi) / 2
  const x = governorSleeveAt(g, s.k, s.s0, omega)
  return { omega, rpm: radToRpm(omega), x, u: fuelFraction(g, x), stalled: false }
}

export interface GovernorState {
  /** engine speed, rad/s */
  w: number
  /** sleeve lift, m */
  x: number
  /** sleeve velocity, m/s */
  v: number
}

function govDerivs(g: FlyweightGovernor, e: GovernedEngine, s: GovernorSettings, st: GovernorState): [number, number, number] {
  const u = fuelFraction(g, st.x)
  let dw = (engineTorque(e, u, st.w) - s.load) / e.J
  if (st.w <= 0 && dw < 0) dw = 0
  const dv = (sleeveForce(g, st.x, Math.max(0, st.w)) - s.k * (st.x + s.s0) - s.c * st.v) / g.M
  return [dw, st.v, dv]
}

/**
 * Advance the engine + governor ODE by dt (RK4, sub-stepped at ≤ 0.2 ms):
 *   J·ω' = T(u(x), ω) − T_load,   M·x'' = F(x, ω) − k(x + s0) − c·x'.
 * The sleeve stops at 0 (full fuel) and xMax.
 */
export function governorStep(g: FlyweightGovernor, e: GovernedEngine, s: GovernorSettings, st: GovernorState, dt: number): GovernorState {
  if (dt <= 0) return st
  const n = Math.max(1, Math.ceil(dt / 2e-4))
  const h = dt / n
  let { w, x, v } = st
  for (let i = 0; i < n; i++) {
    const k1 = govDerivs(g, e, s, { w, x, v })
    const k2 = govDerivs(g, e, s, { w: w + (h / 2) * k1[0], x: x + (h / 2) * k1[1], v: v + (h / 2) * k1[2] })
    const k3 = govDerivs(g, e, s, { w: w + (h / 2) * k2[0], x: x + (h / 2) * k2[1], v: v + (h / 2) * k2[2] })
    const k4 = govDerivs(g, e, s, { w: w + h * k3[0], x: x + h * k3[1], v: v + h * k3[2] })
    w += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
    x += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
    v += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
    if (w < 0) w = 0
    if (x < 0) {
      x = 0
      v = Math.max(0, v)
    } else if (x > g.xMax) {
      x = g.xMax
      v = Math.min(0, v)
    }
  }
  return { w, x, v }
}

/** Governor regulation (%) from the steady no-load and full-load speeds (Supp; uses engine.ts). */
export function regulationFromSteady(noLoadRpm: number, fullLoadRpm: number) {
  return governorRegulation(noLoadRpm, fullLoadRpm)
}

/**
 * Routh–Hurwitz test (AEE518): build the Routh array for a polynomial a_n sⁿ + … + a_0 and count
 * sign changes in the first column. Stable ⇔ no sign changes (and no zero pivots).
 */
export function routh(coeffs: number[]) {
  const n = coeffs.length
  const cols = Math.ceil(n / 2)
  const rows: number[][] = [[], []]
  for (let i = 0; i < cols; i++) {
    rows[0][i] = coeffs[2 * i] ?? 0
    rows[1][i] = coeffs[2 * i + 1] ?? 0
  }
  for (let r = 2; r < n; r++) {
    const a = rows[r - 2]
    const b = rows[r - 1]
    const row: number[] = []
    for (let i = 0; i < cols; i++) {
      const piv = b[0] === 0 ? 1e-12 : b[0]
      row[i] = (piv * (a[i + 1] ?? 0) - a[0] * (b[i + 1] ?? 0)) / piv
    }
    rows.push(row)
  }
  const first = rows.map((r) => r[0])
  let changes = 0
  for (let i = 1; i < first.length; i++) if (Math.sign(first[i]) !== Math.sign(first[i - 1])) changes++
  return { first, changes, stable: changes === 0 && first.every((v) => v !== 0) }
}

/**
 * Linearised governor loop at the steady point:
 *   (J s + D)(M s² + c s + k_eff) + |K_T|·K_F = 0
 * K_T = ∂T/∂x, K_F = ∂F/∂ω, D = −∂T/∂ω, k_eff = k − ∂F/∂x. Low sleeve damping makes it unstable —
 * the governor "hunts". Returns the cubic, its Routh verdict and the critical damping.
 */
export function governorStability(g: FlyweightGovernor, e: GovernedEngine, s: GovernorSettings) {
  const op = governorSteady(g, e, s)
  const w = op.omega
  const r = flyweightRadius(g, op.x)
  const A = g.n * g.m * (g.b / g.c)
  const KT = op.x > 0 && op.x < g.xStop ? fullTorqueAt(e, w) / g.xStop : 0
  const KF = 2 * A * r * g.ratio * g.ratio * w
  const D = (op.u * e.Tfull * e.backup) / e.wRef + e.f1
  const kEff = s.k - A * (g.b / g.c) * (g.ratio * w) ** 2
  const J = e.J
  const M = g.M
  const coeffs = [J * M, J * s.c + D * M, J * kEff + D * s.c, D * kEff + KT * KF]
  const B = J * J * kEff + D * D * M
  const cCrit = D > 0 ? (-B + Math.sqrt(B * B + 4 * J * D * J * M * KT * KF)) / (2 * J * D) : (M * KT * KF) / (J * kEff)
  return { op, coeffs, ...routh(coeffs), cCrit, kEff, KT, KF, D }
}

/* ====================================================================================== */
/*  3. Lubrication — TB Ch 6 (force-feed Fig 6.2, splash Fig 6.1), Supp (SAE grades)       */
/* ====================================================================================== */

export type OilGrade = 'SAE10' | 'SAE20' | 'SAE30' | 'SAE40' | 'SAE50' | '10W30' | '20W50'

/** Kinematic viscosity at 40 °C and 100 °C, cSt — typical values (beyond notes). */
export const OIL_GRADES: Record<OilGrade, { label: string; nu40: number; nu100: number; multigrade: boolean }> = {
  SAE10: { label: 'SAE 10', nu40: 32, nu100: 5.5, multigrade: false },
  SAE20: { label: 'SAE 20', nu40: 62, nu100: 8.2, multigrade: false },
  SAE30: { label: 'SAE 30', nu40: 100, nu100: 11.2, multigrade: false },
  SAE40: { label: 'SAE 40', nu40: 145, nu100: 14.3, multigrade: false },
  SAE50: { label: 'SAE 50', nu40: 220, nu100: 19.5, multigrade: false },
  '10W30': { label: '10W/30', nu40: 70, nu100: 10.8, multigrade: true },
  '20W50': { label: '20W/50', nu40: 155, nu100: 18.5, multigrade: true },
}

/**
 * Oil kinematic viscosity (cSt) at a temperature by the Walther (ASTM D341) relation through the
 * grade's 40 °C and 100 °C values: log log(ν + 0.7) = A − B log T.
 */
export function oilViscosity(grade: OilGrade, tempC: number) {
  const o = OIL_GRADES[grade]
  const W = (nu: number) => Math.log10(Math.log10(nu + 0.7))
  const L = (tc: number) => Math.log10(tc + 273.15)
  const B = (W(o.nu40) - W(o.nu100)) / (L(100) - L(40))
  const A = W(o.nu40) + B * L(40)
  const w = A - B * L(clamp(tempC, -30, 160))
  return Math.pow(10, Math.pow(10, w)) - 0.7
}

/** Viscosity index-like flatness: ν40/ν100 (lower = flatter, as for multigrades). */
export const viscosityRatio = (grade: OilGrade) => OIL_GRADES[grade].nu40 / OIL_GRADES[grade].nu100

/** Reference ("hot") oil for the circuit model: SAE 30 at 100 °C. */
export const NU_REF = OIL_GRADES.SAE30.nu100

/** Force-feed circuit constants (typical small tractor diesel; beyond notes). */
export const LUBE_MODEL = {
  /** gear-pump displacement per pump revolution, m³ */
  pumpDisp: 20e-6,
  /** pump driven by the camshaft → half engine speed (TB Fig 6.2) */
  pumpRatio: 0.5,
  /** bearing leakage conductance with hot SAE 30, m³/s per Pa */
  bearingG: 6e-10,
  /** clean full-flow filter resistance, Pa per m³/s */
  filterR: 1.2e8,
  /** relief valve flow gain, m³/s per Pa above cracking */
  reliefK: 6e-9,
  /** over-pressure for full relief opening, Pa */
  reliefFull: 0.5e5,
}

export interface LubeInputs {
  rpm: number
  tempC: number
  grade: OilGrade
  /** relief valve setting, bar */
  reliefBar: number
  /** 1 = clean filter, 5 = badly clogged */
  filterClog: number
  /** 1 = new bearings; > 1 = worn (larger clearances leak more oil) */
  wear: number
}

export interface LubeResult extends LubeState {
  /** kinematic viscosity, cSt */
  nu: number
  /** viscosity relative to hot SAE 30 */
  rel: number
  pumpBar: number
  galleryBar: number
  pumpEff: number
  /** litres per minute */
  pumpLpm: number
  bearingLpm: number
  reliefLpm: number
}

/** Pump volumetric efficiency: thin (hot) oil slips back past the gear teeth (beyond notes). */
export const gearPumpEfficiency = (rel: number) => clamp(0.95 - 0.1 / Math.max(0.2, rel), 0.55, 0.95)

/** Steady force-feed operating point for the scene (uses lubeCircuit from ./engine). */
export function lubeOperatingPoint(i: LubeInputs): LubeResult {
  const nu = oilViscosity(i.grade, i.tempC)
  const rel = nu / NU_REF
  const pumpEff = gearPumpEfficiency(rel)
  const M = LUBE_MODEL
  const s = lubeCircuit({
    rpm: Math.max(0, i.rpm),
    pumpDisp: M.pumpDisp,
    pumpRatio: M.pumpRatio,
    pumpEff,
    bearingG: M.bearingG * Math.max(0.3, i.wear),
    viscosity: rel,
    filterR: M.filterR,
    filterClog: Math.max(1, i.filterClog),
    reliefCrack: i.reliefBar * 1e5,
    reliefK: M.reliefK,
    reliefFull: M.reliefFull,
  })
  const lpm = (q: number) => q * 60000
  return {
    ...s,
    nu,
    rel,
    pumpEff,
    pumpBar: s.pumpPressure / 1e5,
    galleryBar: s.galleryPressure / 1e5,
    pumpLpm: lpm(s.pumpFlow),
    bearingLpm: lpm(s.bearingFlow),
    reliefLpm: lpm(s.reliefFlow),
  }
}

/** Gallery pressure curve vs engine speed (bar) for a chart. */
export function lubePressureCurve(base: Omit<LubeInputs, 'rpm'>, rpms: number[]) {
  return rpms.map((rpm) => lubeOperatingPoint({ ...base, rpm }).galleryBar)
}

/* ====================================================================================== */
/*  4. Cooling — L4, Supp, TB Ch 7                                                          */
/* ====================================================================================== */

export type CoolMode = 'forced' | 'thermosiphon' | 'air'
export type ThermostatFault = 'none' | 'stuck-shut' | 'stuck-open'

export interface CoolingSpec {
  /** rated brake power, W */
  ratedPower: number
  ratedRpm: number
  /** engine metal + jacket coolant heat capacity, J/K */
  Ce: number
  /** air-cooled cylinder (fins) heat capacity, J/K */
  CeAir: number
  /** water-pump delivery per engine rpm, kg/s per rpm */
  pumpPerRpm: number
  /** thermosiphon flow coefficient, kg/s per √K */
  siphonK: number
  /** radiator UA with the fan at rated speed / natural draught only, W/K */
  UAfan: number
  UAnatural: number
  /** finned cylinder hA with the flywheel fan at rated speed / still air, W/K */
  hAfins: number
  hAstill: number
  /** metal-to-coolant conductance of the jacket, W/K */
  hAjacket: number
  /** thermostat: starts to open / fully open, °C; wax-element time constant, s */
  thOpen: number
  thFull: number
  thTau: number
  /** fraction of flow through a shut thermostat (jiggle pin / leak) */
  leak: number
}

/** Typical ≈ 40 kW tractor diesel (beyond notes). Thermostat opens ≈ 80 °C, full ≈ 92 °C. */
export const TYPICAL_COOLING: CoolingSpec = {
  ratedPower: 40e3,
  ratedRpm: 2000,
  Ce: 62_000,
  CeAir: 30_000,
  pumpPerRpm: 1e-3,
  siphonK: 0.16,
  UAfan: 900,
  UAnatural: 220,
  hAfins: 520,
  hAstill: 60,
  hAjacket: 3200,
  thOpen: 80,
  thFull: 92,
  thTau: 15,
  leak: 0.02,
}

export interface CoolingInputs {
  mode: CoolMode
  /** fraction of rated load 0…1.1 */
  load: number
  rpm: number
  ambientC: number
  /** pressure-cap setting, gauge kPa (0 = cap off / open system) */
  capKPa: number
  thermostat: ThermostatFault
  /** fan-belt slip 0…0.8 (slack belt) */
  beltSlip: number
  /** scale / deposits 0…1 */
  scale: number
  fan: boolean
}

export interface CoolingState {
  /** coolant leaving the engine (top hose), °C — or cylinder fin-root temperature when air-cooled */
  Te: number
  /** thermostat valve lift 0…1 (wax element) */
  th: number
}

export interface CoolingFlowsResult {
  /** heat into the cooling system, W */
  heat: number
  /** flow through the radiator / bypass, kg/s */
  radFlow: number
  bypassFlow: number
  /** bottom-tank (radiator outlet) temperature, °C */
  Tbottom: number
  /** pump-inlet (mixed) temperature, °C */
  Tpump: number
  /** heat rejected to the air, W */
  toAir: number
  /** radiator effectiveness 1 − e^(−NTU) */
  eff: number
  /** cylinder-wall (metal) temperature, °C */
  Tmetal: number
  boilC: number
  boiling: boolean
  /** fan/pump speed after belt slip, rpm */
  beltRpm: number
}

/** Thermostat lift for a temperature (linear between start-to-open and fully-open), 0…1. */
export function thermostatTarget(spec: CoolingSpec, Tc: number) {
  return clamp((Tc - spec.thOpen) / (spec.thFull - spec.thOpen), 0, 1)
}

/**
 * Heat into the cooling system, W. Supp heat balance: 30 % of the fuel energy goes to the coolant
 * when 30 % is useful work, so Q_cool = (cooling share / work share) × (BP + friction). Friction
 * power ≈ 10 % of rated power at rated speed (beyond notes; Misc p3 gives friction 7–10 % of IP).
 */
export function heatToCoolant(spec: CoolingSpec, load: number, rpm: number, shares: HeatShares = HEAT_BALANCE_SUPP) {
  const speed = Math.max(0, rpm) / spec.ratedRpm
  const bp = clamp(load, 0, 1.2) * spec.ratedPower * speed
  const fp = 0.1 * spec.ratedPower * speed * speed
  const work = 1 - shares.exhaust - shares.cooling
  return ((bp + fp) * shares.cooling) / work
}

const CP = 4186

/** Instantaneous flows for a state (quasi-steady radiator, effectiveness–NTU). */
export function coolingFlows(spec: CoolingSpec, inp: CoolingInputs, s: CoolingState): CoolingFlowsResult {
  const heat = heatToCoolant(spec, inp.load, inp.rpm)
  const beltRpm = inp.rpm * (1 - clamp(inp.beltSlip, 0, 0.95))
  const fanF = inp.fan ? Math.pow(beltRpm / spec.ratedRpm, 0.8) : 0
  const boilC = inp.mode === 'air' ? Infinity : capBoilingPointC(Math.max(0, inp.capKPa))
  if (inp.mode === 'air') {
    // flywheel fan runs at crank speed (no belt)
    const flyF = inp.fan ? Math.pow(Math.max(0, inp.rpm) / spec.ratedRpm, 0.8) : 0
    const hA = (spec.hAstill + (spec.hAfins - spec.hAstill) * flyF) * (1 - 0.5 * clamp(inp.scale, 0, 1))
    const toAir = hA * (s.Te - inp.ambientC)
    return { heat, radFlow: 0, bypassFlow: 0, Tbottom: inp.ambientC, Tpump: inp.ambientC, toAir, eff: 1, Tmetal: s.Te, boilC, boiling: false, beltRpm: inp.rpm }
  }
  const scale = clamp(inp.scale, 0, 1)
  const UA = (spec.UAnatural + (spec.UAfan - spec.UAnatural) * fanF) * (1 - 0.6 * scale)
  const open = spec.leak + (1 - spec.leak) * s.th
  let radFlow: number
  let bypassFlow = 0
  let eff = 0
  if (inp.mode === 'forced') {
    const total = spec.pumpPerRpm * beltRpm
    radFlow = total * open
    bypassFlow = total - radFlow
    eff = radFlow > 0 ? 1 - Math.exp(-UA / (radFlow * CP)) : 1
  } else {
    // thermosiphon: buoyancy head ∝ hot-leg − cold-leg temperature difference; flow ∝ √ΔT (beyond notes)
    radFlow = 0.02
    for (let i = 0; i < 12; i++) {
      eff = 1 - Math.exp(-UA / (Math.max(1e-4, radFlow) * CP))
      const dT = eff * Math.max(0, s.Te - inp.ambientC)
      radFlow = 0.5 * radFlow + 0.5 * spec.siphonK * Math.sqrt(dT) * open
    }
    eff = radFlow > 0 ? 1 - Math.exp(-UA / (radFlow * CP)) : 1
  }
  const Tbottom = s.Te - eff * (s.Te - inp.ambientC)
  const total = radFlow + bypassFlow
  const Tpump = total > 0 ? (radFlow * Tbottom + bypassFlow * s.Te) / total : s.Te
  const toAir = radFlow * CP * (s.Te - Tbottom)
  const Tmetal = s.Te + heat / (spec.hAjacket * (1 - 0.75 * scale))
  return { heat, radFlow, bypassFlow, Tbottom, Tpump, toAir, eff, Tmetal, boilC, boiling: s.Te >= boilC - 0.05, beltRpm }
}

/** Advance the cooling ODE: C·dTe/dt = Q_in − Q_air; τ·dth/dt = target(Te) − th. Boiling clamps Te. */
export function coolingStep(spec: CoolingSpec, inp: CoolingInputs, s: CoolingState, dt: number): CoolingState {
  const n = Math.max(1, Math.ceil(dt / 0.25))
  const h = dt / n
  let { Te, th } = s
  for (let i = 0; i < n; i++) {
    const f = coolingFlows(spec, inp, { Te, th })
    const C = inp.mode === 'air' ? spec.CeAir : spec.Ce
    Te += (h * (f.heat - f.toAir)) / C
    if (inp.mode !== 'air') Te = Math.min(f.boilC, Te)
    const target = inp.thermostat === 'stuck-shut' ? 0 : inp.thermostat === 'stuck-open' ? 1 : thermostatTarget(spec, Te)
    th += ((target - th) * h) / spec.thTau
    th = clamp(th, 0, 1)
  }
  return { Te, th }
}

/** March to a steady state (tests and the panel's "settles at" readout). */
export function coolingSteady(spec: CoolingSpec, inp: CoolingInputs, start?: CoolingState, seconds = 8000) {
  let s = start ?? { Te: inp.ambientC, th: 0 }
  for (let t = 0; t < seconds; t += 2) s = coolingStep(spec, inp, s, 2)
  return s
}

/* ====================================================================================== */
/*  5. Carburettor — TB §4.4 (Fig 4.7); venturi/jet flow beyond notes                     */
/* ====================================================================================== */

export interface CarbSpec {
  /** barrel (bore) diameter, m */
  boreD: number
  /** venturi throat diameter, m */
  venturiD: number
  venturiCd: number
  /** main jet diameter, m */
  jetD: number
  jetCd: number
  /** design height of the jet tip above the float-chamber fuel level, m */
  lift: number
  /** idle (slow-running) jet, m */
  idleJetD: number
  /** engine swept volume, m³; volumetric efficiency at wide-open throttle */
  displacement: number
  etaV: number
  /** throttle and choke butterflies: closed-position leak area as a fraction of the bore */
  leak: number
}

/** Typical small tractor petrol / TVO engine carburettor (beyond notes). */
export const TYPICAL_CARB: CarbSpec = {
  boreD: 0.032,
  venturiD: 0.024,
  venturiCd: 0.92,
  jetD: 0.00129,
  jetCd: 0.72,
  lift: 0.005,
  idleJetD: 0.00045,
  displacement: 2.0e-3,
  etaV: 0.85,
  leak: 0.012,
}

export interface CarbInputs {
  rpm: number
  /** throttle 0 (closed) … 1 (wide open) */
  throttle: number
  /** choke 0 (open) … 1 (closed) */
  choke: number
  /** float-chamber level error, m (+ = higher than design → less lift → richer) */
  levelError?: number
  idleCircuit?: boolean
  ambientKPa?: number
  ambientC?: number
}

export interface CarbResult {
  /** air mass flow, kg/s */
  air: number
  /** manifold absolute pressure, kPa */
  manifoldKPa: number
  /** venturi throat velocity, m/s */
  throatV: number
  /** venturi throat depression below atmosphere, Pa */
  throatDep: number
  /** depression at the main jet (venturi + choke), Pa */
  jetDep: number
  mainFuel: number
  idleFuel: number
  fuel: number
  /** air–fuel ratio by mass (Infinity when no fuel) */
  af: number
  strength: MixtureStrength
  /** jet-tip lift actually used (design ± level error), m */
  lift: number
}

/** Butterfly open area as a fraction of the bore: 1 − cos θ, θ = opening × 90°, plus a leak. */
export const butterflyArea = (opening: number, leak: number) => clamp(leak + (1 - leak) * (1 - Math.cos((clamp(opening, 0, 1) * Math.PI) / 2)), leak, 1)

/** Compressible orifice mass flow (kg/s) from p1 to p2 (Pa) at T (K), area A, coefficient Cd. */
export function orificeMassFlow(p1: number, p2: number, T: number, A: number, Cd: number) {
  const k = 1.4
  const R = 287
  if (p2 >= p1) return 0
  const pr = Math.max(p2 / p1, 0.5283)
  const f = Math.sqrt(((2 * k) / (k - 1)) * (Math.pow(pr, 2 / k) - Math.pow(pr, (k + 1) / k)))
  return (Cd * A * p1 * f) / Math.sqrt(R * T)
}

/**
 * Carburettor operating point. The engine draws ṁa = ηv·(pm/RT)·Vd·N/120 through choke → venturi →
 * throttle; the manifold pressure pm balances engine demand and throttle flow. Bernoulli at the
 * throat gives the depression Δp = ½ρv² that lifts fuel from the float chamber up the main jet:
 * ṁf = Cd·A·√(2ρf(Δp − ρf·g·h)). A closed choke adds its own depression at the jet (rich start);
 * near-closed throttle the idle jet below the butterfly feeds the engine from manifold vacuum.
 * All of this flow modelling is beyond the notes (TB §4.4 gives the parts and the 1 : 15 mixture).
 */
export function carburettor(spec: CarbSpec, inp: CarbInputs): CarbResult {
  const p0 = (inp.ambientKPa ?? 101.325) * 1000
  const T = (inp.ambientC ?? 25) + 273.15
  const rho0 = p0 / (287 * T)
  const Abore = (Math.PI / 4) * spec.boreD ** 2
  const Av = (Math.PI / 4) * spec.venturiD ** 2
  const At = butterflyArea(inp.throttle, spec.leak) * Abore
  // the choke plate has a spring-loaded relief, so even fully shut it passes ≈ 10 % of the bore
  const Ac = butterflyArea(1 - inp.choke, 0.1) * Abore
  const dyn = (m: number, A: number, cd: number) => 0.5 * rho0 * (m / (cd * A * rho0)) ** 2
  const demand = (pm: number) => (spec.etaV * (pm / (287 * T)) * spec.displacement * Math.max(0, inp.rpm)) / 120
  let air = 0
  let pm = p0
  if (inp.rpm > 0) {
    let lo = 100
    let hi = p0 - 1
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2
      const m = demand(mid)
      const p1 = p0 - dyn(m, Ac, 0.8) - 0.15 * dyn(m, Av, spec.venturiCd)
      const mt = orificeMassFlow(p1, mid, T, At, 0.8)
      if (mt > m) lo = mid
      else hi = mid
    }
    pm = (lo + hi) / 2
    air = demand(pm)
  }
  const chokeDep = dyn(air, Ac, 0.8)
  const throatV = air / (spec.venturiCd * Av * rho0)
  const throatDep = 0.5 * rho0 * throatV * throatV
  const jetDep = throatDep + chokeDep
  const rhoF = DENSITY.petrol
  const lift = Math.max(0, spec.lift - (inp.levelError ?? 0))
  const mainFuel = jetFuelFlow(jetDep, (Math.PI / 4) * spec.jetD ** 2, spec.jetCd, rhoF, lift)
  let idleFuel = 0
  if (inp.idleCircuit !== false) {
    // idle port is just below the closed butterfly: fades out as the throttle opens past ≈ 25 %
    const fade = 1 - clamp((inp.throttle - 0.06) / 0.22, 0, 1)
    idleFuel = fade * jetFuelFlow(Math.max(0, p0 - pm) * 0.02, (Math.PI / 4) * spec.idleJetD ** 2, 0.7, rhoF, lift + 0.01)
  }
  const fuel = mainFuel + idleFuel
  const af = fuel > 0 ? air / fuel : Infinity
  return { air, manifoldKPa: pm / 1000, throatV, throatDep, jetDep, mainFuel, idleFuel, fuel, af, strength: mixtureStrength(af), lift }
}

export interface FloatSpec {
  /** float-chamber plan area, m² */
  area: number
  /** needle-seat diameter, m */
  seatD: number
  /** needle travel from shut to fully open, m */
  travel: number
  /** float rise (level band) that closes the needle fully, m */
  band: number
  /** lift-pump delivery pressure, Pa */
  pumpPressure: number
  /** design fuel level (needle just shut), m above the chamber floor */
  levelSet: number
}

/** Typical float chamber (beyond notes). */
export const TYPICAL_FLOAT: FloatSpec = { area: 1.6e-3, seatD: 0.0018, travel: 0.0012, band: 0.002, pumpPressure: 25e3, levelSet: 0.022 }

/** Needle-valve opening 0…1 for a fuel level: the float lifts the needle onto its seat. */
export const needleOpening = (f: FloatSpec, level: number) => clamp((f.levelSet - level) / f.band, 0, 1)

/** Fuel inflow past the needle valve, kg/s (orifice: curtain area π·d·lift). */
export function needleInflow(f: FloatSpec, level: number) {
  const A = Math.PI * f.seatD * f.travel * needleOpening(f, level)
  return 0.65 * A * Math.sqrt(2 * DENSITY.petrol * f.pumpPressure)
}

/** Advance the float-chamber level: A·ρ·dh/dt = inflow − fuel drawn by the jets. */
export function floatStep(f: FloatSpec, level: number, fuelOut: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt / 0.002))
  const h = dt / n
  let L = level
  for (let i = 0; i < n; i++) L += (h * (needleInflow(f, L) - fuelOut)) / (DENSITY.petrol * f.area)
  return clamp(L, 0, f.levelSet + 0.01)
}

/** Steady level for a fuel draw (needle opening that matches demand). */
export function floatSteadyLevel(f: FloatSpec, fuelOut: number) {
  const full = needleInflow(f, -1)
  const open = clamp(fuelOut / full, 0, 1)
  return f.levelSet - open * f.band
}

/** Petrol: hydrostatic head of the jet lift, Pa (ρ g h). */
export const liftHead = (h: number) => DENSITY.petrol * G * h
