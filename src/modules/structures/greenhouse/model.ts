import { create } from 'zustand'
import { cite } from '@/content/citations'
import { Cladding } from '@/physics/structures'

export const C = {
  aee505: (w: string) => cite('AEE505', 'AEE 505 Lecture note 2 new.pdf', w),
}

export interface GreenhouseParams {
  bays: number
  length: number
  cladding: Cladding | 'frp'
  whitewash: boolean
  qFans: number
  doorsOpen: boolean
  pad: boolean
  fanCapacity: number
}

export const DEFAULTS: GreenhouseParams = {
  bays: 3,
  length: 43, 
  cladding: 'glass',
  whitewash: false,
  qFans: 8,
  doorsOpen: false,
  pad: false,
  fanCapacity: 2.5,
}

interface Store extends GreenhouseParams {
  set: (p: Partial<GreenhouseParams>) => void
  reset: () => void
}

export const useGreenhouse = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const live = { dt: 0, qAir: 0, floorArea: 0, loadW: 0 }
