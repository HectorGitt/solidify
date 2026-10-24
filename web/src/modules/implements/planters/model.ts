import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { drillCalibration, fieldCapacity, plantPopulation, plateSpacing } from '@/physics/tillage'

export const C = {
  am: (w: string) => SRC.am502(w),
  guide: (y: string, w: string) => cite('AEE502', `AEE 502 -${y}-Marking Guide.docx`, w),
  bush: (w: string) => SRC.bush501(w),
  mgmt: (w: string) => SRC.mgmt501(w),
}

export type Kind = 'drill' | 'fert' | 'planter' | 'jab'

export interface PlantParams {
  kind: Kind
  /** drill: openers and row spacing (m) */
  rows: number
  spacing: number
  /** seed rate kg/ha, drive-wheel diameter m, calibration area ha */
  rate: number
  D: number
  area: number
  /** planter: row spacing, cells on the plate, plate revs per wheel rev, wheel diameter */
  pRows: number
  pSpacing: number
  cells: number
  ratio: number
  pD: number
  depth: number
  speed: number
  FE: number
}

export const DEFAULTS: PlantParams = {
  kind: 'drill',
  rows: 5,
  spacing: 0.15,
  rate: 80,
  D: 1,
  area: 0.1,
  pRows: 4,
  pSpacing: 0.75,
  cells: 16,
  ratio: 1,
  pD: 0.5,
  depth: 0.04,
  speed: 5,
  FE: 0.75,
}

export const usePlant = create<PlantParams & { set: (p: Partial<PlantParams>) => void; reset: () => void }>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set({ ...DEFAULTS }),
}))

/** live: drive-wheel revolutions and distance this pass */
export const live = { revs: 0, dist: 0, lowered: 0 }

export const H = 0.55
export const RAISED = 0.8

export function plantOf(p: PlantParams) {
  const cal = drillCalibration(p.rows, p.spacing, p.rate, p.D, p.area)
  const seedGap = plateSpacing(p.pD, p.ratio, p.cells)
  const W = p.kind === 'planter' ? p.pRows * p.pSpacing : cal.W
  return { cal, seedGap, pop: plantPopulation(p.pSpacing, seedGap), W, C: fieldCapacity(W, p.speed, p.FE) }
}
