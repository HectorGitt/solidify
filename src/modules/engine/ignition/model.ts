import { create } from 'zustand'
import { firingAngles } from '@/physics/engine'
import type { CameraPose } from '@/modules/types'

/**
 * Ignition, starting & charging — AEE509 L4, Supp, TB ch.5 (Figs 5.1–5.9).
 * Five assemblies share one scene; the Controls tab swaps between them.
 * Frame: metres, Y up, floor at y = FLOOR for every assembly.
 */
export const FLOOR = -0.25

export type Sub = 'coil' | 'magneto' | 'plug' | 'starter' | 'charging'

export const SUBS: { id: Sub; label: string; title: string }[] = [
  { id: 'coil', label: 'Coil', title: 'Battery (coil) ignition for a four-cylinder engine' },
  { id: 'magneto', label: 'Magneto', title: 'Magneto with impulse coupling' },
  { id: 'plug', label: 'Plugs', title: 'Spark plug cutaway, hot vs cold' },
  { id: 'starter', label: 'Starter', title: 'Starter motor and ring gear' },
  { id: 'charging', label: 'Charging', title: 'Battery, dynamo and alternator' },
]

export const CAMERAS: Record<Sub, CameraPose> = {
  coil: { position: [0.78, 0.42, 0.82], target: [0.16, -0.06, 0] },
  magneto: { position: [0.34, -0.02, 0.36], target: [0, -0.15, 0.02] },
  plug: { position: [0.12, -0.14, 0.18], target: [0, -0.205, 0] },
  starter: { position: [0.62, 0.12, 0.42], target: [0.06, -0.1, -0.05] },
  charging: { position: [0.55, 0.3, 0.85], target: [0.06, -0.1, 0] },
}

export const CUT_FOR: Record<Sub, string> = { coil: 'z0', magneto: 'x0', plug: 'z0', starter: 'starter', charging: 'z0' }

/** world units per hatch line for each assembly (real sizes differ by 10×) */
export const HATCH: Record<Sub, number> = { coil: 0.004, magneto: 0.0025, plug: 0.0009, starter: 0.003, charging: 0.004 }

/* ------------------------------ coil ignition ------------------------------ */

export const ORDER = [1, 3, 4, 2]
const FA = firingAngles(ORDER)
/** firing angle (crank deg) of cylinder 1…4 */
export const FIRING = [1, 2, 3, 4].map((c) => FA.get(c)!)
/** spark-plug z for cylinder 1…4 (cylinder 1 at the front, +Z) */
export const PLUG_Z = [0.135, 0.045, -0.045, -0.135]
export const PLUG_X = 0.035
export const HEAD_TOP = 0.02

/** coil electrical constants (typical — beyond notes) */
export const COIL = { L: 0.006, R: 3.2, C: 0.25e-6, coupling: 0.6 }

/* ------------------------------ starter ------------------------------ */

export const RING_TEETH = 108
export const PINION_TEETH = 9
export const GEAR_MODULE = 0.0025
export const FLY_C: [number, number] = [0, -0.05]
export const RING_R = (RING_TEETH * GEAR_MODULE) / 2
export const PINION_R = (PINION_TEETH * GEAR_MODULE) / 2
/** starter on the line of centres at 315° (lower right of the flywheel) */
export const STARTER_ANGLE = (-45 * Math.PI) / 180
export const STARTER_C: [number, number] = [
  FLY_C[0] + (RING_R + PINION_R) * Math.cos(STARTER_ANGLE),
  FLY_C[1] + (RING_R + PINION_R) * Math.sin(STARTER_ANGLE),
]
/** pinion travel along the shaft from rest to full mesh */
export const PINION_TRAVEL = 0.022

/* ------------------------------ parameters ------------------------------ */

export type PlugType = 'hot' | 'cold'

export interface IgnParams {
  sub: Sub
  /** engine speed for coil ignition / charging, rpm */
  rpm: number
  /** spark advance, deg BTDC */
  advance: number
  /** fraction of each cam interval the points are closed */
  dwell: number
  volts: 6 | 12
  n1: number
  n2: number
  /** magneto drive (cranking) speed, rpm */
  crankRpm: number
  /** engine load 0 (light) … 1 (heavy), for plug heat range */
  load: number
  plug: PlugType
  gauge: boolean
  /** starter key held */
  key: boolean
  /** electrical load, A (lights etc.) */
  loadA: number
  gen: 'dynamo' | 'alternator'
}

export const DEFAULTS: IgnParams = {
  sub: 'coil',
  rpm: 1500,
  advance: 25,
  dwell: 0.6,
  volts: 12,
  n1: 250,
  n2: 21000,
  crankRpm: 120,
  load: 0.5,
  plug: 'hot',
  gauge: true,
  key: false,
  loadA: 12,
  gen: 'alternator',
}

interface Store extends IgnParams {
  set: (p: Partial<IgnParams>) => void
  reset: () => void
}

export const useIgn = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/* ------------------------------ live values ------------------------------ */

export const live = {
  crank: 0,
  rotor: 0,
  closed: false,
  /** primary current, A */
  current: 0,
  /** cylinder whose plug is sparking (0 = none) */
  sparkCyl: 0,
  kv: 0,
  // magneto
  drive: 0,
  mrotor: 0,
  phase: 'solid' as string,
  spring: 0,
  mkv: 0,
  // starter
  engage: 0,
  motorRpm: 0,
  flyRpm: 0,
  stage: 'rest' as string,
  // charging
  soc: 0.7,
  chargeA: 0,
  netA: 0,
}

/** one-shot commands from the panel to the frame loop */
export const starterCmd = { stop: false }

/**
 * Indicative insulator-tip temperature (°C) of a plug — beyond notes. Longer nose (hot plug) and
 * heavier load both raise it; below ≈450 °C deposits foul the plug, above ≈850 °C it can cause
 * pre-ignition. Calibrated so a hot plug suits light loads and a cold plug heavy loads (TB §5.4).
 */
export function plugTipTemp(load: number, noseMm: number) {
  return 246 + 375 * load + 18 * noseMm
}

export const NOSE_MM = { hot: 15.5, cold: 5.5 } as const
