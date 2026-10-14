import { create } from 'zustand'
import type { FixMode } from '@/physics/guidance'

/**
 * GNSS auto-steer on a field of back-and-forth passes. The tractor steers by pure pursuit from
 * its MEASURED position (true position + the fix mode's error); the implement paints where it
 * really is, so position error shows as overlaps (red) and gaps (bare soil) between passes.
 *
 * Frame: metres, +X along the passes, +Z right of a tractor heading +X. Origin at field centre.
 */

export const FIELD = {
  /** pass length, m */
  L: 100,
  passes: 6,
  /** implement centre behind the rear axle, m */
  implX: -1.9,
  /** antenna on the cab roof */
  antenna: [-0.05, 2.43, 0] as [number, number, number],
  /** wheelbase used by the controller and the vehicle model */
  wheelbase: 1.88,
  maxSteer: 0.6,
  /** steering actuator rate limit, rad/s */
  steerRate: 0.7,
}

export type FastForward = 1 | 5 | 20

export interface AutosteerParams {
  fix: FixMode
  /** km/h */
  speed: number
  /** implement (and guidance-line spacing) width, m */
  width: number
  /** pure-pursuit look-ahead, m */
  lookahead: number
  /** steering actuator time constant, s */
  lag: number
  ff: FastForward
  sats: boolean
  lines: boolean
  /** bumped to restart the run */
  run: number
}

export const DEFAULTS: AutosteerParams = { fix: 'rtk', speed: 10, width: 6, lookahead: 3.5, lag: 0.25, ff: 1, sats: true, lines: true, run: 0 }

interface Store extends AutosteerParams {
  set: (p: Partial<AutosteerParams>) => void
  restart: () => void
  reset: () => void
}

export const useAutosteer = create<Store>((set, get) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  restart: () => set({ run: get().run + 1 }),
  reset: () => set({ ...DEFAULTS, run: get().run + 1 }),
}))

export const HISTORY = 240

/** Values written by the simulation and read by the panel. */
export const live = {
  /** true cross-track error of the rear axle, m (+ = right of the line) */
  xte: 0,
  /** RMS cross-track error on the current pass, m */
  rms: 0,
  /** worst |XTE| on the current pass, m */
  peak: 0,
  /** the last finished pass: RMS and worst error (m), slowest speed set (km/h), its number */
  lastRms: NaN,
  lastPeak: NaN,
  lastMinSpeed: NaN,
  lastPassNo: 0,
  steer: 0,
  /** current pass (−1 on a headland) */
  pass: -1,
  passesDone: 0,
  overlap: 0,
  gap: 0,
  /** area worked, ha */
  area: 0,
  /** sim time, s */
  t: 0,
  /** measured − true position, m */
  errX: 0,
  errZ: 0,
  done: false,
  /** XTE history, cm (ring buffer, oldest first via `head`) */
  hist: new Float32Array(HISTORY),
  histT: new Float32Array(HISTORY),
  head: 0,
  count: 0,
}

export function resetLive() {
  Object.assign(live, { xte: 0, rms: 0, peak: 0, lastRms: NaN, lastPeak: NaN, lastMinSpeed: NaN, lastPassNo: 0, steer: 0, pass: -1, passesDone: 0, overlap: 0, gap: 0, area: 0, t: 0, errX: 0, errZ: 0, done: false, head: 0, count: 0 })
  live.hist.fill(0)
  live.histT.fill(0)
}
