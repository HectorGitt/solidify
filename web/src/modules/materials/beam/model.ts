import { create } from 'zustand'
import { curves, extremes, eye, rect, sectionProps, tee, type Beam, type BeamLoad, type Section } from '@/physics/beam'

export type SupportKind = 'simple' | 'cantilever'
export type SectionKind = 'rect' | 'tee' | 'eye'

export interface BeamParams {
  support: SupportKind
  /** span, m */
  L: number
  /** point loads, kN, at x from the left, m */
  P1: number
  x1: number
  P2: number
  x2: number
  /** uniform load over the whole span, kN/m */
  w: number
  section: SectionKind
  /** mm */
  bf: number
  tf: number
  hw: number
  tw: number
  /** GPa */
  E: number
  /** where the section's stresses are read, as a fraction of the span */
  probe: number
  stress: boolean
  diagrams: boolean
  set: (p: Partial<BeamParams>) => void
  reset: () => void
}

/** an I beam with the two loads of the classic exercise */
export const DEFAULTS = {
  support: 'simple' as SupportKind,
  L: 6,
  P1: 20,
  x1: 2,
  P2: 40,
  x2: 4,
  w: 0,
  section: 'eye' as SectionKind,
  bf: 150,
  tf: 15,
  hw: 270,
  tw: 10,
  E: 200,
  probe: 0.667,
  stress: true,
  diagrams: true,
}

export const useBeam = create<BeamParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export type BeamInputs = Omit<BeamParams, 'set' | 'reset'>

export function sectionOf(p: BeamInputs): Section {
  const m = 1e-3
  if (p.section === 'tee') return tee(p.bf * m, p.tf * m, p.hw * m, p.tw * m)
  if (p.section === 'eye') return eye(p.bf * m, p.tf * m, p.hw * m, p.tw * m)
  return rect(p.bf * m, p.hw * m)
}

export function beamOf(p: BeamInputs): Beam {
  const loads: BeamLoad[] = []
  if (p.P1 > 0) loads.push({ kind: 'point', x: Math.min(p.x1, p.L), P: p.P1 * 1e3 })
  if (p.P2 > 0) loads.push({ kind: 'point', x: Math.min(p.x2, p.L), P: p.P2 * 1e3 })
  if (p.w > 0) loads.push({ kind: 'udl', x0: 0, x1: p.L, w: p.w * 1e3 })
  return { L: p.L, support: p.support === 'cantilever' ? { kind: 'cantilever' } : { kind: 'simple', a: 0, b: p.L }, loads }
}

/** everything derived from the inputs */
export function analyse(p: BeamInputs) {
  const section = sectionOf(p)
  const props = sectionProps(section)
  const beam = beamOf(p)
  const EI = p.E * 1e9 * props.I
  const c = curves(beam, EI, 240)
  return { section, props, beam, EI, c, peak: extremes(c) }
}

export const LENGTH_DRAWN = 1.5
