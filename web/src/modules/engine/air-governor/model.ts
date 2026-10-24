import { create } from 'zustand'
import { FIRING_4, engineLayout } from '@/machines/layout'
import {
  TYPICAL_GOVERNED_ENGINE,
  TYPICAL_GOVERNOR,
  cleanerEfficiency,
  designGovernor,
  dustConcentration,
  dustIngestion,
  engineAirVolume,
  governorStability,
  governorSteady,
  preloadForNoLoadSpeed,
  type CleanerKind,
  type GovernorState,
} from '@/physics/engineSystems'

/**
 * Two stations on one bench (metres, Y up):
 *  - left: oil-bath air cleaner (TB Fig 4.4) and dry element cleaner (TB Fig 4.3);
 *  - right: a centrifugal flyweight governor (TB Fig 4.10) on a horizontal spindle gear-driven at
 *    half engine speed, linked to the injection-pump rack, on a tractor diesel loaded by a brake.
 */
export const OB = { x: -0.42, oilTop: 0.06, tubeTop: 0.34 }
export const DR = { x: -0.15 }
/** Dashboard level for the intake-height experiment (TB §4.3). */
export const DASH_Y = 0.5
export const GY = 0.16
export const CRANK_Y = 0.025
export const GOV = {
  gearX: 0.155,
  pivotX: 0.2,
  /** toe-roller radius: the sleeve face sits this far beyond the toe tip */
  roller: 0.003,
  sleeveLen: 0.03,
  springFree: 0.07,
  forkPivot: { x: 0.218, y: GY + 0.105 },
  forkLen: 0.093,
  forkTop: 0.04,
  leverPivot: { x: 0.3, y: GY + 0.105 },
}

/**
 * The governed engine is the shared four-cylinder (src/machines/Engine), crank along X with its timing
 * end towards the governor: a 30-tooth gear on the crank nose drives the governor spindle. The rig
 * (governor, engine, brake) is laid out in its own frame, shifted RIG_X along X clear of the air
 * cleaners; the engine is turned a quarter turn so its own frame maps (x, y, z) → (z, y, −x).
 */
const EL = engineLayout(FIRING_4)
export const RIG_X = 0.68
/** crank-nose gear: this far ahead of cylinder 1 (past the timing gears and pulley) */
const GEAR_AHEAD = 0.23
/** rig-frame x of the engine's centre */
export const ENGINE_X = GOV.gearX - GEAR_AHEAD - EL.front
/** brake drum on the crank tail behind the flywheel (engine-frame z of its front face) */
export const DRUM_EZ = EL.flywheelZ - 0.12
/** rig-frame x of the brake band's centre */
export const BRAKE_X = ENGINE_X + DRUM_EZ + 0.0225
/** engine-frame z of the crank-nose gear */
export const GEAR_EZ = EL.front + GEAR_AHEAD
export const ENGINE_FLYWHEEL_EZ = EL.flywheelZ

/** Engine swept volume for the air-consumption estimate (4-cylinder tractor diesel; beyond notes). */
export const DISPLACEMENT = 3.3e-3

export const G = TYPICAL_GOVERNOR
export const E = TYPICAL_GOVERNED_ENGINE
/** Full-load torque and the Supp example speeds used to size the governor spring. */
export const FULL_LOAD = 220
export const DESIGN = designGovernor(G, E, { noLoadRpm: 1600, fullLoadRpm: 1500, fullLoadTorque: FULL_LOAD })

export interface AirGovParams {
  /** load torque, N·m */
  load: number
  /** speed-control lever: the no-load speed it is set for, rpm */
  setRpm: number
  /** sleeve damping, N·s/m */
  damping: number
  cleaner: CleanerKind
  /** intake height above the dashboard, m */
  height: number
  /** oil-bath oil level, fraction of the mark */
  oilLevel: number
  flows: boolean
}

export const DEFAULTS: AirGovParams = { load: 0, setRpm: 1600, damping: 200, cleaner: 'oil-bath', height: 0.45, oilLevel: 1, flows: true }

interface Store extends AirGovParams {
  set: (p: Partial<AirGovParams>) => void
  reset: () => void
}

export const useAirGov = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => {
    resetGovernor()
    set(DEFAULTS)
  },
}))

export const preload = (setRpm: number) => preloadForNoLoadSpeed(G, E, DESIGN.k, setRpm)

export function settings(p: Pick<AirGovParams, 'load' | 'setRpm' | 'damping'>) {
  return { load: p.load, k: DESIGN.k, s0: preload(p.setRpm), c: p.damping }
}

/** Steady speeds and regulation for the current lever setting (panel + working). */
export function steadyPair(p: Pick<AirGovParams, 'setRpm' | 'damping'>) {
  const n1 = governorSteady(G, E, settings({ ...p, load: 0 }))
  const n2 = governorSteady(G, E, settings({ ...p, load: FULL_LOAD }))
  return { n1, n2 }
}

export function stability(p: Pick<AirGovParams, 'load' | 'setRpm' | 'damping'>) {
  return governorStability(G, E, settings(p))
}

export function dust(p: Pick<AirGovParams, 'height' | 'cleaner' | 'oilLevel'>, rpm: number) {
  const C = dustConcentration(p.height)
  const Q = engineAirVolume(DISPLACEMENT, rpm)
  const inGph = dustIngestion(C, Q)
  const eff = cleanerEfficiency(p.cleaner, { oilLevel: p.oilLevel, flowFraction: rpm / 2000 })
  return { C, Q, inGph, eff, passGph: inGph * (1 - eff) }
}

/* ------------------------------ live state ------------------------------ */

const HIST = 600
export const live = {
  state: { w: (1600 * Math.PI) / 30, x: DESIGN.x1, v: 0 } as GovernorState,
  t: 0,
  /** history ring (sampled every 5 ms of sim time): time, rpm, fuel % */
  hist: { t: new Float64Array(HIST), rpm: new Float64Array(HIST), fuel: new Float64Array(HIST), head: 0, n: 0, acc: 0 },
  /** dust collected in the oil cup / dust cup since entering, g (display) */
  collected: 0,
}

export function resetGovernor() {
  const s = steadyPair(DEFAULTS)
  live.state = { w: s.n1.omega, x: s.n1.x, v: 0 }
  live.t = 0
  live.hist.head = 0
  live.hist.n = 0
  live.collected = 0
}

export function pushHistory(t: number, rpm: number, fuel: number) {
  const h = live.hist
  h.t[h.head] = t
  h.rpm[h.head] = rpm
  h.fuel[h.head] = fuel
  h.head = (h.head + 1) % HIST
  h.n = Math.min(HIST, h.n + 1)
}

/** Ordered copy of the history for a chart. */
export function historyArrays() {
  const h = live.hist
  const t: number[] = []
  const rpm: number[] = []
  const fuel: number[] = []
  for (let i = 0; i < h.n; i++) {
    const k = (h.head - h.n + i + HIST) % HIST
    t.push(h.t[k])
    rpm.push(h.rpm[k])
    fuel.push(h.fuel[k])
  }
  return { t, rpm, fuel }
}

resetGovernor()
