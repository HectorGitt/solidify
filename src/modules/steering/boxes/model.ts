import { create } from 'zustand'
import { cite } from '@/content/citations'
import { rad, recircBall, wormPeg } from '@/physics/joints'

/** Tractor Steering .pdf (AEE510), PDF p3–4 = book pp92–93; Fig 46. */
export const ST = (where: string) => cite('AEE510', 'Tractor Steering .pdf', where)

/**
 * Two steering boxes side by side, column axes along +X (wheel end at +X).
 * Recirculating-ball box centred at z = +BALL.z, worm-and-peg box at z = WORM.z (metres).
 * Proportions are typical of a 30–60 kW tractor; the notes give only the ±30° drop-arm swing.
 */
export const SWING = rad(30)
/** steering-wheel turns from straight ahead to full lock (typical, beyond notes) */
export const TURNS = 2

export { BALL, helixAngle, SCREW_PHASE } from '@/parts/lib/steeringBox'
import { BALL } from '@/parts/lib/steeringBox'

export { WORM } from '@/parts/lib/steeringBox'
import { WORM } from '@/parts/lib/steeringBox'

export const COLUMN_END = 0.3

export interface BoxParams {
  /** steering-wheel angle, degrees (+ = clockwise seen by the driver) */
  wheel: number
  sweep: boolean
  flows: boolean
}

export const DEFAULTS: BoxParams = { wheel: 0, sweep: true, flows: true }

interface Store extends BoxParams {
  set: (p: Partial<BoxParams>) => void
  reset: () => void
}

export const useBoxes = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export function kinematics(wheelRad: number) {
  return { ball: recircBall(wheelRad, BALL.lead, BALL.arm), peg: wormPeg(wheelRad, WORM.lead, WORM.arm) }
}

export interface LiveBoxes {
  wheel: number
  nutX: number
  phiBall: number
  phiPeg: number
  ratioBall: number
  ratioPeg: number
}

export const live: LiveBoxes = { wheel: 0, nutX: 0, phiBall: 0, phiPeg: 0, ratioBall: 0, ratioPeg: 0 }

/** Curves of drop-arm angle and instantaneous ratio against wheel angle (lock to lock). */
export function curves(n = 121) {
  const xs: number[] = []
  const pb: number[] = []
  const pp: number[] = []
  const rb: number[] = []
  const rp: number[] = []
  const lim = TURNS * 360
  for (let i = 0; i < n; i++) {
    const w = -lim + (2 * lim * i) / (n - 1)
    const k = kinematics(rad(w))
    xs.push(w)
    pb.push((k.ball.phi * 180) / Math.PI)
    pp.push((k.peg.phi * 180) / Math.PI)
    rb.push(k.ball.ratio)
    rp.push(k.peg.ratio)
  }
  return { xs, pb, pp, rb, rp }
}
