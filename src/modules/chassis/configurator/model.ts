import { create } from 'zustand'
import { dynamicLoads, type Chassis } from '@/physics/chassis'
import { efficiencyAt, leverForRatio, outputRatio } from '@/physics/cvt'
import { BRIXIUS, brixius, mobilityNumber, rutDepth } from '@/physics/traction'
import { FARMLAND_ENGINE, torqueAt } from '@/physics/tractor'

/**
 * Tractor configurator: build a tractor from an engine, transmission, drive, tyres and ballast,
 * then test it on a job (pull, target speed, soil). Solved with the same models as the other
 * scenes — weight transfer (chassis eqs 6.4–6.5), Brixius traction, the Farmland engine curve
 * scaled to size — so a mismatched build behaves badly in the same ways a real one would.
 * Sizes, prices of nothing, typical values throughout.
 */

const g = 9.81

/* ------------------------------ catalogue ------------------------------ */

export type EngineSize = 'small' | 'medium' | 'large'
export const ENGINES: Record<EngineSize, { label: string; P: number; mass: number }> = {
  small: { label: '35 kW', P: 33.5e3, mass: 2850 },
  medium: { label: '75 kW', P: 75e3, mass: 4800 },
  large: { label: '150 kW', P: 150e3, mass: 8500 },
}
/** linear size of the machine relative to the Farmland tractor (mass ∝ size³) */
export const scaleOf = (e: EngineSize) => Math.cbrt(ENGINES[e].mass / ENGINES.small.mass)

export const RATED_RPM = 2250
export const HIGH_IDLE = 2390

export type Transmission = 'gear8' | 'ps16' | 'cvt'
export const TRANSMISSIONS: Record<Transmission, { label: string; eta: number; speeds: number[] }> = {
  /** theoretical speeds (km/h, no slip) at rated engine speed */
  gear8: { label: '8-speed gearbox', eta: 0.92, speeds: [2.4, 3.5, 5.0, 6.8, 9.2, 12.5, 18, 27] },
  ps16: { label: '16-speed powershift', eta: 0.9, speeds: Array.from({ length: 16 }, (_, i) => +(2 * Math.pow(15, i / 15)).toFixed(2)) },
  cvt: { label: 'CVT', eta: 0, speeds: [] },
}

export type Drive = '2wd' | 'mfwd'
export type TyreType = 'bias' | 'radial'
export type TyreWidth = 'narrow' | 'standard' | 'wide'
const WIDTH: Record<TyreWidth, number> = { narrow: 0.8, standard: 1, wide: 1.3 }

export type Soil = 'firm' | 'tilled' | 'soft'
export const SOILS: Record<Soil, { label: string; CI: number; dust: number }> = {
  firm: { label: 'Firm', CI: 1500e3, dust: 0.35 },
  tilled: { label: 'Tilled', CI: 860e3, dust: 0.8 },
  soft: { label: 'Soft', CI: 450e3, dust: 0.5 },
}

/* ------------------------------ parameters ------------------------------ */

export interface ConfigParams {
  engine: EngineSize
  trans: Transmission
  drive: Drive
  tyre: TyreType
  width: TyreWidth
  /** ballast, kg */
  front: number
  rear: number
  /** the job */
  pull: number
  target: number
  soil: Soil
}

export const DEFAULTS: ConfigParams = { engine: 'medium', trans: 'gear8', drive: '2wd', tyre: 'bias', width: 'standard', front: 0, rear: 0, pull: 18, target: 7, soil: 'tilled' }

interface Store extends ConfigParams {
  set: (p: Partial<ConfigParams>) => void
  reset: () => void
}
export const useConfig = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/* ------------------------------ the built tractor ------------------------------ */

export function build(p: Pick<ConfigParams, 'engine' | 'front' | 'rear' | 'width'>) {
  const e = ENGINES[p.engine]
  const s = scaleOf(p.engine)
  const x = 1.88 * s
  const xr0 = 0.54 * s
  const mass = e.mass + p.front + p.rear
  // front weights hang 0.6·s ahead of the front axle; rear (wheel) weights sit on the rear axle
  const xr = (e.mass * xr0 + p.front * (x + 0.6 * s)) / mass
  const chassis: Chassis = { W: mass * g, x, xr, yg: 0.13 * s, r: 0.635 * s, xd: 0.6 * s, yd: 0.45 * s }
  const k = WIDTH[p.width]
  return {
    s,
    mass,
    chassis,
    rearTyre: { b: 0.378 * s * k, d: 1.32 * s, h: 0.304 * s, delta: 0.035 * s },
    frontTyre: { b: 0.19 * s * k, d: 0.78 * s, h: 0.19 * s, delta: 0.025 * s },
    Prated: e.P,
    /** torque scale on the Farmland curve */
    kT: e.P / 33.5e3,
  }
}
export type Built = ReturnType<typeof build>

