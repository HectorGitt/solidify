import { create } from 'zustand'

export const deg = (r: number) => (r * 180) / Math.PI

export interface OldhamParams {
  /** the shafts' offset, mm */
  d: number
  rpm: number
  trace: boolean
  set: (p: Partial<OldhamParams>) => void
  reset: () => void
}

export const DEFAULTS = { d: 30, rpm: 20, trace: true }

export const useOldham = create<OldhamParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const live = { theta: 0 }

/** drawn at twice bench size */
export const MM = 0.002
