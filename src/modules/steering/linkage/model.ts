import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { ackermannOuter, knuckleFromDragLink, otherWheel, rodForToe, toeAB, toeForRod, trackRodNominal, turningRadii, type FrontAxle } from '@/physics/linkageControl'
import { TRACTOR } from '@/tractor/dims'
import { FRONT_Y, FRONT_Z, KINGPIN_Z } from '@/tractor/geometry'

export const C = {
  manual: [SRC.st510('p1–2 Fig 44 manual steering linkage')],
  toe: [SRC.st510('p5 Fig 47 toe-in')],
  box: [SRC.st510('p3–4 Fig 46 steering boxes')],
  care: [SRC.st510('p4 maintenance'), SRC.ma510('10 h / 50 h / 250 h service')],
  axle: [SRC.pt510('Fig 39b telescopic front axle, track-rod bolt')],
  fwd: [SRC.st510('p5–6 front-wheel drive')],
}

/** Front-axle geometry of the shared tractor (Ackermann trapezoid; arm sizes typical). */
export const AXLE: FrontAxle = { zk: KINGPIN_Z, arm: 0.16, beta: Math.atan(KINGPIN_Z / TRACTOR.wheelbase), wheelbase: TRACTOR.wheelbase }
/** Kingpin offset of the wheel centre outward of the kingpin, and the rim radius used for A/B. */
export const SCRUB = FRONT_Z - KINGPIN_Z
export const RIM_R = TRACTOR.front.rimRadius
/** inner rim flange inboard of the wheel centre plane */
export const RIM_INSET = 0.07

/** Steering box (worm/recirculating ball) on the +Z side below the column; drop arm swings ±30°. */
export const BOX = { x: 0.62, y: 0.94, z: 0.34, armZ: 0.45, dropArm: 0.24, ratio: 15 }
/** Steering arm on the +Z stub axle (pointing inward), and the track-rod arms (below the axle). */
export const ARMS = { steerY: FRONT_Y + 0.14, steerLen: 0.21, trackY: FRONT_Y - 0.06 }
export const KP_PLUS = { x: TRACTOR.wheelbase, y: ARMS.steerY, z: KINGPIN_Z }

export const ballAt = (alpha: number) => ({ x: BOX.x - BOX.dropArm * Math.sin(alpha), y: BOX.y - BOX.dropArm * Math.cos(alpha), z: BOX.armZ })

export interface SteerParams {
  /** steering-wheel angle, degrees (+ = turning toward −Z, i.e. left) */
  wheel: number
  /** track-rod adjustment from nominal, mm (+ = longer) */
  rodMM: number
  /** axle extended by this much in total (track-width change), mm */
  trackMM: number
  /** track rod reset (lengthened by the same amount) after the track change */
  rodReset: boolean
  /** exaggerate toe on screen */
  exaggerate: boolean
  /** sweep the steering wheel lock to lock automatically */
  sweep: boolean
}

export const DEFAULTS: SteerParams = { wheel: 0, rodMM: 1.7, trackMM: 0, rodReset: true, exaggerate: false, sweep: true }

interface Store extends SteerParams {
  set: (p: Partial<SteerParams>) => void
  reset: () => void
}
export const useSteer = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

const rad = (d: number) => (d * Math.PI) / 180

/** Effective axle and track-rod length for the parameters. */
export function axleFor(p: Pick<SteerParams, 'trackMM' | 'rodMM' | 'rodReset'>) {
  const ax: FrontAxle = { ...AXLE, zk: AXLE.zk + p.trackMM / 2000 }
  // a reset rod is lengthened with the axle; otherwise it keeps its old length
  const Lt = trackRodNominal(p.rodReset ? ax : AXLE) + p.rodMM / 1000
  return { ax, Lt, toe0: toeForRod(ax, Lt - trackRodNominal(ax)) }
}

export interface SteerState {
  alpha: number
  dPlus: number
  dMinus: number
  inner: number
  outer: number
  /** ideal Ackermann outer angle for this inner angle (tractor's ackermann()) */
  ideal: number
  A: number
  B: number
  radii: { rearMid: number; outerFront: number }
  toe0: number
  Lt: number
  dragLink: number
}

/** Solve the whole linkage for a steering-wheel angle. */
export function solveSteer(p: SteerParams): SteerState {
  const { ax, Lt, toe0 } = axleFor(p)
  const alpha = rad(p.wheel) / BOX.ratio
  // drag link set (on assembly) so the wheels are symmetric when the steering is centred
  const end0 = { x: KP_PLUS.x - ARMS.steerLen * Math.sin(toe0), y: KP_PLUS.y, z: KP_PLUS.z - ARMS.steerLen * Math.cos(toe0) }
  const b0 = ballAt(0)
  const dragLink = Math.hypot(end0.x - b0.x, end0.y - b0.y, end0.z - b0.z)
  const dPlus = knuckleFromDragLink(ballAt(alpha), dragLink, KP_PLUS, ARMS.steerLen).delta
  const dMinus = otherWheel(ax, dPlus, Lt)
  const turningLeft = dPlus + dMinus > 0
  const inner = turningLeft ? dMinus : dPlus
  const outer = turningLeft ? dPlus : dMinus
  const ideal = idealOuter(inner, ax)
  const ab = toeAB(2 * (ax.zk + SCRUB - RIM_INSET), RIM_R, dPlus, dMinus)
  return { alpha, dPlus, dMinus, inner, outer, ideal, A: ab.A, B: ab.B, radii: turningRadii(outer, ax, SCRUB), toe0, Lt, dragLink }
}

/** Ideal (Ackermann) outer angle for the same inner angle: cot δo − cot δi = t/l (beyond notes). */
export function idealOuter(inner: number, ax: FrontAxle = AXLE) {
  return ackermannOuter(inner, ax)
}

/** Track-rod adjustment (mm from nominal) that gives a toe-in B − A of `mm` at the rim. */
export function rodForToeMM(mm: number, ax: FrontAxle = AXLE) {
  return rodForToe(ax, RIM_R, mm / 1000) * 1000
}

export interface LiveSteer {
  s: SteerState | null
  /** steering-wheel angle actually shown (deg): the slider, or the sweep */
  wheel: number
  phase: number
}
export const live: LiveSteer = { s: null, wheel: 0, phase: 0 }

/** Toe-in band of AEE510 Fig 47: A is 3–6 mm less than B. */
export function toeVerdict(diffMM: number) {
  if (diffMM < 0) return { text: 'toe-out', tone: 'warn' as const }
  if (diffMM < 3) return { text: 'too little toe-in', tone: 'warn' as const }
  if (diffMM > 6) return { text: 'too much toe-in', tone: 'warn' as const }
  return { text: 'correct (3–6 mm)', tone: 'accent' as const }
}