/** Full-load torque at an engine speed (Farmland curve scaled to the engine size). */
export function fullTorque(b: Built, n: number) {
  return b.kT * torqueAt(FARMLAND_ENGINE, Math.min(n, RATED_RPM))
}

/** Engine speed that delivers torque Te: on the governor line above rated, the lug curve below. NaN = stalls. */
export function engineSpeedFor(b: Built, Te: number) {
  const Tr = fullTorque(b, RATED_RPM)
  if (Te <= Tr) return RATED_RPM + (HIGH_IDLE - RATED_RPM) * (1 - Math.max(0, Te) / Tr)
  for (let n = RATED_RPM; n >= 1000; n -= 5) if (fullTorque(b, n) >= Te) return n
  return NaN
}

/* ------------------------------ traction ------------------------------ */

/**
 * Slip needed for pull P (N). 2WD: rear net traction minus front rolling resistance;
 * MFWD: both axles pull at a common slip (front lead ignored).
 */
export function traction(b: Built, p: Pick<ConfigParams, 'drive' | 'tyre' | 'soil'>, P: number) {
  const loads = dynamicLoads(b.chassis, P)
  const CI = SOILS[p.soil].CI
  const k = BRIXIUS[p.tyre]
  const Vr = loads.Vr
  const Vf = Math.max(0, loads.Vf)
  const BnR = mobilityNumber(CI, b.rearTyre.b, b.rearTyre.d, Vr / 2, b.rearTyre.delta, b.rearTyre.h)
  const BnF = mobilityNumber(CI, b.frontTyre.b, b.frontTyre.d, Math.max(1, Vf) / 2, b.frontTyre.delta, b.frontTyre.h)
  const at = (s: number) => {
    const r = brixius(BnR, s, k)
    const f = brixius(BnF, s, k)
    if (p.drive === 'mfwd') return { net: r.NTR * Vr + f.NTR * Vf, gross: r.GTR * Vr + f.GTR * Vf }
    const fr = brixius(BnF, 0, k).MRR * Vf
    return { net: r.NTR * Vr - fr, gross: r.GTR * Vr }
  }
  const smax = 0.7
  let spin = false
  let s = 0
  if (at(smax).net < P) {
    spin = true
    s = smax
  } else {
    let lo = 0
    let hi = smax
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2
      if (at(m).net < P) lo = m
      else hi = m
    }
    s = hi
  }
  const t = at(s)
  return { loads, Vr, Vf, BnR, BnF, slip: s, spin, gross: t.gross, unstable: loads.Vf <= 0 }
}

/** CVT driveline efficiency at a ground speed (the power-split model, field range to 30 km/h). */
export function cvtEta(vKmh: number) {
  const L = leverForRatio((outputRatio(1, 0) * Math.max(0.3, Math.min(30, vKmh))) / 30)
  return efficiencyAt(L) * 0.96
}

/* ------------------------------ the test ------------------------------ */

export interface Result {
  ok: boolean
  /** km/h */
  speed: number
  slip: number
  spin: boolean
  stalled: boolean
  unstable: boolean
  gear: string
  rpm: number
  load: number
  /** kW */
  Peng: number
  Pdb: number
  /** tractive efficiency (drawbar ÷ axle power) and overall (drawbar ÷ engine) */
  TE: number
  overall: number
  /** L/h */
  fuel: number
  /** front-axle share of the weight while pulling */
  frontShare: number
  /** rear tyre ground pressure, kPa */
  pressure: number
  /** rear rut depth, m */
  rut: number
  BnR: number
}

const fuelFlow = (Pkw: number, load: number) => {
  // specific consumption rises at part load (typical diesel map shape)
  const sfc = 240 * (1 + 0.45 * Math.pow(1 - Math.min(1, Math.max(0.1, load)), 2))
  return (sfc * Pkw) / 1000 / 0.835
}

