import { create } from 'zustand'
import { P_FACTORS, designTerrace, usle, usleK, usleSHint } from '@/physics/water'
import { C } from '../_shared/cites'

export { C }

export type Stage = 'splash' | 'sheet' | 'rill' | 'gully'
export type Practice = keyof typeof P_FACTORS | 'custom'

export interface ErosionParams {
  stage: Stage
  /** USLE */
  R: number
  K: number
  l: number
  sPct: number
  Cf: number
  practice: Practice
  Pcustom: number
  sForm: 'notes' | 'hint'
  /** diversion terrace */
  tQ: number
  tv: number
  tn: number
  tb: number
  tZ: number
  /** sim seconds for erosion to develop */
  speed: number
}

export const DEFAULTS: ErosionParams = { stage: 'rill', R: 135, K: 0.47, l: 45.66, sPct: 6, Cf: 0.5, practice: 'contour', Pcustom: 1, sForm: 'notes', tQ: 0.85, tv: 0.9, tn: 0.046, tb: 2.44, tZ: 4, speed: 1 }

interface Store extends ErosionParams {
  set: (p: Partial<ErosionParams>) => void
  reset: () => void
}
export const useErosion = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const PRACTICE_LABEL: Record<Practice, string> = {
  none: 'None (up and down slope)',
  contour: 'Contouring (P = 0.5)',
  strip: 'Strip cropping (P = 0.25)',
  terrace: 'Terraces (P = 0.12)',
  terraceUnderground: 'Terraces, underground outlets (P = 0.10)',
  custom: 'Custom P',
}

export const pOf = (p: ErosionParams) => (p.practice === 'custom' ? p.Pcustom : P_FACTORS[p.practice])

export function soilLoss(p: ErosionParams) {
  const r = usle({ R: p.R, K: p.K, l: p.l, sPct: p.sPct, C: p.Cf, P: pOf(p) })
  if (p.sForm === 'hint') {
    const S = usleSHint(p.sPct)
    return { ...r, S, LS: r.L * S, A: p.R * p.K * r.L * S * p.Cf * pOf(p) }
  }
  return r
}

export const terraceOf = (p: ErosionParams) => designTerrace({ Q: p.tQ, v: p.tv, n: p.tn, b: p.tb, Z: p.tZ })

export { usleK }

/** Tolerable soil loss used in the exam (Mg/ha/yr). */
export const TOLERANCE = 6.72

export const live = { progress: 0, eroded: 0 }
