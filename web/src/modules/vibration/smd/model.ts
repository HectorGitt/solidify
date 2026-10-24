import { create } from 'zustand'
import { cite, SRC } from '@/content/citations'
import { dampingRatio, naturalFrequency, characteristicRoots, simulateSMD, stableStep, type Trace } from '@/physics/vibration'

/**
 * Spring–mass–damper rig. Frame: metres, Y up, origin at the centre of the base plate on the floor.
 * x (the physics coordinate) is measured upward from static equilibrium, so gravity drops out.
 */
export const RIG = {
  baseTop: 0.04,
  /** mass bottom face at equilibrium */
  massRest: 0.3,
  massW: 0.3,
  massH: 0.1,
  massD: 0.16,
  springX: -0.08,
  dashX: 0.08,
  guideX: 0.2,
  beamY: 0.66,
  /** piston centre at equilibrium */
  pistonRest: 0.13,
  /** largest displayed travel of the mass, m */
  travel: 0.06,
  rulerX: -0.27,
}

export const C = {
  ln: (w: string) => SRC.ln518(w),
  m12: (w: string) => SRC.m503(12, w),
  q16: (w?: string) => cite('AEE518', 'AEE  518 Q-2016-2017.doc', w),
  ms17: (w?: string) => cite('AEE518', 'AEE 518 E-2017-2018-Marking scheme.doc', w),
  mg18: (w?: string) => cite('AEE518', 'AEE 518  2018-2019-Marking Guide.doc', w),
  t19: (w?: string) => cite('AEE518', 'AEE 518 Test-2019-2020-Marking Scheme.doc', w),
  mg16: (w?: string) => cite('AEE518', 'AEE 518 MARKING GUIDE -2016-2017 SESSION.docx', w),
}

export type InputMode = 'free' | 'step' | 'sine'

export interface SmdParams {
  m: number
  k: number
  c: number
  mode: InputMode
  /** initial displacement for the free response, m */
  x0: number
  /** force amplitude (step height or sine amplitude), N */
  F0: number
  /** forcing frequency, rad/s */
  w: number
}

export const DEFAULTS: SmdParams = { m: 4, k: 5000, c: 12.5, mode: 'free', x0: 0.02, F0: 50, w: 30 }

interface Store extends SmdParams {
  set: (p: Partial<SmdParams>) => void
  reset: () => void
}

export const useSmd = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const pick = (s: SmdParams): SmdParams => ({ m: s.m, k: s.k, c: s.c, mode: s.mode, x0: s.x0, F0: s.F0, w: s.w })

export function forcing(p: SmdParams): (t: number) => number {
  if (p.mode === 'free') return () => 0
  if (p.mode === 'step') return () => p.F0
  return (t) => p.F0 * Math.sin(p.w * t)
}

/** Length of one run: long enough to settle (5 time constants), bounded to 3–14 natural periods. */
export function runLength(p: SmdParams) {
  const wn = naturalFrequency(p.k, p.m)
  const T = (2 * Math.PI) / wn
  const r = characteristicRoots(p.m, p.c, p.k)
  const slow = Math.min(Math.abs(r.re1), Math.abs(r.re2))
  const settle = slow > 1e-9 ? 5 / slow : Infinity
  let t = Math.min(Math.max(settle, 3 * T), 14 * T)
  if (p.mode === 'sine') t = Math.max(t, (12 * 2 * Math.PI) / Math.max(p.w, 1e-3))
  return Math.min(t, 60)
}

export interface Run {
  p: SmdParams
  tEnd: number
  h: number
  trace: Trace
  xMax: number
  /** display gain: metres on screen per metre of x */
  gain: number
  wn: number
  zeta: number
}

let cacheKey = ''
let cache: Run | null = null

/** The full RK4 run for the current parameters (cached), shared by the 3D view and the panel. */
export function getRun(p: SmdParams): Run {
  const key = JSON.stringify(pick(p))
  if (cache && key === cacheKey) return cache
  const tEnd = runLength(p)
  const h = stableStep(p.m, p.c, p.k, p.mode === 'sine' ? p.w : 0)
  const x0 = p.mode === 'free' ? p.x0 : 0
  const trace = simulateSMD(p.m, p.c, p.k, forcing(p), x0, 0, tEnd, 900, h)
  const xMax = Math.max(1e-9, ...trace.x.map(Math.abs))
  cache = { p: pick(p), tEnd, h, trace, xMax, gain: RIG.travel / xMax, wn: naturalFrequency(p.k, p.m), zeta: dampingRatio(p.c, p.k, p.m) }
  cacheKey = key
  return cache
}

/* ------------------------------ live values (3D → panel) ------------------------------ */

export const live = { t: 0, x: 0, v: 0, a: 0, F: 0, tEnd: 1 }
