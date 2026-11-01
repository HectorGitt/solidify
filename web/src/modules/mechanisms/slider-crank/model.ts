import { create } from 'zustand'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

export type Mode = 'slider' | 'yoke'

export interface SliderParams {
  mode: Mode
  /** crank radius, mm */
  r: number
  /** connecting rod over crank radius */
  n: number
  /** the line of stroke's offset, mm */
  e: number
  rpm: number
  set: (p: Partial<SliderParams>) => void
  reset: () => void
}

export const DEFAULTS = { mode: 'slider' as Mode, r: 25, n: 4, e: 0, rpm: 20 }

export const useSlider = create<SliderParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/** written by the 3D scene, read by the panel */
export const live = { theta: 0 }

/** the rig is drawn at four and a half times bench size: mm to metres */
export const MM = 0.0045
