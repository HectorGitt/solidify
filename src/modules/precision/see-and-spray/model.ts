import { create } from 'zustand'
import { SPOT_DEFAULTS, type SpotSpec } from '@/physics/spotspray'

/**
 * See-and-spray on a strip of row crop with weeds between the rows. Cameras on the boom look
 * ahead of the nozzles; detected weeds get a short burst from the nozzle above them.
 * Frame: travel along +X, boom across Z, origin at the strip centre.
 */

export const STRIP = { x0: -30, L: 60, W: 12 }
/** nozzle line behind the tractor's rear axle, and its height */
export const BOOM_X = -2.1
export const BOOM_Y = 0.55
/** crop rows across the strip (m) and plant spacing along them */
export const ROW = { spacing: 0.75, plant: 0.25 }

export type Mode = 'blanket' | 'spot'

export interface SeeSprayParams {
  mode: Mode
  /** km/h */
  speed: number
  /** weeds per m² */
  density: number
  /** detection rate 0…1 */
  recall: number
  /** false detections per 100 m² */
  falses: number
  /** ms */
  latency: number
  compensate: boolean
  /** cm */
  buffer: number
  /** m */
  lookAhead: number
  run: number
}

export const DEFAULTS: SeeSprayParams = {
  mode: 'spot',
  speed: 12,
  density: 0.4,
  recall: SPOT_DEFAULTS.recall,
  falses: SPOT_DEFAULTS.falsePerM2 * 100,
  latency: SPOT_DEFAULTS.latency * 1000,
  compensate: true,
  buffer: SPOT_DEFAULTS.buffer * 100,
  lookAhead: SPOT_DEFAULTS.lookAhead,
  run: 0,
}

interface Store extends SeeSprayParams {
  set: (p: Partial<SeeSprayParams>) => void
  reset: () => void
}
export const useSeeSpray = create<Store>((set, get) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS, run: get().run + 1 }) }))

export function specOf(p: SeeSprayParams): SpotSpec {
  return {
    ...SPOT_DEFAULTS,
    width: STRIP.W,
    recall: p.recall,
    falsePerM2: p.falses / 100,
    latency: p.latency / 1000,
    compensate: p.compensate,
    buffer: p.buffer / 100,
    lookAhead: p.lookAhead,
  }
}

/** Running totals for the part of the strip the boom has passed. */
export const live = {
  progress: 0,
  weedsPassed: 0,
  killed: 0,
  missed: 0,
  falseFires: 0,
  /** wetted area so far, and what blanket spraying would have used, m² */
  sprayed: 0,
  blanket: 0,
  passes: 0,
}

export function resetLive() {
  Object.assign(live, { progress: 0, weedsPassed: 0, killed: 0, missed: 0, falseFires: 0, sprayed: 0, blanket: 0 })
}
