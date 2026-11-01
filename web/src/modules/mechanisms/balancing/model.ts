import { create } from 'zustand'
import { coupleMrz, dynamicBalance, resultantMr, staticBalance, type RotatingMass } from '@/physics/machinedynamics'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

export type Correction = 'none' | 'static' | 'dynamic'

export interface MassRow {
  /** kg */
  m: number
  /** mm */
  r: number
  /** deg */
  angle: number
  /** position along the shaft, mm from the left bearing */
  z: number
}

export interface BalanceParams {
  rows: MassRow[]
  correction: Correction
  rpm: number
  /** the correction's radius, mm */
  rb: number
  set: (p: Partial<BalanceParams>) => void
  setRow: (i: number, p: Partial<MassRow>) => void
  reset: () => void
}

/** the three masses of the worked example; spread along the shaft so its couple can be seen too */
export const DEFAULTS = {
  rows: [
    { m: 5, r: 30, angle: 0, z: 200 },
    { m: 7, r: 45, angle: 52, z: 400 },
    { m: 12, r: 25, angle: 220, z: 600 },
  ] as MassRow[],
  correction: 'none' as Correction,
  rpm: 300,
  rb: 40,
}

export const useBalance = create<BalanceParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  setRow: (i, p) => set((s) => ({ rows: s.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) })),
  reset: () => set(DEFAULTS),
}))

/** the two correction planes, mm */
export const PLANE_A = 80
export const PLANE_B = 720
export const SHAFT = 800

const toMass = (r: MassRow): RotatingMass => ({ m: r.m, r: r.r / 1000, angle: rad(r.angle), z: r.z / 1000 })

/** the masses on the shaft, the corrections, and what is left */
export function analyse(p: { rows: MassRow[]; correction: Correction; rb: number }) {
  const ms = p.rows.map(toMass)
  const rb = p.rb / 1000
  const single = staticBalance(ms, rb)
  // a static correction sits in the plane of the masses’ centre, so it removes the force only
  const totalMr = ms.reduce((s, q) => s + q.m * q.r, 0) || 1
  const zMid = ms.reduce((s, q) => s + q.m * q.r * (q.z ?? 0), 0) / totalMr
  const two = dynamicBalance(ms, PLANE_A / 1000, PLANE_B / 1000)
  const added: RotatingMass[] =
    p.correction === 'static'
      ? [{ m: single.mb, r: rb, angle: single.angle, z: zMid }]
      : p.correction === 'dynamic'
        ? [
            { m: two.a.mr / rb, r: rb, angle: two.a.angle, z: PLANE_A / 1000 },
            { m: two.b.mr / rb, r: rb, angle: two.b.angle, z: PLANE_B / 1000 },
          ]
        : []
  const all = [...ms, ...added]
  const left = resultantMr(all)
  // the couple about the middle of the shaft
  const mid = SHAFT / 2000
  const couple = coupleMrz(all.map((q) => ({ ...q, z: (q.z ?? 0) - mid })))
  return { ms, single, two, added, leftMr: left.mag, leftAngle: left.angle, couple, zMid }
}

export const live = { theta: 0 }
