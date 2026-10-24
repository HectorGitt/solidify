import { create } from 'zustand'
import {
  beltCapacityM3h,
  beltConveyorPower,
  bucketElevatorPower,
  chainConveyorPower,
  cmWaterToPa,
  headDischargeFactor,
  pneumaticDesign,
  screwCapacityM3h,
  screwPower,
  screwVolumePerRev,
  troughSection,
} from '@/physics/processing'

export type Kind = 'belt' | 'chain' | 'screw' | 'bucket' | 'pneumatic'
export type Flight = 'standard' | 'half' | 'ribbon'
export type Discharge = 'centrifugal' | 'positive' | 'continuous'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI
const g = 9.81

export interface ConvParams {
  kind: Kind
  /** bulk density of the material (kg/m³) */
  rho: number
  /* belt */
  B: number
  margin: number
  trough: number
  surcharge: number
  v: number
  L: number
  incline: number
  wBelt: number
  fIdler: number
  /* chain (scraper flight) */
  chainV: number
  chainL: number
  Wc: number
  fChain: number
  Fc: number
  chainH: number
  /** depth of material in the trough (m) and trough width (m) */
  chainDepth: number
  chainW: number
  /* screw */
  D: number
  d: number
  flight: Flight
  n: number
  eff: number
  screwL: number
  F: number
  sf: number
  /* bucket */
  bucketH: number
  bucketQ: number
  discharge: Discharge
  headR: number
  bucketV: number
  allowance: number
  /* pneumatic */
  mode: 'positive' | 'suction'
  airQ: number
  airV: number
  staticCm: number
  E: number
}

export const DEFAULTS: ConvParams = {
  kind: 'belt',
  rho: 750,
  B: 0.6,
  margin: 0.05,
  trough: rad(20),
  surcharge: rad(20),
  v: 2.5,
  L: 30,
  incline: rad(8),
  wBelt: 30,
  fIdler: 0.03,
  chainV: 0.5,
  chainL: 15,
  Wc: 150,
  fChain: 0.3,
  Fc: 0.5,
  chainH: 0,
  chainDepth: 0.12,
  chainW: 0.3,
  D: 0.25,
  d: 0.06,
  flight: 'standard',
  n: 80,
  eff: 0.4,
  screwL: 6,
  F: 0.4,
  sf: 1.5,
  bucketH: 15,
  bucketQ: 20,
  discharge: 'centrifugal',
  headR: 0.25,
  bucketV: 2.5,
  allowance: 0.1,
  mode: 'positive',
  airQ: 0.5,
  airV: 25,
  staticCm: 30,
  E: 0.5,
}

interface Store extends ConvParams {
  set: (p: Partial<ConvParams>) => void
  reset: () => void
}

export const useConv = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/** Pitch for each screw type (standard pitch = D). */
export const pitchOf = (p: Pick<ConvParams, 'D' | 'flight'>) => (p.flight === 'half' ? p.D / 2 : p.D)

/** Default bucket speed for each discharge type (centrifugal is fast; positive / continuous 30–38 m/min). */
export const DISCHARGE_V: Record<Discharge, number> = { centrifugal: 2.5, positive: 0.6, continuous: 0.6 }

