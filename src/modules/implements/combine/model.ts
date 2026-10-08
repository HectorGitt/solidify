import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { SANDEL, cylinderPeripheralSpeed, machineFeed, threshing, type CombineCapacityInput } from '@/physics/harvest'

export const C = {
  am: (w: string) => SRC.am502(w),
  mgmt: (w: string) => SRC.mgmt501(w),
  exam1920: (w: string) => cite('AEE501', 'AEE 501 201920 questions.docx', w),
  exam5: (w: string) => cite('AEE501', 'part 5 exam.docx', w),
}

/**
 * A medium self-propelled combine, side view. Frame: metres, Y up, +X forward (direction of
 * travel), +Z to the machine's left, origin on the ground under the middle of the machine.
 * The notes describe the units and the crop path (AGRICULTURAL MACHINERIES §19, Figs 19.1–19.3)
 * but give no dimensions; these are typical values (marked beyond the notes on the part cards).
 * The 6 m header is the one in the AEE501 2019/20 capacity question.
 */
export const D = {
  header: { width: 6, cutterX: 4.62, cutterY: 0.11, backX: 3.62, topY: 1.05 },
  reel: { x: 4.72, y: 1.28, r: 0.62, bats: 5 },
  auger: { x: 3.98, y: 0.42, r: 0.27, tube: 0.14 },
  feeder: { lo: [3.42, 0.47] as [number, number], hi: [2.52, 1.18] as [number, number], sprocket: 0.1, halfWidth: 0.6 },
  cyl: { x: 1.95, y: 1.32, r: 0.3, halfWidth: 0.65, bars: 8 },
  beater: { x: 1.36, y: 1.52, r: 0.19 },
  walkers: { n: 4, x0: 1.22, x1: -2.95, crankR: 0.065, crankX: [0.62, -2.15] as [number, number] },
  shoe: { x0: 1.05, x1: -0.95, chafferY: 0.84, sieveY: 0.68, stroke: 0.028 },
  fan: { x: 1.72, y: 0.52, r: 0.26 },
  cleanAuger: { x: 0.18, y: 0.42 },
  tailAuger: { x: -0.86, y: 0.52 },
  tank: { x0: -0.72, x1: 1.72, y0: 2.28, y1: 3.2, hw: 1.0 },
  body: { x0: -3.2, x1: 2.32, y0: 0.62, y1: 2.24, hw: 0.78 },
  front: { x: 1.62, r: 0.78, w: 0.6, z: 1.42 },
  rear: { x: -1.95, r: 0.5, w: 0.34, z: 1.18 },
  /** unloading-auger pivot, length */
  unload: { x: -0.55, y: 2.78, z: -1.02, L: 4.6 },
}

/** Walker phase per walker (180° between neighbours is usual; here 0, 180, 90, 270°). */
export const WALKER_PHASE = [0, Math.PI, Math.PI / 2, (3 * Math.PI) / 2]

/** Typical rated total-material feed of a machine with a 6 m header (beyond the notes). */
export const RATED_FEED = 20

/** Grain tank: about 7 m³ at 0.72 t/m³. */
export const TANK_T = 5

export interface CombineParams {
  /** forward speed, km/h */
  speed: number
  /** width of the header actually used, m */
  widthUsed: number
  /** grain yield, t/ha */
  yield: number
  /** grain fraction of the total crop mass */
  grainFraction: number
  /** cylinder speed, rpm */
  rpm: number
  /** cylinder–concave clearance, mm */
  clearance: number
  /** fan speed, fraction of its correct setting */
  fan: number
  /** unload when the tank is full */
  autoUnload: boolean
  flows: boolean
  /* AEE501 capacity question data */
  exam: CombineCapacityInput
}

export const DEFAULTS: CombineParams = {
  speed: 2.8,
  widthUsed: 5.85,
  yield: 6,
  grainFraction: 0.5,
  rpm: 890,
  clearance: 12,
  fan: 1,
  autoUnload: true,
  flows: true,
  exam: { ...SANDEL },
}

interface Store extends CombineParams {
  set: (p: Partial<CombineParams>) => void
  setExam: (p: Partial<CombineCapacityInput>) => void
  reset: () => void
}

export const useCombine = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  setExam: (p) => set((s) => ({ exam: { ...s.exam, ...p } })),
  reset: () => set({ ...DEFAULTS, exam: { ...SANDEL } }),
}))

/** Everything the live view and panel derive from the parameters. */
export function machineState(p: Pick<CombineParams, 'speed' | 'widthUsed' | 'yield' | 'grainFraction' | 'rpm' | 'clearance' | 'fan'>) {
  const feed = machineFeed(p.widthUsed, p.speed, p.yield, p.grainFraction)
  const vCyl = cylinderPeripheralSpeed(2 * D.cyl.r, p.rpm)
  const load = feed.totalRate / RATED_FEED
  const loss = threshing({ speed: vCyl, clearance: p.clearance, fan: p.fan, load })
  return { feed, vCyl, load, loss }
}

/* ------------------------------ Live values (3D → panel) ------------------------------ */

export const live = {
  /** distance travelled, m */
  travel: 0,
  /** grain in the tank, t */
  tank: 0,
  unloading: false,
  /** unloading-auger swing 0 (stowed) … 1 (out) */
  swing: 0,
  /** reel tip speed ÷ forward speed */
  reelIndex: 1.25,
  harvested: 0,
}

export function resetLive() {
  live.travel = 0
  live.tank = 0
  live.unloading = false
  live.swing = 0
  live.harvested = 0
}