export function test(p: ConfigParams): Result {
  const b = build(p)
  const P = p.pull * 1000
  const t = traction(b, p, P)
  const front = t.Vf / b.chassis.W
  const contact = b.rearTyre.b * b.rearTyre.d * 0.27
  const pressure = t.Vr / 2 / contact / 1000
  const base = { slip: t.slip, spin: t.spin, unstable: t.unstable, frontShare: front, pressure, rut: rutDepth(t.BnR, t.slip), BnR: t.BnR }
  const none: Result = { ...base, ok: false, speed: 0, stalled: false, gear: '—', rpm: 0, load: 0, Peng: 0, Pdb: 0, TE: 0, overall: 0, fuel: 0 }
  if (t.spin || t.unstable) return none
  // axle power for a ground speed v (m/s): gross traction × theoretical speed
  const axleP = (v: number) => (t.gross * v) / (1 - t.slip)

  if (p.trans === 'cvt') {
    // engine at rated speed; the CVT gives the target unless that needs more than rated power
    let v = p.target / 3.6
    for (let i = 0; i < 6; i++) {
      const need = axleP(v) / cvtEta(v * 3.6)
      if (need <= b.Prated) break
      v *= b.Prated / need
    }
    const eta = cvtEta(v * 3.6)
    const Peng = axleP(v) / eta
    const load = Peng / b.Prated
    return finish(p, base, v, `CVT ${(eta * 100).toFixed(0)} %`, RATED_RPM, load, Peng, axleP(v))
  }

  // stepped: try every gear; keep the fastest that does not stall and is not faster than asked
  const tr = TRANSMISSIONS[p.trans]
  let best: Result | null = null
  let slowest: Result | null = null
  tr.speeds.forEach((V0r, i) => {
    const omegaR = (RATED_RPM * 2 * Math.PI) / 60
    const ratio = (omegaR * b.chassis.r) / (V0r / 3.6) // engine rad/s per wheel rad/s
    const Te = (t.gross * b.chassis.r) / (ratio * tr.eta)
    const n = engineSpeedFor(b, Te)
    if (!Number.isFinite(n)) return
    const v = (V0r / 3.6) * (n / RATED_RPM) * (1 - t.slip)
    const Peng = (Te * n * 2 * Math.PI) / 60
    const r = finish(p, base, v, `gear ${i + 1}`, n, Te / fullTorque(b, n), Peng, axleP(v))
    if (!slowest || v < slowest.speed / 3.6) slowest = r
    if (r.speed <= p.target * 1.02 && (!best || r.speed > best.speed)) best = r
  })
  return best ?? slowest ?? { ...none, stalled: true }
}

function finish(p: ConfigParams, base: Pick<Result, 'slip' | 'spin' | 'unstable' | 'frontShare' | 'pressure' | 'rut' | 'BnR'>, v: number, gear: string, rpm: number, load: number, Peng: number, Paxle: number): Result {
  const Pdb = p.pull * 1000 * v
  return {
    ...base,
    ok: true,
    speed: v * 3.6,
    stalled: false,
    gear,
    rpm,
    load: Math.min(1, load),
    Peng: Peng / 1000,
    Pdb: Pdb / 1000,
    TE: Paxle > 0 ? Pdb / Paxle : 0,
    overall: Peng > 0 ? Pdb / Peng : 0,
    fuel: fuelFlow(Peng / 1000, load),
  }
}

/** Speed and slip across a range of pulls (for the chart), asking for top speed. */
export function envelope(p: ConfigParams, steps = 40) {
  const b = build(p)
  const maxPull = (b.chassis.W * 0.75) / 1000
  const xs: number[] = []
  const v: number[] = []
  const slip: number[] = []
  for (let i = 0; i <= steps; i++) {
    const pull = (maxPull * i) / steps
    const r = test({ ...p, pull, target: 40 })
    xs.push(pull)
    v.push(r.ok ? r.speed : NaN)
    slip.push(r.ok || r.slip ? r.slip * 100 : NaN)
  }
  return { xs, v, slip }
}

/* ------------------------------ verdicts ------------------------------ */

export interface Verdict {
  label: string
  pass: boolean
  value: string
  why: string
}

export function verdicts(p: ConfigParams, r: Result): Verdict[] {
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`
  return [
    { label: 'Pulls the load', pass: r.ok, value: r.spin ? 'wheels spin' : r.unstable ? 'front lifts' : r.stalled ? 'engine stalls' : 'yes', why: 'Enough grip and engine for the pull in at least one gear.' },
    { label: 'Reaches the speed', pass: r.ok && r.speed >= p.target * 0.95, value: `${r.speed.toFixed(1)} of ${p.target} km/h`, why: 'Within 5 % of the target speed.' },
    { label: 'Slip in the efficient band', pass: r.ok && r.slip >= 0.06 && r.slip <= 0.15, value: pct(r.slip), why: 'Tractive efficiency peaks at about 8–15 % slip on soil: less means too much ballast, more wastes power and wears tyres.' },
    { label: 'Front wheels can steer', pass: r.frontShare >= 0.2, value: pct(r.frontShare), why: 'At least 20 % of the weight on the front axle while pulling.' },
    { label: 'Soil not over-compacted', pass: r.pressure <= 110, value: `${r.pressure.toFixed(0)} kPa`, why: 'Rear ground pressure at or under about 110 kPa limits subsoil compaction.' },
  ]
}

/* ------------------------------ live (3D → panel) ------------------------------ */

export const live = { x: 0, laps: 0 }