export function analyse(p: ConvParams) {
  // belt
  const tr = troughSection(p.B, p.margin, p.trough, p.surcharge)
  const beltM3h = beltCapacityM3h(tr.area, p.v)
  const beltQ = (beltM3h * p.rho) / 3600
  const beltH = p.L * Math.sin(p.incline)
  const beltP = beltConveyorPower({ Q: beltQ, L: p.L, H: beltH, v: p.v, wBelt: p.wBelt, f: p.fIdler, width: p.B })
  // chain: material weight per metre from the load in the trough
  const chainArea = p.chainDepth * p.chainW
  const W = chainArea * p.rho * g
  const chainQ = (W / g) * p.chainV
  const chainP = chainConveyorPower(p.chainV, p.chainL, p.Wc, p.fChain, W, p.Fc, p.chainH)
  // screw
  const pitch = pitchOf(p)
  const dIn = p.flight === 'ribbon' ? p.d + 0.35 * (p.D - p.d) : p.d
  const volRev = screwVolumePerRev(p.D, p.d, pitch)
  const screwTheory = screwCapacityM3h(p.D, p.d, pitch, p.n, 1)
  const screwActual = screwTheory * p.eff
  const screwP = screwPower(p.D, p.d, pitch, p.rho, p.n, p.screwL, p.F, p.sf)
  const screwAxial = (pitch * p.n) / 60
  // bucket
  const bucketQ = (p.bucketQ * 1000) / 3600
  const bucketP = bucketElevatorPower(bucketQ, p.bucketH, p.allowance)
  const headK = headDischargeFactor(p.bucketV, p.headR)
  const releaseDeg = headK >= 1 ? 0 : deg(Math.acos(headK))
  // pneumatic
  const pn = pneumaticDesign(p.airQ, p.airV, cmWaterToPa(p.staticCm), p.E)
  return {
    tr,
    beltM3h,
    beltQ,
    beltH,
    beltP,
    chainArea,
    W,
    chainQ,
    chainP,
    pitch,
    dIn,
    volRev,
    screwTheory,
    screwActual,
    screwP,
    screwAxial,
    bucketQ,
    bucketP,
    headK,
    releaseDeg,
    pn,
  }
}

export const live = { beltS: 0, rpm: 0 }

/** Conveyor comparison (HAND Note 3, table). */
export const COMPARE: { kind: Kind; name: string; materials: string; cap: string; power: string; cost: string; damage: string; dist: string; tech: string }[] = [
  { kind: 'belt', name: 'Belt', materials: 'grain, packages, yam tubers, palm bunches', cap: 'High', power: 'Low', cost: 'High', damage: 'Low', dist: 'Long', tech: 'High' },
  { kind: 'chain', name: 'Chain', materials: 'feed, grain, wastes', cap: 'Med', power: 'Med', cost: 'Low/Med', damage: 'High', dist: 'Short', tech: 'Low' },
  { kind: 'screw', name: 'Screw', materials: 'ground, granular, chipped', cap: 'Med', power: 'Low/Med', cost: 'Med', damage: 'High', dist: 'Short', tech: 'Low' },
  { kind: 'bucket', name: 'Bucket', materials: 'ground, granular, lump', cap: 'Med', power: 'Low', cost: 'Med/High', damage: 'Med', dist: 'Short', tech: 'High' },
  { kind: 'pneumatic', name: 'Pneumatic', materials: 'grain, feed, chopped', cap: 'Variable', power: 'High', cost: 'Low/Med', damage: 'Low/Med', dist: 'Long', tech: 'High' },
]

/** Material → conveyors that suit it (HAND Note 3 descriptions and table). */
export const MATERIALS: { id: string; label: string; suits: Kind[]; why: string }[] = [
  { id: 'grain', label: 'Dry grain', suits: ['belt', 'bucket', 'pneumatic', 'screw'], why: 'Free-flowing: belts for long horizontal runs (2.5–2.8 m/s), bucket elevators to lift, pneumatic for any routing.' },
  { id: 'tubers', label: 'Tubers, bunches, bags', suits: ['belt', 'chain'], why: 'Bulky units: a flat or troughed belt carries them without relative motion, so little damage; slat/apron chains for heavy lumps (palm kernels, cane).' },
  { id: 'sticky', label: 'Damp, sticky, hot powder', suits: ['screw'], why: 'A screw (ribbon flight for sticky material) is enclosed and handles damp, sticky, hot or chemically active materials at up to 20°.' },
  { id: 'ground', label: 'Ground feed / meal', suits: ['screw', 'bucket', 'chain', 'pneumatic'], why: 'Ground and granular: screws and bucket elevators, scraper-flight chains, or a pneumatic line with a cyclone.' },
  { id: 'fragile', label: 'Fragile (fruit, tomatoes)', suits: ['belt', 'bucket'], why: 'Belts (no relative motion) and continuous bucket elevators are gentle; screws and chains damage the product.' },
  { id: 'liquid', label: 'Liquids (oil, paste)', suits: [], why: 'Liquids are pumped through pipes — none of the bulk-solid conveyors here.' },
]
