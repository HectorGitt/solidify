import { create } from 'zustand'
import { cite } from '@/content/citations'
import { DRIVES, HAZARD_SEPARATION, MACHINES, WORKSHOP, doorFor, driveVerdict, ft, liftingGear, needsSeparateStore, shedSize, type MachineKey } from '@/physics/structures'

export const C = {
  ln: (w: string) => cite('AEE505', 'AEE 505 Lecture note 2 new.pdf', w),
}

export interface StorageParams {
  sideClear: number
  headClear: number
  /** working space around the largest machine in the workshop, m */
  workSpace: number
  /** span of the workshop lifting beam, m */
  liftSpan: number
  driveW: number
  turnR: number
  fuelGap: number
  diesel: number
  petrol: number
  kerosene: number
  thinner: number
  /** animate the tractor driving into the workshop */
  drive: boolean
}

export const DEFAULTS: StorageParams = {
  sideClear: 0.6,
  headClear: 0.3,
  workSpace: 1.2,
  liftSpan: 4,
  driveW: ft(18),
  turnR: ft(45),
  fuelGap: 18,
  diesel: 400,
  petrol: 40,
  kerosene: 0,
  thinner: 0,
  drive: true,
}

interface Store extends StorageParams {
  set: (p: Partial<StorageParams>) => void
  reset: () => void
}
export const useStorage = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const STORED: MachineKey[] = ['tractor', 'trailer', 'plough', 'harrow']

/**
 * Combined building: workshop at the west end, open-fronted machinery shed (one bay per machine,
 * nose-in) in the rest. Plan in metres: x along the building (east), z towards the open front (south).
 */
export function design(p: StorageParams) {
  const shed = shedSize(STORED, p.sideClear, p.headClear)
  const tr = MACHINES.tractor
  const door = doorFor(tr, p.sideClear, p.headClear)
  const wsW = Math.max(tr.w + 2 * p.workSpace + WORKSHOP.bench.dMax, door.w + 2.2)
  const depth = Math.max(shed.depth, tr.l + 2 * p.workSpace)
  const height = Math.max(shed.height, door.h + 0.3)
  const length = wsW + shed.width
  const x0 = -length / 2
  const workshop = { x0, x1: x0 + wsW, w: wsW }
  let bx = workshop.x1
  const bays = STORED.map((k, i) => {
    const w = shed.bays[i]
    const b = { key: k, x0: bx, x1: bx + w, cx: bx + w / 2 }
    bx += w
    return b
  })
  const hazard = needsSeparateStore({ diesel: p.diesel, petrol: p.petrol, kerosene: p.kerosene, thinner: p.thinner })
  const fuelX = length / 2 + p.fuelGap + 1.5
  return {
    shed,
    door,
    depth,
    height,
    length,
    workshop,
    bays,
    fireDoor: { w: 0.9, h: 2.1 },
    lift: liftingGear(p.liftSpan),
    doorClear: (door.w - tr.w) / 2,
    headroom: door.h - tr.h,
    hazard,
    fuelX,
    fuelOk: p.fuelGap >= HAZARD_SEPARATION - 1e-6,
    drive: driveVerdict(p.driveW),
    stall: DRIVES.stall,
  }
}
export type Design = ReturnType<typeof design>

export const live = { inside: 0 }
