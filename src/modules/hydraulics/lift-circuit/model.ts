import { create } from 'zustand'
import { cite } from '@/content/citations'
import { KGCM2_TO_MPA, hydraulicPower, reliefSplit } from '@/physics/hydraulics'

export const MG1617 = (where?: string) => cite('AEE502', 'AEE 502-2016-2017- Marking Guide-draft-new.docx', where)

/**
 * Simple tractor hydraulic lift (AEE510 Tractor Hydraulic System Fig 40; AEE502 2016/17 guide):
 * reservoir (transmission housing) → pump → filter → control valve → single-acting ram →
 * ram cross shaft (rockshaft) → lift arms → lift rods → lower links. Relief valve to tank.
 *
 * Side view in X–Y using the shared tractor frame (+X forward, origin on the ground under the
 * rear axle); the linkage itself is solved by `solveLinkage` (src/tractor/linkage.ts).
 */
export { G, C, CRANK, RAM_PIVOT, RAM_BORE, crankPin, ramLength, PHI_LOW, PHI_HIGH, RAM_MIN, RAM_MAX, ROD_LEN, BARREL_LEN, leverRatio } from '@/tractor/liftRam'
import { PHI_HIGH, PHI_LOW, RAM_BORE, leverRatio, ramLength } from '@/tractor/liftRam'
import { solveLinkage } from '@/tractor/linkage'

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
