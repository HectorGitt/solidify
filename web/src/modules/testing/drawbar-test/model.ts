import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { chassisDynoPoint, cylinderPressure, drawbarPoint, linkStrain, springElongation, type DrawbarPoint, type Surface } from '@/physics/testing'
import { FARMLAND_GEARS } from '@/physics/tractor'

/**
 * Drawbar testing (TESTS §15.9–15.13): the Nebraska tractor test car with its hydraulic drawbar
 * cylinder, the strain-gauge link and the Dillon spring dial on the hitch line; and the Uppsala
 * chassis dynamometer. The tractor is the shared Farmland tractor (MECH Fig 2.2 engine and gears).
 */

export const C = {
  spring: SRC.tests502('p10 [359], §15.9, Fig 15.6'),
  car: SRC.tests502('p10–11 [359–360], §15.10, Fig 15.7'),
  gauge: SRC.tests502('p11–12 [360–361], §15.11, Fig 15.8'),
  chassis: SRC.tests502('p12–13 [361–362], §15.13, Fig 15.10'),
  criteria: SRC.tests502('p1–2, performance criteria'),
  mech: (w: string) => SRC.mech502(w),
  l27: (w: string) => SRC.l27(w),
  mac: SRC.mac502('eq 6.4, App. II Farmland tractor'),
  hydDyno: SRC.tests502('p6, Fig 15.3, N³D⁵'),
}

export type Mode = 'car' | 'dyno'
export type Meter = 'cylinder' | 'link' | 'dillon'
export type Gear = 3 | 5 | 7

export interface DrawbarParams {
  mode: Mode
  gear: Gear
  /** hand throttle 0…1 (1 = open throttle, the test condition) */
  throttle: number
  /** load the test car applies, kN */
  pull: number
  surface: 'concrete' | 'soil'
  /** cone index for soil, kPa */
  CI: number
  meter: Meter
  /** throttling-valve setting 0 (open, no damping) … 1 (heavily damped) */
  damping: number
  ideal: boolean
  /** chassis dynamometer: range gearbox ratio (1…7.7) and absorber setting (0…1) */
  k: number
  s: number
}

export const DEFAULTS: DrawbarParams = { mode: 'car', gear: 5, throttle: 1, pull: 12, surface: 'concrete', CI: 860, meter: 'cylinder', damping: 0.5, ideal: false, k: 4, s: 0.6 }

interface Store extends DrawbarParams {
  set: (p: Partial<DrawbarParams>) => void
  reset: () => void
}

export const useDrawbar = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => {
    stopRun()
    set(DEFAULTS)
  },
}))

/** Hydraulic drawbar cylinder of the test car (typical bore, beyond the notes). */
export const CYL = { bore: 0.1, rod: 0.045 }
/** Dillon dial: full scale 20 (×1000 lbf in Fig 15.6) on one needle turn; here 0–100 kN over 0.9 turn, spring rate 2 MN/m (typical). */
export const DILLON = { fullScale: 100000, k: 2.0e6 }
/** Strain-gauge link: steel, 40 × 25 mm gauge section (typical, beyond the notes). */
export const LINK = { E: 205e9, A: 0.04 * 0.025 }

export const surfaceOf = (p: Pick<DrawbarParams, 'surface' | 'CI'>): Surface => (p.surface === 'concrete' ? { kind: 'concrete' } : { kind: 'soil', CI: p.CI * 1000 })

/** Steady point for the current settings. */
export function solve(p: DrawbarParams): DrawbarPoint & { dyno?: ReturnType<typeof chassisDynoPoint> } {
  const q = FARMLAND_GEARS[p.gear]
  if (p.mode === 'dyno') {
    const d = chassisDynoPoint(q, p.k, p.s, p.throttle)
    return { ...d, dyno: d }
  }
  return drawbarPoint({ P: p.pull * 1000, q, surface: surfaceOf(p), throttle: p.throttle, ideal: p.ideal })
}

/** Cached solve (recomputed only when the parameters change). */
let cacheKey = ''
let cacheVal: ReturnType<typeof solve> | null = null
export function solveCached(p: DrawbarParams) {
  const key = `${p.mode}|${p.gear}|${p.throttle}|${p.pull}|${p.surface}|${p.CI}|${p.ideal}|${p.k}|${p.s}`
  if (key !== cacheKey || !cacheVal) {
    cacheKey = key
    cacheVal = solve(p)
  }
  return cacheVal
}

/** What each instrument shows for a pull P (N). */
export function instrument(P: number) {
  return {
    // the pull acts on the rod-side annulus: effective bore √(D² − d²)
    pressureMPa: cylinderPressure(P, Math.sqrt(CYL.bore ** 2 - CYL.rod ** 2)) / 1e6,
    springMm: springElongation(P, DILLON.k) * 1000,
    microstrain: linkStrain(P, LINK.E, LINK.A) * 1e6,
  }
}

/** Implement-like fluctuation of the pull about its mean (illustrative, beyond the notes): ±~15 %. */
export function fluctuation(t: number) {
  return 0.09 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 17.9 + 1.3) + 0.03 * Math.sin(t * 41.1 + 0.4)
}

/** Time constant of the throttled cylinder reading, s (illustrative). */
export const dampingTau = (damping: number) => 0.02 + damping * damping * 1.6

/* ------------------------------ live values (3D → panel) ------------------------------ */

export interface RunPoint {
  P: number
  V: number
  slip: number
  rpm: number
  Pd: number
  fuelLh: number
}

export const live = {
  /** instantaneous pull, N */
  Pinst: 0,
  /** reading of the selected instrument, N */
  Pread: 0,
  /** distance travelled, m, and test-car wheel revolutions (for the slip readout) */
  dist: 0,
  wheelRevs: 0,
  run: { active: false, step: 0, t: 0, points: [] as RunPoint[], version: 0, stoppedBy: '' as string },
}

export function startRun() {
  live.run.active = true
  live.run.step = 0
  live.run.t = 0
  live.run.points = []
  live.run.stoppedBy = ''
  live.run.version++
  useDrawbar.getState().set({ mode: 'car', pull: 0, throttle: 1, ideal: false })
}

export function stopRun(reason = '') {
  live.run.active = false
  live.run.stoppedBy = reason
  live.run.version++
}

/** Pull step and settling time of the automated test run. */
export const RUN = { stepkN: 1, settle: 1.2, slipLimit: 0.15 }
