import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { RECOMMENDED_SAG, sagFromSlack, slackFromSag, strandTension, tensionState, type TensionState } from '@/physics/tyres'

export const TT = (where: string) => SRC.tt510(where)

/**
 * One crawler undercarriage (side view in XY, +X forward, Y up, track width along Z).
 * The notes give the parts but no dimensions; these are typical of a 50–60 kW crawler
 * (marked beyond the notes in the part cards). Lengths in metres.
 */
export const DIM = {
  /** chain pitch (bushing to bushing) */
  pitch: 0.171,
  /** hunting-tooth sprocket: odd tooth count, every other tooth drives a bushing */
  teeth: 25,
  /** link height (pitch line at mid-height): rails run on the rollers 0.05 m inside the pitch line */
  rail: 0.05,
  linkT: 0.03,
  /** half the distance between the two link rails (centre of the inner plates' outer faces) */
  gauge: 0.12,
  bushingR: 0.03,
  bushingIn: 0.022,
  pinR: 0.0205,
  shoeW: 0.4,
  plateT: 0.014,
  idlerR: 0.33,
  rollerR: 0.09,
  carrierR: 0.075,
  /** bottom strand pitch line above the ground (grouser tips at y = 0) */
  yb: 0.1,
  xs: -1.25,
  xiDesign: 1.25,
  xc: -0.02,
  rollersX: [-0.8, -0.4, 0, 0.4, 0.8],
  /** track weight per metre for the strand tension (≈160 kg/m) */
  wPerM: 160 * 9.81,
}

/** Sprocket radius for the 3D path: arc between bushings = p, i.e. the seat spacing 4π/z equals p/R. */
export const RS = (DIM.pitch * DIM.teeth) / (4 * Math.PI)
export const YS = DIM.yb + RS
export const YI = DIM.yb + DIM.idlerR
/** carrier roller centre, set so its rail contact is a little above the line of the strand */
export const YC = 0.79 - DIM.rail - DIM.carrierR
export const RAIL_Y = DIM.yb + DIM.rail
export const ROLLER_Y = RAIL_Y + DIM.rollerR

export type { ChainType, ShoeType } from '@/parts/lib/wheels'
import type { ChainType, ShoeType } from '@/parts/lib/wheels'
export type Misalign = 'aligned' | 'yaw' | 'offset' | 'tilt'

export const SHOES: Record<ShoeType, { label: string; text: string }> = {
  standard: { label: 'Standard grouser', text: 'Widely used on dozer and drawbar machines; good service in most conditions — clay, silt, loam and gravel.' },
  open: { label: 'Open-centre', text: 'A grouser shoe with openings so mud squeezes out instead of building up.' },
  snow: { label: 'Snow', text: 'Similar slots stop snow and ice packing into the track.' },
  multi: { label: 'Multi-grouser', text: 'All-purpose: small, low grousers make the track more manoeuvrable, with self-cleaning openings. Good on hard smooth surfaces and in mud; common on loaders.' },
  rubber: { label: 'Rubber', text: 'For floors and smooth surfaces that steel tracks would damage; wearing life is fairly short.' },
}

export const MISALIGN: Record<Misalign, { label: string; text: string }> = {
  aligned: { label: 'Aligned', text: 'Sprocket, rollers and idler in one plane: equal clearance at both idler flanges.' },
  yaw: { label: 'Not aligned', text: 'Idler not aligned with rollers and sprocket: the idler ridge, links and rollers wear rapidly. Align by removing shims on one side.' },
  offset: { label: 'Not centred', text: 'Idler not centred: wear on one side only; less clearance appears on that side.' },
  tilt: { label: 'Not vertical', text: 'Idler not aligned vertically: it leans, loading one flange and one rail.' },
}

export interface TrackParams {
  /** travel speed, km/h */
  speed: number
  /** idler travel from the 1-in-sag setting, mm (+ = tighter: grease in) */
  adjust: number
  shoe: ShoeType
  chain: ChainType
  misalign: Misalign
  /** machine weight for the ground-pressure working, t */
  mass: number
}

export const DEFAULTS: TrackParams = { speed: 2.5, adjust: 0, shoe: 'standard', chain: 'interlocking', misalign: 'aligned', mass: 8 }

interface Store extends TrackParams {
  set: (p: Partial<TrackParams>) => void
  reset: () => void
}

export const useTracks = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/* ------------------------------ Track path ------------------------------ */

type V = { x: number; y: number }

function upperTangent(O: V, r: number, P: V, side: 'left' | 'right') {
  const dx = P.x - O.x
  const dy = P.y - O.y
  const d = Math.hypot(dx, dy)
  const beta = Math.atan2(dy, dx)
  const alpha = Math.acos(Math.min(1, r / d))
  const a = side === 'left' ? beta + alpha : beta - alpha
  return { a, p: { x: O.x + r * Math.cos(a), y: O.y + r * Math.sin(a) } }
}

const wrap = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

/** Straight-strand geometry for an idler position. */
export function baseGeometry(xi: number) {
  const S = { x: DIM.xs, y: YS }
  const I = { x: xi, y: YI }
  const C = { x: DIM.xc, y: YC + DIM.carrierR + DIM.rail }
  const ts = upperTangent(S, RS, C, 'left')
  const ti = upperTangent(I, DIM.idlerR, C, 'right')
  const sweepS = wrap(-Math.PI / 2 - ts.a)
  const sweepI = wrap(ti.a + Math.PI / 2)
  const s1 = Math.hypot(C.x - ts.p.x, C.y - ts.p.y)
  const s2 = Math.hypot(ti.p.x - C.x, ti.p.y - C.y)
  const bottom = xi - DIM.xs
  const L0 = bottom + RS * sweepS + s1 + s2 + DIM.idlerR * sweepI
  return { S, I, C, ts, ti, sweepS, sweepI, s1, s2, bottom, L0 }
}

