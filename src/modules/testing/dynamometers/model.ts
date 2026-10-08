import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { PTO_DRIVE_EFFICIENCY, dynoTorque, engineTorque, operatingPoint, type DynoKind, type DynoSpec } from '@/physics/dynamometer'
import { STD_GUIDE, STD_NOTES, correctedPower, correctionFactor } from '@/physics/testing'

export type { DynoKind }

/** Shaft centre height of the test bed, m. Frame: X along the shafts, Y up. */
export const SHAFT_Y = 0.55

/** PTO speed 540 rpm is reached at this engine speed (typical; the notes give no PTO ratio). */
export const PTO_ENGINE_RPM = 2000
export const PTO_RATIO = PTO_ENGINE_RPM / 540

/**
 * Absorption characteristics (dynamometer shaft). Arm lengths and capacities are typical sizes
 * chosen so that full load can pull the Farmland engine down to stall.
 */
export const SPEC: Record<DynoKind, DynoSpec> = {
  prony: { kind: 'prony', arm: 1.0, Tmax: 200, nRef: 2000 },
  hydraulic: { kind: 'hydraulic', arm: 0.5, Tmax: 230, nRef: 2000 },
  eddy: { kind: 'eddy', arm: 0.45, Tmax: 230, nRef: 1000 },
  dc: { kind: 'dc', arm: 0.45, Tmax: 240, nRef: 2000 },
  pto: { kind: 'pto', arm: 0.6, Tmax: 760, nRef: 540 },
}

export const KIND_LABEL: Record<DynoKind, string> = {
  prony: 'Prony',
  hydraulic: 'Hydraulic',
  eddy: 'Eddy-current',
  dc: 'DC cradle',
  pto: 'PTO shop',
}

export const C = {
  tests: (w: string) => SRC.tests502(w),
  pm: (w: string) => SRC.pm502(w),
  prony: SRC.tests502('p5, Fig 15.2, eq 3–4'),
  hydraulic: SRC.tests502('p6, Fig 15.3'),
  eddy: SRC.tests502('p7, eddy-current dynamometer'),
  dc: SRC.tests502('p7–8, Fig 15.4, eq 5'),
  pto: SRC.tests502('p8–9, Fig 15.5 shop-type dynamometer'),
  engine: SRC.mech502('p4, Fig 2.2 “Farmland” engine (Leyland 253)'),
  correction: SRC.pm502('p11–12, correcting power for atmospheric conditions'),
}

export interface DynoParams {
  kind: DynoKind
  /** load setting 0…1 (handwheel, needle valves, field excitation) */
  load: number
  /** torque-arm length, m */
  arm: number
  /** observed barometric pressure, kPa */
  BPo: number
  /** observed air temperature, °C */
  ToC: number
  /** correction exponent n */
  nExp: number
  std: 'notes' | 'guide'
  /** water inlet temperature (hydraulic), °C, and flow, kg/s */
  waterIn: number
  waterFlow: number
}

export const DEFAULTS: DynoParams = { kind: 'hydraulic', load: 0.62, arm: SPEC.hydraulic.arm, BPo: 97, ToC: 32, nExp: 0.7, std: 'notes', waterIn: 25, waterFlow: 0.4 }

interface Store extends DynoParams {
  set: (p: Partial<DynoParams>) => void
  reset: () => void
}

export const useDyno = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) =>
    set((s) => {
      const next = { ...p }
      // switching dynamometer resets the arm to that machine's own torque arm
      if (p.kind && p.kind !== s.kind && p.arm === undefined) next.arm = SPEC[p.kind].arm
      return next
    }),
  reset: () => set(DEFAULTS),
}))

/** Load torque referred to the engine crankshaft at engine speed n. */
export function loadAtEngine(kind: DynoKind, s: number, n: number) {
  const spec = SPEC[kind]
  if (kind !== 'pto') return dynoTorque(spec, s, n)
  // PTO: dyno shaft at n/ratio; T_engine = T_pto / (ratio · η_PTO)
  return dynoTorque(spec, s, n / PTO_RATIO) / (PTO_RATIO * PTO_DRIVE_EFFICIENCY)
}

/** Load setting that holds the engine at speed n on its full-throttle curve. */
export function loadForSpeed(kind: DynoKind, n: number) {
  const Te = engineTorque(n)
  const unit = loadAtEngine(kind, 1, n)
  const ratio = Te / unit
  // prony & hydraulic are linear in s; eddy & DC go as s²
  return Math.max(0, Math.min(1, kind === 'eddy' || kind === 'dc' ? Math.sqrt(ratio) : ratio))
}

export function solve(p: Pick<DynoParams, 'kind' | 'load' | 'arm'>) {
  const op = operatingPoint((n) => loadAtEngine(p.kind, p.load, n))
  const nDyno = p.kind === 'pto' ? op.n / PTO_RATIO : op.n
  const Pdyno = p.kind === 'pto' ? op.P * PTO_DRIVE_EFFICIENCY : op.P
  const Tdyno = nDyno > 0 ? (Pdyno * 60000) / (2 * Math.PI * nDyno) : 0
  const F = Tdyno / p.arm
  return { ...op, nDyno, Tdyno, Pdyno, F }
}

export function correction(p: Pick<DynoParams, 'BPo' | 'ToC' | 'nExp' | 'std'>, P: number) {
  const s = p.std === 'notes' ? STD_NOTES : STD_GUIDE
  const fa = correctionFactor(p.BPo, p.ToC + 273.15, p.nExp, s.BP, s.T)
  return { fa, Pbs: correctedPower(P, fa), std: s }
}

/* ------------------------------ live (3D → panel) ------------------------------ */

export const live = { n: 0, nDyno: 0, T: 0, P: 0, F: 0, waterOut: 25 }
