import { create } from 'zustand'
import { SRC } from '@/content/citations'
import {
  accelRms,
  allowedHours,
  axleTransfer,
  bandRms,
  cabs,
  cadd,
  cexpi,
  cmul,
  cx,
  dampingForRatio,
  roughProfile,
  seatTransfer,
  THIRD_OCTAVES,
  type SeatParams,
} from '@/physics/vibration'

/**
 * Tractor seat model (AEE510 Human Engineering, Fig 10.9): operator m₁ on the cushion (k₁, c₁),
 * seat m₂ on the suspension (k₂, c₂, with stops), driven by the tractor floor z_input.
 * Frame: metres, Y up, +X forward, origin on the ground under the rear axle (as src/tractor).
 */
export const T = {
  wheelbase: 1.88,
  /** Farmland tractor (Macmillan App. II): 2850 kg, CG 0.54 m ahead of the rear axle */
  mass: 2850,
  cgX: 0.54,
  rearR: 0.66,
  frontR: 0.39,
  rearAxleY: 0.64,
  /** seat reference point 0.12 m behind the rear axle */
  seatX: -0.12,
  platformY: 0.92,
  /** suspension height (platform to seat-pan underside) at equilibrium */
  suspH: 0.2,
  /** suspension travel to the stops, ± m */
  travel: 0.05,
  /** pitch inertia approximated by splitting the mass between the axles (dynamic index 1) */
  rearMass: (2850 * (1.88 - 0.54)) / 1.88,
  frontMass: (2850 * 0.54) / 1.88,
  /** tyre vertical stiffness per axle (pair) and damping ratio — typical values, not in the notes */
  kRear: 700e3,
  kFront: 400e3,
  tyreZeta: 0.1,
  seatMass: 25,
  /** man-on-cushion frequency, Hz, and damping ratio — typical */
  cushionHz: 5,
  cushionZeta: 0.3,
}

export const C = {
  he: (w: string) => SRC.he510(w),
  ln: (w: string) => SRC.ln518(w),
}

export type Ground = 'road' | 'pasture' | 'ploughed'

/** ISO 8608 roughness G_d(n₀), m³ (beyond the notes). */
export const GROUND: Record<Ground, { label: string; G0: number; note: string }> = {
  road: { label: 'Farm road', G0: 128e-6, note: 'ISO 8608 class B–C' },
  pasture: { label: 'Pasture', G0: 1024e-6, note: 'class D' },
  ploughed: { label: 'Ploughed field', G0: 4096e-6, note: 'class E' },
}

export interface SeatState {
  /** km/h */
  V: number
  ground: Ground
  /** operator mass, kg (Table 10.6: 58 / 75 / 98 kg) */
  op: number
  suspension: boolean
  /** seat natural frequency ω_s/2π with M = m₁ + m₂ (eq 17), Hz */
  fs: number
  /** suspension damping ratio ζ = c/(2Mω_s) (eq 15–16) */
  zs: number
  /** exposure per day, h */
  hours: number
}

export const DEFAULTS: SeatState = { V: 8, ground: 'pasture', op: 75, suspension: true, fs: 1.5, zs: 0.25, hours: 8 }

interface Store extends SeatState {
  set: (p: Partial<SeatState>) => void
  reset: () => void
}

export const useSeat = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const pick = (s: SeatState): SeatState => ({ V: s.V, ground: s.ground, op: s.op, suspension: s.suspension, fs: s.fs, zs: s.zs, hours: s.hours })

export function seatParams(s: SeatState): SeatParams {
  const m1 = s.op
  const m2 = T.seatMass
  const w1 = 2 * Math.PI * T.cushionHz
  const k1 = m1 * w1 * w1
  const c1 = dampingForRatio(T.cushionZeta, k1, m1)
  const M = m1 + m2
  // a locked (rigid) seat: very stiff, as stiff as the cushion ×50
  const ws = s.suspension ? 2 * Math.PI * s.fs : 2 * Math.PI * 25
  const k2 = M * ws * ws
  const c2 = s.suspension ? 2 * s.zs * M * ws : 2 * 0.3 * M * ws
  return { m1, k1, c1, m2, k2, c2 }
}

const tyre = (m: number, k: number) => ({ m, k, c: dampingForRatio(T.tyreZeta, k, m) })
export const REAR = tyre(T.rearMass, T.kRear)
export const FRONT = tyre(T.frontMass, T.kFront)
/** fraction of the front-axle motion seen at the seat point (rigid body between the axles) */
export const BETA = T.seatX / T.wheelbase

