import { create } from 'zustand'
import { pinHeight, type SliderCrank } from '@/physics/engine'
import { lubeOperatingPoint, type LubeResult, type OilGrade } from '@/physics/engineSystems'

/**
 * Four-cylinder in-line engine for the lubrication scene. Crank axis = X at y = 0, cylinders at
 * CYL_X, oil system on the camshaft side (z < 0) so the half section (z > 0 removed) shows it.
 * Bore 100 mm, stroke 120 mm, rod 200 mm. Metres, Y up.
 */
export const R = 0.06
export const ROD = 0.2
export const PISTON_COMP = 0.07
export const SC: SliderCrank = { r: R, l: ROD }
export const CYL_X = [-0.18, -0.06, 0.06, 0.18]
/** firing order 1-3-4-2: throws 1 & 4 at 0°, 2 & 3 at 180° */
export const THROW = [0, Math.PI, Math.PI, 0]
export const MAIN_X = [-0.24, -0.12, 0, 0.12, 0.24]
export const DECK = R + ROD + PISTON_COMP + 0.005
export const CAM = { y: 0.1, z: -0.075 }
export const GALLERY = { y: 0.03, z: -0.08, x0: -0.31, x1: 0.27 }
/** gear pump on a vertical shaft driven by crossed helical gears from the camshaft (axes 39 mm apart) */
export const PUMP = { x: -0.29, y: -0.135, z: -0.036, idleDx: 0.044 }
/** pressure-relief valve (seat) on a branch of the pump delivery */
export const RELIEF = { x: -0.23, y: -0.097, z: -0.056 }
export const FILTER = { x: -0.15, y: -0.02, z: -0.155 }
export const ROCKER = { y: 0.47, z: -0.04 }
export const SUMP_OIL_Y = -0.16
export const GAUGE = { x: -0.42, y: 0.2, z: -0.06 }
export const BREATHER = { x: 0.37, y: 0.44, z: -0.08 }

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
