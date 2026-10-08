import { create } from 'zustand'
import { cite } from '@/content/citations'
import { KGCM2_TO_MPA, hydraulicPower, reliefSplit } from '@/physics/hydraulics'
import { DEFAULT_LINKAGE, linkageRange, solveLinkage, type P2 } from '@/tractor/linkage'

export const MG1617 = (where?: string) => cite('AEE502', 'AEE 502-2016-2017- Marking Guide-draft-new.docx', where)

/**
 * Simple tractor hydraulic lift (AEE510 Tractor Hydraulic System Fig 40; AEE502 2016/17 guide):
 * reservoir (transmission housing) → pump → filter → control valve → single-acting ram →
 * ram cross shaft (rockshaft) → lift arms → lift rods → lower links. Relief valve to tank.
 *
 * Side view in X–Y using the shared tractor frame (+X forward, origin on the ground under the
 * rear axle); the linkage itself is solved by `solveLinkage` (src/tractor/linkage.ts).
 */
export const G = DEFAULT_LINKAGE
export const C = G.C

/** Ram crank arm on the rockshaft (rigid with the lift arms). */
export const CRANK = 0.12
/** Fixed ram pivot (front end of the ram cylinder). */
export const RAM_PIVOT: P2 = { x: C.x + 0.58, y: C.y - 0.13 }
export const RAM_BORE = 0.09

/** Crank-pin position for a lift-arm angle β (crank hangs straight down at β = 0). */
export function crankPin(beta: number): P2 {
  const a = (3 * Math.PI) / 2 - beta
  return { x: C.x + CRANK * Math.cos(a), y: C.y + CRANK * Math.sin(a) }
}

export function ramLength(phi: number) {
  const pose = solveLinkage(phi)
  const K = crankPin(pose.beta)
  return { pose, K, L: Math.hypot(K.x - RAM_PIVOT.x, K.y - RAM_PIVOT.y) }
}

/** Working range of the lower links: hitch from near the ground to fully raised. */
const range = linkageRange()
export const PHI_LOW = Math.min(range.hi - 0.02, Math.asin((G.A.y - 0.12) / G.lower))
export const PHI_HIGH = Math.max(range.lo + 0.02, Math.asin((G.A.y - 0.78) / G.lower))

export const RAM_MIN = Math.min(ramLength(PHI_LOW).L, ramLength(PHI_HIGH).L)
export const RAM_MAX = Math.max(ramLength(PHI_LOW).L, ramLength(PHI_HIGH).L)
/** rod length (piston face → crank pin) and barrel length, so the piston stays in the barrel */
export const ROD_LEN = RAM_MIN - 0.05
export const BARREL_LEN = RAM_MAX - ROD_LEN + 0.07

/**
 * Effective lever ratio dy_hitch / dL_ram (virtual work): ram force F = W·dy/dL for a load W
 * hanging on the lower hitch points.
 */
export function leverRatio(phi: number) {
  const h = 1e-4
  const a = ramLength(phi - h)
  const b = ramLength(phi + h)
  const dL = b.L - a.L
  const dy = b.pose.L.y - a.pose.L.y
  return Math.abs(dy / dL)
}

/** d(phi)/d(ram length) for converting ram speed into linkage motion. */
export function dPhidL(phi: number) {
  const h = 1e-4
  return (2 * h) / (ramLength(phi + h).L - ramLength(phi - h).L)
}

export type Valve = 'lift' | 'hold' | 'lower'

export interface LiftParams {
  valve: Valve
  /** pump delivery, L/min */
  Q: number
  /** relief setting, MPa */
  relief: number
  /** implement weight on the hitch, kN */
  load: number
  /** lowering rate set by the flow-control valve, L/min */
  dropQ: number
  bore: number
  flows: boolean
}

export const DEFAULTS: LiftParams = { valve: 'lift', Q: 27, relief: 150 * KGCM2_TO_MPA, load: 6, dropQ: 18, bore: RAM_BORE, flows: true }

interface Store extends LiftParams {
  set: (p: Partial<LiftParams>) => void
  reset: () => void
}

export const useLift = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Everything the panel needs for a lower-link angle. */
export function analyse(p: Pick<LiftParams, 'Q' | 'relief' | 'load' | 'bore'>, phi: number) {
  const area = (Math.PI / 4) * p.bore ** 2
  const ratio = leverRatio(phi)
  const ramForce = p.load * 1000 * ratio
  const pNeed = ramForce / area / 1e6
  const split = reliefSplit(p.Q, pNeed, p.relief)
  const capacity = (p.relief * 1e6 * area) / ratio / 1000
  return {
    area,
    ratio,
    ramForce,
    pNeed,
    split,
    capacity,
    ramSpeed: split.toLoad / 60000 / area,
    power: hydraulicPower(p.Q, split.pressure),
    overload: pNeed >= p.relief,
  }
}

export type Mode = 'lifting' | 'holding' | 'lowering' | 'relief' | 'raised' | 'down'

export interface LiveLift {
  phi: number
  /** hitch height above ground, m */
  hitchY: number
  mode: Mode
  /** ram pressure, MPa */
  p: number
  /** flow to ram / over relief / to tank via valve, L/min */
  toRam: number
  toRelief: number
  toTank: number
  ramSpeed: number
  /** relief poppet opening 0…1 (smoothed for display) */
  reliefOpen: number
}

export const live: LiveLift = { phi: PHI_LOW, hitchY: 0.12, mode: 'down', p: 0, toRam: 0, toRelief: 0, toTank: 0, ramSpeed: 0, reliefOpen: 0 }

/** Advance the circuit one step: returns the new lower-link angle and fills `live`. */
export function step(p: LiftParams, phi: number, dt: number): number {
  const a = analyse(p, phi)
  const raised = phi <= PHI_HIGH + 1e-6
  const down = phi >= PHI_LOW - 1e-6
  let mode: Mode = 'holding'
  let toRam = 0
  let toRelief = 0
  let toTank = 0
  let pr = a.pNeed
  let dL = 0
  if (p.valve === 'lift') {
    if (a.overload || raised) {
      mode = a.overload ? 'relief' : 'raised'
      toRelief = p.Q
      pr = p.relief
    } else {
      mode = 'lifting'
      toRam = p.Q
      dL = (p.Q / 60000 / a.area) * dt
    }
  } else if (p.valve === 'lower') {
    // implement drops under its own weight, pushing oil back to the reservoir (open-centre: pump flow to tank too)
    toTank = p.Q
    if (down || p.load <= 0) {
      mode = 'down'
      pr = 0
    } else {
      mode = 'lowering'
      toRam = -p.dropQ
      dL = -(p.dropQ / 60000 / a.area) * dt
    }
  } else {
    toTank = p.Q
    mode = down ? 'down' : 'holding'
  }
  let next = phi + dL * dPhidL(phi)
  next = Math.min(PHI_LOW, Math.max(PHI_HIGH, next))
  const pose = solveLinkage(next)
  live.phi = next
  live.hitchY = pose.L.y
  live.mode = mode
  live.p = Math.max(0, pr)
  live.toRam = toRam
  live.toRelief = toRelief
  live.toTank = toTank
  live.ramSpeed = dt > 0 ? dL / dt : 0
  return next
}
