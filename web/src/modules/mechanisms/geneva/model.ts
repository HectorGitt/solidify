import { create } from 'zustand'
import { createRun } from '@/lab/run'
import { genevaLambda } from '@/physics/linkages'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

export interface GenevaParams {
  slots: number
  rpm: number
  /** one slot closed, so the driver can only go so far: a Geneva stop */
  stop: boolean
  set: (p: Partial<GenevaParams>) => void
  reset: () => void
}

export const DEFAULTS = { slots: 6, rpm: 15, stop: false }

export const useGeneva = create<GenevaParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const live = { theta: 0 }

/** distance between the shafts, as drawn */
export const CENTRES = 0.34
export const pinRadius = (slots: number) => CENTRES * genevaLambda(slots)

/** the bench test: the input rotor is set in 15° steps from 0° to 180°, and the output read at each */
export const genevaRun = createRun()
export const GENEVA_PROC = { steps: 12, moveSeconds: 0.32, dwellSeconds: 0.1 }
