import { create } from 'zustand'
import { DriveGraph, coupling } from '@/core/drive'
import { cite } from '@/content/citations'
import { doubleHooke, hookeVelocityRatio, rad } from '@/physics/joints'
import { makeGraph } from '../double-cardan/model'
import { HJ2 } from '../shared/cites'

export type CVType = 'rzeppa' | 'weiss' | 'tracta' | 'tripode' | 'double'

export interface CVInfo {
  label: string
  short: string
  /** largest working angle quoted in the notes, degrees */
  maxAngle: number
  maxNote: string
  principle: 'bisecting' | 'twin-hooke' | 'rollers'
}

export const TYPES: Record<CVType, CVInfo> = {
  rzeppa: { label: 'Rzeppa / Birfield (ball & cage)', short: 'Rzeppa', maxAngle: 45, maxNote: 'Birfield: efficiency 95 % at 45°, 100 % at 0°', principle: 'bisecting' },
  weiss: { label: 'Weiss / Bendix (four-ball)', short: 'Weiss', maxAngle: 40, maxNote: 'Single CV joint ≈ 40° articulation', principle: 'bisecting' },
  tracta: { label: 'Tracta (Bendix)', short: 'Tracta', maxAngle: 50, maxNote: 'Constant velocity up to 50°', principle: 'twin-hooke' },
  tripode: { label: 'Tripode (tripot)', short: 'Tripode', maxAngle: 45, maxNote: 'Occasionally up to about 45°', principle: 'rollers' },
  double: { label: 'Double cardan with centring ball', short: 'Double cardan', maxAngle: 40, maxNote: 'Large lock-to-lock angle; relatively large for its torque', principle: 'twin-hooke' },
}

export const CV_CITES: Record<CVType, ReturnType<typeof HJ2>[]> = {
  rzeppa: [HJ2('§26.2.5 Rzeppa joint, Birfield joint, Figs 26.16–26.19')],
  weiss: [HJ2('§26.2.6 Carl Weiss joint, Figs 26.20–26.23')],
  tracta: [HJ2('§26.2.4 Tracta joint, Fig 26.15')],
  tripode: [HJ2('§26.2.7 Tripode (tripot) joint, Fig 26.24')],
  double: [HJ2('§26.2.3 Double Hooke’s type CV joint, Fig 26.12')],
}

export const TOP5 = cite('AEE510', 'AEE510 Transmission of Power.pdf', 'p5 (book p392): CV joint 40°; U-joint efficiency over 99 %')

export interface CVParams {
  type: CVType
  /** shaft angle, degrees */
  delta: number
  rpm: number
}

export const DEFAULTS: CVParams = { type: 'rzeppa', delta: 30, rpm: 600 }

interface Store extends CVParams {
  set: (p: Partial<CVParams>) => void
  reset: () => void
}

export const useCVJ = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Half-angle double-Hooke spec used for the Tracta and double-cardan joints. */
export const halfSpec = (delta: number) => ({ delta1: delta / 2, delta2: delta / 2, phase: 0, twist: 0, arrangement: 'W' as const })

/** Ball-type and tripode joints: output locked to input (ω_out = ω_in). */
export function makeCVGraph() {
  const g = new DriveGraph()
  g.body('in')
  g.body('out')
  g.add(coupling('cv', 'in', 'out'))
  return g
}

export { makeGraph as makeTwinGraph }

export interface LiveCV {
  theta: number
  omegaIn: number
  omegaOut: number
  /** intermediate member (Tracta swivels, double-cardan centre yoke) */
  omegaMid: number
  ratio: number
}

export const live: LiveCV = { theta: 0, omegaIn: 0, omegaOut: 0, omegaMid: 0, ratio: 1 }

/** Curves over one revolution: output, intermediate member and a single Hooke's joint at δ. */
export function curves(type: CVType, deltaDeg: number, n = 181) {
  const d = rad(deltaDeg)
  const xs: number[] = []
  const out: number[] = []
  const mid: (number | null)[] = []
  const single: number[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 * Math.PI
    xs.push((t * 180) / Math.PI)
    out.push(1)
    mid.push(TYPES[type].principle === 'twin-hooke' ? doubleHooke(halfSpec(d), t).ratioC : null)
    single.push(hookeVelocityRatio(d, t))
  }
  return { xs, out, mid, single }
}
