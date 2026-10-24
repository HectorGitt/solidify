import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { applicationRate, linePressure, nozzleK, reliefBypass, testRunLength, type NozzleKind } from '@/physics/application'
import { phiForHitchHeight, solveLinkage } from '@/tractor/linkage'
import { PTO_STUB_X, PTO_Y } from '@/tractor/geometry'

export const C = {
  sprayer: (w: string) => SRC.am502(`§15.5.2 ${w}`),
  nozzle: (w: string) => SRC.am502(`§15.6.1 ${w}`),
  pump: (w: string) => SRC.am502(`§15.6.2 ${w}`),
  boom: (w: string) => SRC.am502(`§15.7.3 ${w}`),
  perf: (w: string) => SRC.am502(`§15.8 ${w}`),
  calib: (w: string) => SRC.am502(`§15.12 ${w}`),
  ulv: (w: string) => SRC.am502(`§15.10–15.11 ${w}`),
  guide1819: (w: string) => cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', w),
  pto: (w: string) => SRC.pto502(w),
}

/** Hitch height while spraying (lower hitch balls above ground), m. */
export const HITCH_H = 0.55
export const LK = solveLinkage(phiForHitchHeight(HITCH_H))
/** Hitch-frame origin in tractor coordinates (the mounted sprayer is drawn relative to it). */
export const HX = LK.L.x
export const HY = LK.L.y
/** Top-link pin relative to the hitch balls. */
export const MAST_TOP: [number, number] = [LK.U.x - LK.L.x, LK.U.y - LK.L.y]
/** PTO stub end in hitch coordinates. */
export const PTO_LOCAL: [number, number, number] = [PTO_STUB_X - 0.06 - HX, PTO_Y - HY, 0]

/** Twin-piston pump with air chamber (§15.6.2), typical: bore 42 mm, stroke 24 mm, ηv 0.9. */
export const PUMP = { bore: 0.042, stroke: 0.024, pistons: 2, etaV: 0.9, x: 0.2, y: 0.1 }
export const pumpFlowLmin = (ptoRpm: number) => PUMP.pistons * (Math.PI / 4) * PUMP.bore ** 2 * PUMP.stroke * ptoRpm * PUMP.etaV * 1000

/** Sprayer layout in hitch coordinates. */
export const LAYOUT = {
  tank: { x: -0.6, y: 0.62, w: 0.8, h: 0.8, d: 1.05, capacity: 600 },
  frameX: [0.05, -1.05] as [number, number],
  boomX: -1.2,
  /** relief valve, gauge and section manifold on the control post (z, the tractor's left) */
  ctrl: { x: -0.08, z: 0.45 },
  strainer: { x: -0.12, y: 0.12, z: -0.3 },
}
export const BOOM_WORLD_X = HX + LAYOUT.boomX

/** Enlarged nozzle cutaway on its stand beside the tractor (world). */
export const NOZZLE_DEMO = { x: 1.2, y: 0.95, z: 2.1, scale: 8 }

export interface SprayParams {
  nozzles: number
  /** nozzle spacing, m */
  spacing: number
  kind: NozzleKind
  /** catalogue flow of one nozzle at 3 bar, L/min */
  q3: number
  /** relief-valve set pressure, bar */
  pSet: number
  /** forward speed, km/h */
  speed: number
  /** boom height above the ground, m */
  boomH: number
  ptoRpm: number
  sections: [boolean, boolean, boolean]
  spraying: boolean
  /** calibration test area, ha (0.1 in the notes) */
  calibArea: number
  /** required application rate, L/ha */
  target: number
  flows: boolean
}

export const DEFAULTS: SprayParams = {
  nozzles: 12,
  spacing: 0.5,
  kind: 'flat-fan',
  q3: 1.2,
  pSet: 3,
  speed: 6,
  boomH: 0.5,
  ptoRpm: 540,
  sections: [true, true, true],
  spraying: true,
  calibArea: 0.1,
  target: 200,
  flows: true,
}

interface Store extends SprayParams {
  set: (p: Partial<SprayParams>) => void
  reset: () => void
}

export const useSprayer = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS, sections: [true, true, true] }) }))

export const sprayAngle = (k: NozzleKind) => (k === 'flat-fan' ? (110 * Math.PI) / 180 : (80 * Math.PI) / 180)

/** Which section (0 right, 1 centre, 2 left) nozzle i belongs to. */
export const sectionOf = (i: number, n: number) => Math.min(2, Math.floor((i * 3) / n))

/** Lateral position of nozzle i (z, +left). */
export const nozzleZ = (i: number, n: number, s: number) => -(n * s) / 2 + s / 2 + i * s

export interface SprayState {
  W: number
  K: number
  nOpen: number
  Wopen: number
  pump: number
  p: number
  q: number
  Q: number
  bypass: number
  rate: number
  L: number
}

/** The spray circuit for the current settings. */
export function solveSpray(p: Pick<SprayParams, 'nozzles' | 'spacing' | 'q3' | 'pSet' | 'speed' | 'ptoRpm' | 'sections' | 'spraying' | 'calibArea'>): SprayState {
  const W = p.nozzles * p.spacing
  const K = nozzleK(p.q3, 3)
  let nOpen = 0
  for (let i = 0; i < p.nozzles; i++) if (p.spraying && p.sections[sectionOf(i, p.nozzles)]) nOpen++
  const pump = pumpFlowLmin(p.ptoRpm)
  const pr = nOpen > 0 ? linePressure(pump, K, nOpen, p.pSet) : p.pSet
  const q = nOpen > 0 ? K * Math.sqrt(pr) : 0
  const Q = nOpen * q
  const Wopen = nOpen * p.spacing
  return {
    W,
    K,
    nOpen,
    Wopen,
    pump,
    p: pr,
    q,
    Q,
    bypass: reliefBypass(pump, Q),
    rate: nOpen > 0 ? applicationRate(Q, Wopen, p.speed) : 0,
    L: testRunLength(W, p.calibArea),
  }
}

/* ------------------------------ live values ------------------------------ */

export interface LiveSpray {
  pressure: number
  bypass: number
  flow: number
  rate: number
  /** litres left in the tank */
  tank: number
  /** calibration run: distance travelled and litres used */
  runDist: number
  runUsed: number
  runActive: boolean
}

export const live: LiveSpray = { pressure: 0, bypass: 0, flow: 0, rate: 0, tank: 600, runDist: 0, runUsed: 0, runActive: false }

/** Start (or restart) a calibration run: refill to the mark and zero the counters. */
export function startCalibrationRun() {
  live.tank = LAYOUT.tank.capacity
  live.runDist = 0
  live.runUsed = 0
  live.runActive = true
}