export interface Comp {
  f: number
  w: number
  /** amplitude and phase of rear axle, front axle, floor, seat and man displacements */
  r: [number, number]
  fr: [number, number]
  fl: [number, number]
  st: [number, number]
  mn: [number, number]
}

export interface Case {
  key: string
  comps: Comp[]
  profile: ReturnType<typeof roughProfile>
  params: SeatParams
  floorRms: number
  manRms: number
  seatRms: number
  bandsFloor: number[]
  bandsMan: number[]
  /** shortest allowed exposure over all bands (h) and the band that sets it */
  allowed: number
  worstBand: number
  groundRms: number
}

const polar = (z: { re: number; im: number }): [number, number] => [cabs(z), Math.atan2(z.im, z.re)]

let cached: Case | null = null

/** Frequency-domain solution for the current settings (cached). */
export function getCase(s: SeatState): Case {
  const key = JSON.stringify(pick(s))
  if (cached && cached.key === key) return cached
  const profile = roughProfile(GROUND[s.ground].G0, 64, 40, 11, 0.3)
  const v = s.V / 3.6
  const p = seatParams(s)
  const comps: Comp[] = profile.map((c) => {
    const k = (2 * Math.PI) / c.lambda
    const w = k * v
    const Hr = axleTransfer(REAR.m, REAR.c, REAR.k, w)
    const Hf = cmul(axleTransfer(FRONT.m, FRONT.c, FRONT.k, w), cexpi(k * T.wheelbase))
    const floor = cadd(cmul(cx(1 - BETA), Hr), cmul(cx(BETA), Hf))
    const tr = seatTransfer(p, w)
    const amp = (z: { re: number; im: number }) => {
      const [a, ph] = polar(z)
      return [a * c.amp, ph + c.phase] as [number, number]
    }
    return { f: w / (2 * Math.PI), w, r: amp(Hr), fr: amp(Hf), fl: amp(floor), st: amp(cmul(floor, tr.seat)), mn: amp(cmul(floor, tr.man)) }
  })
  const rms = (sel: (c: Comp) => number) => Math.sqrt(comps.reduce((acc, c) => acc + accelRms(sel(c), c.w) ** 2, 0))
  const bandsFloor = bandRms(comps.map((c) => ({ f: c.f, rms: accelRms(c.fl[0], c.w) })))
  const bandsMan = bandRms(comps.map((c) => ({ f: c.f, rms: accelRms(c.mn[0], c.w) })))
  let allowed = 24
  let worstBand = 4
  bandsMan.forEach((a, i) => {
    if (a <= 0) return
    const h = allowedHours(a, THIRD_OCTAVES[i])
    if (h < allowed) {
      allowed = h
      worstBand = THIRD_OCTAVES[i]
    }
  })
  cached = {
    key,
    comps,
    profile,
    params: p,
    floorRms: rms((c) => c.fl[0]),
    manRms: rms((c) => c.mn[0]),
    seatRms: rms((c) => c.st[0]),
    bandsFloor,
    bandsMan,
    allowed,
    worstBand,
    groundRms: Math.sqrt(profile.reduce((a, c) => a + (c.amp * c.amp) / 2, 0)),
  }
  return cached
}

/** Sum of components: displacement, velocity, acceleration at time t. */
export function sumAt(comps: Comp[], sel: (c: Comp) => [number, number], t: number) {
  let z = 0
  let v = 0
  let a = 0
  for (const c of comps) {
    const [A, ph] = sel(c)
    const s = Math.sin(c.w * t + ph)
    const co = Math.cos(c.w * t + ph)
    z += A * s
    v += A * c.w * co
    a -= A * c.w * c.w * s
  }
  return { z, v, a }
}

/* ------------------------------ live (3D → panel) ------------------------------ */

export const TRACE_N = 240
export const TRACE_SPAN = 4

export const live = {
  t: 0,
  /** running RMS (5 s exponential window) */
  manRms: 0,
  floorRms: 0,
  hits: 0,
  stroke: 0,
  traceT: Array.from({ length: TRACE_N }, (_, i) => (i * TRACE_SPAN) / TRACE_N - TRACE_SPAN),
  traceFloor: new Array<number>(TRACE_N).fill(0),
  traceMan: new Array<number>(TRACE_N).fill(0),
  version: 0,
}
