import { create } from 'zustand'
import { DriveGraph, coupling, gearMesh } from '@/core/drive'
import { frictionPairs, frictionRadius, type ClutchTheory } from '@/physics/clutch'
import { TYPICAL_PEDAL, clutchPedal, radToRpm, rpmToRad } from '@/physics/gearing'
import { DC, DUAL_PRIMARY, DUAL_STAGE2, PISTON_AREA, SP, WP } from './dims'

export type ClutchKind = 'single' | 'dual' | 'ipto'
export type Actuation = 'mechanical' | 'hydraulic' | 'electrical'

export interface ClutchParams {
  kind: ClutchKind
  /** pedal travel, mm (0…150) */
  pedal: number
  /** pedal free play, mm (TTS p3–4: about 18 mm) */
  freePlay: number
  actuation: Actuation
  engineRpm: number
  /** resisting torque on the gearbox shaft, N·m */
  load: number
  /** resisting torque on the PTO shaft, N·m */
  ptoLoad: number
  theory: ClutchTheory
  /** IPTO spool valve: true = engaged */
  spool: boolean
  /* torque calculator (AEE503 M8) */
  calcMode: 'force' | 'pressure'
  calcF: number
  calcP: number
  calcMu: number
  calcRo: number
  calcRi: number
  calcN1: number
  calcN2: number
}

export const DEFAULTS: ClutchParams = {
  kind: 'single',
  pedal: 0,
  freePlay: 18,
  actuation: 'mechanical',
  engineRpm: 1500,
  load: 120,
  ptoLoad: 150,
  theory: 'wear',
  spool: true,
  calcMode: 'force',
  calcF: SP.clampLoad,
  calcP: 350e3,
  calcMu: SP.mu,
  calcRo: SP.Ro,
  calcRi: SP.Ri,
  calcN1: 2,
  calcN2: 1,
}

interface Store extends ClutchParams {
  set: (p: Partial<ClutchParams>) => void
  reset: () => void
}

export const useClutch = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/* ------------------------------ Capacities ------------------------------ */

/** Full-clamp torque capacity of the single plate (two friction faces), N·m. */
export function singleCapacity(theory: ClutchTheory) {
  return SP.clampLoad * SP.mu * frictionRadius(SP.Ro, SP.Ri, theory) * 2
}
export function dualCapacities(theory: ClutchTheory) {
  return {
    trans: DC.primaryLoad * DC.mu * frictionRadius(DC.pRo, DC.pRi, theory) * 2,
    pto: DC.secondaryLoad * DC.mu * frictionRadius(DC.sRo, DC.sRi, theory) * 2,
  }
}
/** Wet pack: 5 friction plates between 4 inter-plates, the piston and the drum backing face → 10 surfaces. */
export const IPTO_SURFACES = frictionPairs(WP.friction + 1, WP.friction)
export function iptoForce(p: number) {
  return Math.max(0, p * PISTON_AREA - WP.belleville)
}
export function iptoCapacity(p: number, theory: ClutchTheory) {
  return iptoForce(p) * WP.mu * frictionRadius(WP.fOut, WP.fIn, theory) * IPTO_SURFACES
}

/** Pedal state of each stage for the current kind. */
export function pedalStages(p: Pick<ClutchParams, 'pedal' | 'freePlay'>) {
  const single = clutchPedal(p.pedal, { ...TYPICAL_PEDAL, freePlay: p.freePlay })
  const primary = clutchPedal(p.pedal, { ...DUAL_PRIMARY, freePlay: p.freePlay })
  const secondary = clutchPedal(p.pedal, { ...DUAL_PRIMARY, freePlay: p.freePlay + DUAL_STAGE2 })
  return { single, primary, secondary }
}

/* ------------------------------ Slip dynamics ------------------------------ */

export interface SlipState {
  /** driven shaft speed, rad/s */
  w: number
  locked: boolean
}

/**
 * One step of a friction clutch driving a shaft of inertia J against a resisting torque.
 * Locked while the capacity exceeds the load; slipping, the clutch passes its capacity
 * (Coulomb friction) and the shaft accelerates or slows; the load never drives it backwards.
 * Returns the torque transmitted through the clutch.
 */
export function slipStep(s: SlipState, wIn: number, Tcap: number, Tload: number, J: number, dt: number, brakeT = 0) {
  if (s.locked) {
    if (Tcap >= Tload + brakeT && brakeT === 0) {
      s.w = wIn
      return Tload
    }
    s.locked = false
  }
  const T = wIn >= s.w ? Tcap : -Tcap
  const resist = Tload + brakeT
  let w = s.w + ((T - resist) / J) * dt
  if (w < 0) w = 0
  if (s.w < wIn && w >= wIn && Tcap >= Tload && brakeT === 0) {
    s.locked = true
    w = wIn
  }
  s.w = w
  return T
}

export const J_GEARBOX = 0.25
export const J_PTO = 0.4

/* ------------------------------ Drive graph ------------------------------ */

export function makeGraph(state: { gearboxLocked: () => boolean; transLocked: () => boolean; ptoLocked: () => boolean; iptoLocked: () => boolean }) {
  const g = new DriveGraph()
  g.body('engine')
  g.body('gearbox', 0.5)
  g.body('lay', 0.5)
  g.body('trans', 0.5)
  g.body('pto', 0.5)
  g.body('iptoOut', 0.5)
  g.add(coupling('clutch', 'engine', 'gearbox', state.gearboxLocked))
  g.add(gearMesh('constant-mesh', 'gearbox', 20, 'lay', 34))
  g.add(coupling('primary', 'engine', 'trans', state.transLocked))
  g.add(coupling('secondary', 'engine', 'pto', state.ptoLocked))
  g.add(coupling('ipto', 'engine', 'iptoOut', state.iptoLocked))
  return g
}

/* ------------------------------ Live values ------------------------------ */

export const live = {
  engine: 0,
  gearbox: 0,
  pto: 0,
  /** torque capacity now, N·m (single / transmission plate) */
  cap: 0,
  capPto: 0,
  /** torque passed by the clutch, N·m */
  torque: 0,
  /** heat generated by slip, kW */
  heat: 0,
  clamp: 1,
  clampPto: 1,
  lift: 0,
  drag: 0,
  bearing: false,
  state: 'engaged' as 'engaged' | 'slipping' | 'released',
  statePto: 'engaged' as 'engaged' | 'slipping' | 'released',
  /** IPTO oil pressure, bar; piston force, N; PTO brake on */
  pressure: 0,
  force: 0,
  braking: false,
}

export { radToRpm, rpmToRad }
