import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { biteLength, bladeRidgeHeight, fieldCapacity, tipSpeedRatio } from '@/physics/tillage'

export const C = {
  am: (w: string) => SRC.am502(w),
  guide1819: (w: string) => cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', w),
  bush: (w: string) => SRC.bush501(w),
  mgmt: (w: string) => SRC.mgmt501(w),
}

export type Tool = 'rigid' | 'spring' | 'spike' | 'chain' | 'rotavator' | 'ridger' | 'chisel' | 'subsoiler'

export const TOOLS: Record<Tool, { label: string; depth: [number, number, number]; width: number }> = {
  rigid: { label: 'Rigid-tine cultivator', depth: [0.05, 0.2, 0.12], width: 2.1 },
  spring: { label: 'Spring-tine cultivator', depth: [0.03, 0.12, 0.08], width: 2.1 },
  spike: { label: 'Spike-tooth harrow', depth: [0.02, 0.08, 0.05], width: 2.4 },
  chain: { label: 'Chain harrow', depth: [0.005, 0.03, 0.015], width: 2.4 },
  rotavator: { label: 'Rotary cultivator (rotavator)', depth: [0.05, 0.2, 0.12], width: 1.8 },
  ridger: { label: 'Ridger', depth: [0.08, 0.25, 0.15], width: 2.25 },
  chisel: { label: 'Chisel plough', depth: [0.15, 0.35, 0.25], width: 2.0 },
  subsoiler: { label: 'Subsoiler', depth: [0.3, 0.6, 0.45], width: 1.0 },
}

export interface CultParams {
  tool: Tool
  depth: number
  speed: number
  FE: number
  rotorRpm: number
  /** blades per flange (one side) */
  blades: number
  /** ridge spacing, m */
  ridgeSpacing: number
  /** stop the tractor mid-field (close-up view) */
  hold: boolean
}

export const DEFAULTS: CultParams = { tool: 'rigid', depth: 0.12, speed: 6, FE: 0.8, rotorRpm: 200, blades: 3, ridgeSpacing: 0.75, hold: false }

export const useCult = create<CultParams & { set: (p: Partial<CultParams>) => void; reset: () => void }>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set({ ...DEFAULTS }),
}))

export const live = { lowered: 0, area: 0 }

/** the working floor sits H below the hitch balls for every tool */
export const H = 0.55
export const RAISED = 0.85
export const ROTOR_R = 0.25

export function cultOf(p: CultParams) {
  const v = p.speed / 3.6
  const W = p.tool === 'ridger' ? 3 * p.ridgeSpacing : TOOLS[p.tool].width
  const bite = biteLength(v, p.rotorRpm, p.blades)
  return {
    v,
    W,
    bite,
    lambda: tipSpeedRatio(v, p.rotorRpm, ROTOR_R),
    ridge: bladeRidgeHeight(bite, ROTOR_R),
    C: fieldCapacity(W, p.speed, p.FE),
  }
}
