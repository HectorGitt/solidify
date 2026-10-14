import { create } from 'zustand'
import { cite } from '@/content/citations'
import { VANE_PUMP } from '@/parts/lib/hydraulics'
import { gearPumpDisplacementExact, vanePumpDisplacementExact, type GearPumpGeometry, type VanePumpGeometry } from '@/physics/pumps'

export const MG1617 = (where?: string) => cite('AEE502', 'AEE 502-2016-2017- Marking Guide-draft-new.docx', where)
export const MS1718 = (where?: string) => cite('AEE502', 'AEE 502 -2017-2018-marking scheme.docx', where)

/** External gear pump drawn: m 3 mm, 12 teeth, 20 mm wide (typical tractor lift pump size). Pump axis along Z. */
export const GEAR: GearPumpGeometry & { x: number } = { module: 0.003, teeth: 12, width: 0.02, x: -0.11 }
/** Unbalanced vane pump drawn: ring bore 80 mm, rotor 68 mm, 30 mm wide, 8 vanes 4 mm thick. */
export const VANE = { x: 0.11, ...VANE_PUMP }

export type Source = 'gear' | 'vane' | 'manual'

export interface PumpParams {
  /** vane-pump eccentricity, m */
  ecc: number
  rpm: number
  /** pressure rise, MPa */
  dp: number
  etaV: number
  etaT: number
  source: Source
  /** manual displacement, cm³/rev */
  D: number
  flows: boolean
}

export const DEFAULTS: PumpParams = { ecc: 0.004, rpm: 2000, dp: 14.71, etaV: 0.97, etaT: 0.9, source: 'gear', D: 150, flows: true }

interface Store extends PumpParams {
  set: (p: Partial<PumpParams>) => void
  reset: () => void
}

export const usePumps = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const vaneGeom = (ecc: number): VanePumpGeometry => ({ ringR: VANE.ringR, rotorR: VANE.rotorR, ecc, width: VANE.width, vanes: VANE.vanes, vaneT: VANE.vaneT })

export function displacement(p: Pick<PumpParams, 'source' | 'D' | 'ecc'>) {
  if (p.source === 'gear') return gearPumpDisplacementExact(GEAR)
  if (p.source === 'vane') return vanePumpDisplacementExact(vaneGeom(p.ecc))
  return p.D
}

export interface LivePumps {
  /** drive-shaft angle, degrees */
  theta: number
  /** gear-pump instantaneous delivery / mean */
  ripple: number
  /** angle of vane 0 from the ring offset, degrees, and its chamber volume (cm³) */
  vanePhi: number
  chamber: number
}

export const live: LivePumps = { theta: 0, ripple: 1, vanePhi: 0, chamber: 0 }
