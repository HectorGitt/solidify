import { create } from 'zustand'
import { genevaLambda } from '@/physics/linkages'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

export interface GenevaParams {
  slots: number
  rpm: number
  set: (p: Partial<GenevaParams>) => void
  reset: () => void
}

export const DEFAULTS = { slots: 6, rpm: 15 }

export const useGeneva = create<GenevaParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const live = { theta: 0 }

/** distance between the shafts, as drawn */
export const CENTRES = 0.34
export const pinRadius = (slots: number) => CENTRES * genevaLambda(slots)
