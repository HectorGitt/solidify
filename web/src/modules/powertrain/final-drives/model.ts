import { create } from 'zustand'
import { FINAL_DRIVE, threeReductions, type FinalDriveLayout } from '@/physics/drives'
import { epicyclicReduction, spurReduction } from '@/physics/transmission'

/**
 * Final drives & rear axle (PT p12; TTS Figs 35a/b/c; TOP Fig A2.15). One (left) half of the
 * rear axle is drawn in a LOCAL frame whose +Z is the half-shaft axis (world +X, outwards) — the
 * scene wraps it in a group turned 90° about Y. Local Y is up; local −X is world +Z (towards the
 * gearbox, where the bevel pinion comes from). Origin = differential centre = bevel apex.
 */
export const BEVEL = { zPinion: 11, zCrown: 47, module: 0.0065, face: 0.04 }

export const SPUR = { ...FINAL_DRIVE.spur, module: 0.006, width: 0.045, at: 0.55 }
export const SPUR_C = (SPUR.module * (SPUR.pinion + SPUR.gear)) / 2

export const EPI = { ...FINAL_DRIVE.epicyclic, module: 0.005, width: 0.04, planets: 3 }
export const EPI_RC = (EPI.module * (EPI.sun + EPI.planet)) / 2
export const EPI_RING_R = (EPI.module * EPI.ring) / 2

export const LAYOUTS: Record<FinalDriveLayout, { label: string; fig: string; ratio: number }> = {
  straight: { label: 'Straight axle', fig: 'PT p12', ratio: 1 },
  spur: { label: 'Spur reduction', fig: 'TTS Fig 35a', ratio: spurReduction(SPUR.pinion, SPUR.gear) },
  epicyclic: { label: 'Epicyclic, outboard', fig: 'TTS Fig 35b', ratio: epicyclicReduction(EPI.sun, EPI.ring) },
  mf2000: { label: 'MF rear axle', fig: 'TOP Fig A2.15', ratio: epicyclicReduction(EPI.sun, EPI.ring) },
}

/** Where things sit along the half shaft (local z) for each layout. */
export function stations(layout: FinalDriveLayout) {
  switch (layout) {
    case 'spur':
      return { brake: 0.63, reduction: SPUR.at, hub: 0.8, trumpetEnd: 0.505 }
    case 'epicyclic':
      return { brake: 0.2, reduction: 0.6, hub: 0.72, trumpetEnd: 0.56 }
    case 'mf2000':
      return { brake: 0.175, reduction: 0.26, hub: 0.9, trumpetEnd: 0.88 }
    default:
      return { brake: 0.2, reduction: 0, hub: 0.8, trumpetEnd: 0.78 }
  }
}

export interface FinalParams {
  layout: FinalDriveLayout
  engineRpm: number
  engineTorque: number
  /** gearbox ratio of the selected gear */
  gearbox: number
  braking: boolean
}

export const DEFAULTS: FinalParams = { layout: 'mf2000', engineRpm: 2000, engineTorque: 250, gearbox: 5.2, braking: false }

interface Store extends FinalParams {
  set: (p: Partial<FinalParams>) => void
  reset: () => void
}

export const useFinal = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const CROWN_RATIO = BEVEL.zCrown / BEVEL.zPinion

export function chain(p: FinalParams) {
  return threeReductions(p.engineRpm, p.engineTorque, p.gearbox, CROWN_RATIO, LAYOUTS[p.layout].ratio)
}

export const live = { pinion: 0, shaft: 0, hub: 0, brake: 0 }

export const rpmToRad = (n: number) => (n * 2 * Math.PI) / 60
export const radToRpm = (w: number) => (w * 60) / (2 * Math.PI)