/** Total slack needed for a sag δ at mid-span between carrier roller and idler (equal tension: slack ∝ s³). */
function slackForFrontSag(b: ReturnType<typeof baseGeometry>, sag: number) {
  return slackFromSag(b.s2, sag) * ((b.s1 ** 3 + b.s2 ** 3) / b.s2 ** 3)
}

/** Links in the chain and the idler position giving exactly 1 in of sag (TT p52, Fig 11). */
export const CHAIN = (() => {
  const target = (xi: number) => {
    const b = baseGeometry(xi)
    return b.L0 + slackForFrontSag(b, RECOMMENDED_SAG)
  }
  const links = Math.round(target(DIM.xiDesign) / DIM.pitch)
  const L = links * DIM.pitch
  let lo = DIM.xiDesign - 0.3
  let hi = DIM.xiDesign + 0.3
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (target(mid) < L) lo = mid
    else hi = mid
  }
  return { links, length: L, xi0: (lo + hi) / 2 }
})()

export interface TrackState {
  /** idler centre x actually reached (limited when the chain is drawn tight) */
  xi: number
  /** recoil-spring compression when the adjuster pushes against a tight chain, m */
  springComp: number
  slack: number
  sag1: number
  sag2: number
  tension: number
  state: TensionState
  geo: ReturnType<typeof baseGeometry>
}

/** Track state for an idler adjustment (mm, + = tighter). */
export function trackState(adjustMm: number): TrackState {
  const want = CHAIN.xi0 + adjustMm / 1000
  let xi = want
  let b = baseGeometry(xi)
  let slack = CHAIN.length - b.L0
  let springComp = 0
  if (slack < 0) {
    let lo = want - 0.2
    let hi = want
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2
      if (CHAIN.length - baseGeometry(mid).L0 > 0) lo = mid
      else hi = mid
    }
    xi = lo
    b = baseGeometry(xi)
    springComp = want - xi
    slack = Math.max(0, CHAIN.length - b.L0)
  }
  const k3 = b.s1 ** 3 + b.s2 ** 3
  const sag1 = sagFromSlack(b.s1, (slack * b.s1 ** 3) / k3)
  const sag2 = sagFromSlack(b.s2, (slack * b.s2 ** 3) / k3)
  const tension = strandTension(DIM.wPerM, b.s2, sag2)
  return { xi, springComp, slack, sag1, sag2, tension, state: springComp > 0 ? 'too tight' : tensionState(sag2), geo: b }
}

/**
 * The closed pitch-line path (clockwise seen from +Z: bottom strand runs aft, top strand forward).
 * `whip` scales the sag of the top spans (loose track at speed). Returns a point sampler by
 * arc length s ∈ [0, L).
 */
export function trackPath(t: TrackState, whip = 1) {
  const b = t.geo
  const segs: { len: number; at: (u: number, out: V) => void }[] = []
  // 1 bottom strand, idler → sprocket
  segs.push({ len: b.bottom, at: (u, o) => ((o.x = t.xi - u), (o.y = DIM.yb)) })
  // 2 round the sprocket
  segs.push({ len: RS * b.sweepS, at: (u, o) => {
    const a = -Math.PI / 2 - u / RS
    o.x = b.S.x + RS * Math.cos(a)
    o.y = b.S.y + RS * Math.sin(a)
  } })
  // 3, 4 sagging top spans
  const total = CHAIN.length - (b.bottom + RS * b.sweepS + DIM.idlerR * b.sweepI)
  const k3 = b.s1 ** 3 + b.s2 ** 3
  // each span is its chord plus its share of the slack (slack ∝ s³ at equal tension)
  const L1 = b.s1 + ((total - b.s1 - b.s2) * b.s1 ** 3) / k3
  const L2 = total - L1
  const span = (A: V, B: V, len: number, sag: number) => ({
    len,
    at: (u: number, o: V) => {
      const f = Math.min(1, Math.max(0, u / len))
      o.x = A.x + (B.x - A.x) * f
      o.y = A.y + (B.y - A.y) * f - 4 * sag * whip * f * (1 - f)
    },
  })
  segs.push(span(b.ts.p, b.C, L1, t.sag1))
  segs.push(span(b.C, b.ti.p, L2, t.sag2))
  // 5 round the idler, down to the bottom
  segs.push({ len: DIM.idlerR * b.sweepI, at: (u, o) => {
    const a = b.ti.a - u / DIM.idlerR
    o.x = t.xi + DIM.idlerR * Math.cos(a)
    o.y = YI + DIM.idlerR * Math.sin(a)
  } })
  const L = segs.reduce((s, g) => s + g.len, 0)
  return {
    length: L,
    /** where each segment starts (s) — the sprocket arc starts at segStart[1] */
    segStart: segs.map((_, i) => segs.slice(0, i).reduce((s, g) => s + g.len, 0)),
    at(s: number, out: V) {
      let u = ((s % L) + L) % L
      for (const g of segs) {
        if (u <= g.len) return g.at(u, out)
        u -= g.len
      }
      segs[segs.length - 1].at(segs[segs.length - 1].len, out)
    },
  }
}

/* ------------------------------ Live values ------------------------------ */

export const live = {
  /** chain travel, m (machine frame) */
  travel: 0,
  sprocketRev: 0,
  toothEngaged: true,
  whip: 1,
}
