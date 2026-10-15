import { create } from 'zustand'
import { pinHeight, type SliderCrank } from '@/physics/engine'
import { lubeOperatingPoint, type LubeResult, type OilGrade } from '@/physics/engineSystems'
import { CAM_AXIS, FIRING_4, HEAD_Y, ROCKER_AXIS, SUMP, engineLayout } from '@/machines/layout'
import { DIM as ENGINE } from '../four-stroke/model'

/**
 * The lubrication system of the shared four-cylinder engine (src/machines/Engine: 100 × 124 mm,
 * firing order 1-3-4-2), laid along X: crank axis = X at y = 0, cylinder 1 and the timing gears at
 * the front (−X). The engine is mounted turned −90° about Y, so its own frame maps (x, y, z) → (−z, y, x)
 * and the camshaft side comes to z < 0, where the oil system is; the half section (z > 0 removed)
 * shows it. Metres, Y up.
 */
const E = engineLayout(FIRING_4)
/** engine-frame z along the crank → this scene's x */
const toX = (z: number) => -z

export const R = ENGINE.crankR
export const ROD = ENGINE.rodL
export const PISTON_COMP = ENGINE.pistonComp
export const SC: SliderCrank = { r: R, l: ROD }
export const CYL_X = E.cylZ.map(toX)
/** crank-pin angle of each throw (firing order 1-3-4-2: throws 1 & 4 at 0°, 2 & 3 at 180°) */
export const THROW = FIRING_4.map((f) => ((((-f % 360) + 360) % 360) * Math.PI) / 180)
/** main bearings: front, between each pair of cylinders, rear */
export const MAIN_X = [E.front + 0.062, ...E.mids, E.rear - 0.062].map(toX)
/** camshaft bearings */
export const CAM_JX = [E.front + 0.065, ...E.mids, E.rear - 0.065].map(toX)
export const DECK = HEAD_Y
export const CAM = { y: CAM_AXIS.y, z: CAM_AXIS.x }
/** main gallery, drilled along the crankcase wall on the camshaft side */
export const GALLERY = { y: 0.03, z: -0.118, x0: -0.27, x1: 0.25 }
/** gear pump on a vertical shaft driven by crossed helical gears from the camshaft; the idler gear sits beside it (−z) */
export const PUMP = { x: -0.244, y: -0.13, z: -0.04, idleDz: 0.044 }
/** pressure-relief valve (seat) on a branch of the pump delivery */
export const RELIEF = { x: -0.2, y: -0.105, z: -0.108 }
export const FILTER = { x: -0.13, y: -0.02, z: -0.185 }
export const ROCKER = { y: ROCKER_AXIS.y, z: ROCKER_AXIS.x }
/** sump oil level (kept below the splash troughs) */
export const SUMP_OIL_Y = -0.15
export const SUMP_FLOOR_Y = SUMP.floorY
/** splash trough under each big end, and the dipper on each cap that dips into it */
export const TROUGH = { y: -0.119, h: 0.016, w: 0.04, d: 0.054 }
export const GAUGE = { x: -0.5, y: 0.25, z: -0.1 }
export const BREATHER = { x: 0.44, y: DECK + 0.12, z: -0.12 }

export type LubeMode = 'force' | 'splash'

export interface LubeParams {
  mode: LubeMode
  rpm: number
  tempC: number
  grade: OilGrade
  reliefBar: number
  filterClog: number
  wear: number
  flows: boolean
}

export const DEFAULTS: LubeParams = { mode: 'force', rpm: 1500, tempC: 90, grade: 'SAE30', reliefBar: 5.5, filterClog: 1, wear: 1, flows: true }

interface Store extends LubeParams {
  set: (p: Partial<LubeParams>) => void
  reset: () => void
}

export const useLube = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export function operating(p: Pick<LubeParams, 'rpm' | 'tempC' | 'grade' | 'reliefBar' | 'filterClog' | 'wear'>): LubeResult {
  return lubeOperatingPoint(p)
}

/** Gauge reading (bar): splash systems have no pressure gallery — only the low trough-feed pressure. */
export function gaugeBar(p: LubeParams, r: LubeResult) {
  return p.mode === 'force' ? r.galleryBar : Math.min(0.3, r.galleryBar * 0.1)
}

export const pistonPinY = (theta: number, cyl: number) => pinHeight(SC, theta + THROW[cyl])

export const live = { theta: 0 }
