import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { bisect, simulateControl, topLinkForce, type ControlMode, type ControlParams, type ControlTrace, type DraftPlant } from '@/physics/linkageControl'
import { DEFAULT_LINKAGE, phiForHitchHeight, solveLinkage } from '@/tractor/linkage'
import { loadsFor } from '../three-point/model'
import { PLOUGH_WIDTH, ploughDepth } from '../three-point/plough'

export const C = {
  draft: [SRC.hy510('p3–4 Fig 41 draft control')],
  alt: [SRC.hy510('p4–5 torque and lower-link sensing')],
  other: [SRC.hy510('p5–6 position, pressure and flow control')],
  circuit: [SRC.hy510('p1–3 Fig 40 lift circuit')],
}

/** Soil-force angle used for the plough (below horizontal). */
export const THETA = (10 * Math.PI) / 180
/** Sensing-spring stiffness for display (heavy spring; beyond notes). */
export const SPRING_K = 250e3

const g = DEFAULT_LINKAGE
const poseAt = (h: number) => solveLinkage(phiForHitchHeight(h, g), g)

/** The shared tractor's linkage carrying the mounted plough. */
export const PLANT: DraftPlant = {
  depth: (h) => ploughDepth(poseAt(h)),
  compression: (h, D) => {
    const p = poseAt(h)
    const d = ploughDepth(p)
    return topLinkForce(p, g, loadsFor(d, D / Math.cos(THETA), THETA))
  },
  hMin: 0.18,
  hMax: 0.75,
}

/** Hitch height that gives a depth (bisection). */
export function hitchForDepth(d: number) {
  return bisect((h) => PLANT.depth(h) - d, PLANT.hMin, PLANT.hMax) ?? 0.35
}

export interface DraftParams {
  mode: ControlMode
  /** target working depth used to set both levers, m */
  depth: number
  /** response knob 0 (slow) … 1 (fast) */
  response: number
  /** mean specific soil resistance, kN/m² */
  k0: number
  variability: number
  /** forward speed, km/h */
  speed: number
  flows: boolean
}

export const DEFAULTS: DraftParams = { mode: 'draft', depth: 0.18, response: 0.45, k0: 50, variability: 0.6, speed: 5.4, flows: true }

interface Store extends DraftParams {
  set: (p: Partial<DraftParams>) => void
  reset: () => void
}
export const useDraft = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const FIELD = 60

/** Lever settings that give the target depth in the mean soil. */
export function settings(p: DraftParams) {
  const setH = hitchForDepth(p.depth)
  const D = p.k0 * 1000 * PLOUGH_WIDTH * p.depth
  const setC = PLANT.compression(setH, D)
  return { setH, setC, setD: D }
}

export function controlParams(p: DraftParams, mode: ControlMode): ControlParams {
  const s = settings(p)
  return {
    mode,
    setC: s.setC,
    setH: s.setH,
    response: p.response,
    k0: p.k0 * 1000,
    variability: p.variability,
    speed: p.speed / 3.6,
    width: PLOUGH_WIDTH,
    length: FIELD,
    // dropped into work from the raised position at the start of the run
    h0: Math.min(PLANT.hMax, s.setH + 0.2),
  }
}

let cacheKey = ''
let cache: { draft: ControlTrace; position: ControlTrace } | null = null
/** Both runs over the same field (memoised on the parameters). */
export function traces(p: DraftParams) {
  const key = [p.depth, p.response, p.k0, p.variability, p.speed].join('|')
  if (key !== cacheKey || !cache) {
    cache = { draft: simulateControl(controlParams(p, 'draft'), PLANT), position: simulateControl(controlParams(p, 'position'), PLANT) }
    cacheKey = key
  }
  return cache
}

export interface LiveDraft {
  x: number
  h: number
  depth: number
  draft: number
  comp: number
  k: number
  rate: number
  other: { depth: number; draft: number }
}
export const live: LiveDraft = { x: 0, h: 0.35, depth: 0, draft: 0, comp: 0, k: 0, rate: 0, other: { depth: 0, draft: 0 } }
