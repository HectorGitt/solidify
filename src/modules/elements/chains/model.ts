import * as THREE from 'three'
import { create } from 'zustand'
import { PITCH, chainSpeed, chordalVariation, designPower, drivenSpeed, pitchDiameter, speedRatio, strandRating, strandsNeeded, type PitchKey } from '@/physics/elements'
import { rollerChainDims } from '@/parts/lib/elements'
import { beltLoop, type BeltLoop } from '../_shared/loop'

const { PI, sin } = Math

export type Mode = 'drive' | 'planter'

export interface ChainParams {
  mode: Mode
  pitch: PitchKey
  z1: number
  z2: number
  /** strands drawn: 1 simplex, 2 duplex */
  strands: 1 | 2
  /** centre distance aimed for, in pitches (snapped to an even number of links) */
  cPitches: number
  rpm: number
  /* selection (Module 3) */
  rated: number
  sf: number
  outRpm: number
  /** simplex rating read from the chart (kW); NaN = not given */
  simplex: number
  /** planter: forward speed (km/h) */
  speed: number
}

export const DEFAULTS: ChainParams = {
  mode: 'drive',
  pitch: '3/4',
  z1: 17,
  z2: 57,
  strands: 2,
  cPitches: 40,
  rpm: 200,
  rated: 2,
  sf: 1.3,
  outRpm: 60,
  simplex: 2.5,
  speed: 6,
}

interface Store extends ChainParams {
  set: (p: Partial<ChainParams>) => void
  reset: () => void
}

export const useChains = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Roller-chain proportions from the pitch (close to ISO 606 B-series): the parts library's. */
export const chainDims = rollerChainDims

export const pitchRadius = (z: number, p: number) => pitchDiameter(z, p) / 2

/**
 * A chain loop round sprockets (pitch circles), with a material coordinate in which a pitch of
 * chain on a sprocket covers the angle 2π/z (the link is a chord, not an arc), so rollers spaced
 * one pitch apart sit exactly in the tooth seats.
 */
export interface ChainLoop {
  loop: BeltLoop
  /** material length M = N·p and link count */
  M: number
  links: number
  /** arc length ↔ material lookup */
  sArr: Float64Array
  mArr: Float64Array
  /** material coordinate where the chain arrives on each sprocket */
  mEntry: number[]
  /** the arc-entry angle on each sprocket */
  aEntry: number[]
}

function materialTable(loop: BeltLoop, zs: number[]) {
  const K = 1600
  const L = loop.length
  const sArr = new Float64Array(K + 1)
  const mArr = new Float64Array(K + 1)
  let m = 0
  for (let i = 0; i <= K; i++) {
    const s = (L * i) / K
    sArr[i] = s
    mArr[i] = m
    const g = loop.segs[loop.segAt(s + L / (2 * K))]
    const k = g.kind === 'arc' ? sin(PI / zs[g.pulley!]) / (PI / zs[g.pulley!]) : 1
    m += (L / K) * k
  }
  return { sArr, mArr, M: mArr[K] }
}

export function makeChainLoop(centres: [number, number][], zs: number[], p: number, senses?: (1 | -1)[]): ChainLoop {
  const loop = beltLoop(centres.map((c, i) => ({ c, r: pitchRadius(zs[i], p), s: senses?.[i] ?? 1 })))
  const t = materialTable(loop, zs)
  const mEntry: number[] = []
  const aEntry: number[] = []
  let m = 0
  for (const g of loop.segs) {
    if (g.kind === 'arc') {
      mEntry.push(m)
      aEntry.push(g.a0!)
      const z = zs[g.pulley!]
      m += (g.s1 - g.s0) * (sin(PI / z) / (PI / z))
    } else m += g.s1 - g.s0
  }
  return { loop, M: t.M, links: Math.round(t.M / p), sArr: t.sArr, mArr: t.mArr, mEntry, aEntry }
}

/**
 * Two-sprocket drive with the driven sprocket moved along the line of centres so the loop is a
 * whole, even number of links (as a real chain must be). Driver at `origin`, driven at angle `angle`.
 */
export function twoSprocketLoop(z1: number, z2: number, p: number, cPitches: number, origin?: [number, number], angle = 0): ChainLoop & { C: number; centres: [number, number][] } {
  const centres = (C: number): [number, number][] =>
    origin ? [origin, [origin[0] + C * Math.cos(angle), origin[1] + C * Math.sin(angle)]] : [[-C / 2, 0], [C / 2, 0]]
  const build = (C: number) => makeChainLoop(centres(C), [z1, z2], p)
  const C0 = cPitches * p
  const target = 2 * Math.round(build(C0).M / p / 2) * p
  let lo = (pitchRadius(z1, p) + pitchRadius(z2, p)) * 1.05
  let hi = C0 * 2 + 0.5
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (build(mid).M < target) lo = mid
    else hi = mid
  }
  const C = (lo + hi) / 2
  return { ...build(C), C, centres: centres(C) }
}

/** Arc length for a material coordinate. */
export function sAtMaterial(cl: ChainLoop, m: number) {
  const M = cl.M
  const mt = ((m % M) + M) % M
  let lo = 0
  let hi = cl.mArr.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cl.mArr[mid] <= mt) lo = mid
    else hi = mid
  }
  const f = (mt - cl.mArr[lo]) / Math.max(1e-12, cl.mArr[hi] - cl.mArr[lo])
  return cl.sArr[lo] + f * (cl.sArr[hi] - cl.sArr[lo])
}

/** Roller centres for a chain displacement m0 (material coordinate of roller 0). */
export function rollerPositions(cl: ChainLoop, m0: number, out: THREE.Vector3[]) {
  const p = cl.M / cl.links
  for (let j = 0; j < cl.links; j++) {
    if (!out[j]) out[j] = new THREE.Vector3()
    cl.loop.pointAt(sAtMaterial(cl, m0 + j * p), out[j])
  }
  return out
}

/** Sprocket angle so a tooth seat meets every roller (seat 0 of `sprocket()` lies on +X). */
export function sprocketAngle(cl: ChainLoop, i: number, z: number, m0: number) {
  const p = cl.M / cl.links
  const sense = cl.loop.pulleys[i].s
  return cl.aEntry[i] + sense * ((m0 - cl.mEntry[i]) / p) * ((2 * PI) / z)
}

/* ------------------------------ selection (Module 3) ------------------------------ */

export function select(p: ChainParams) {
  const design = designPower(p.rated, p.sf)
  const ratio = speedRatio(p.rpm, p.outRpm)
  const out = drivenSpeed(p.rpm, p.z1, p.z2)
  const duplex = strandRating(p.simplex, 2)
  const strands = Number.isFinite(p.simplex) ? strandsNeeded(design, p.simplex) : null
  const pm = PITCH[p.pitch]
  return {
    design,
    ratio,
    toothRatio: p.z2 / p.z1,
    out,
    duplex,
    strands,
    v: chainSpeed(p.z1, pm, p.rpm),
    variation: chordalVariation(p.z1),
    D1: pitchDiameter(p.z1, pm),
    D2: pitchDiameter(p.z2, pm),
  }
}

/* ------------------------------ planter train (beyond notes: representative sizes) ------------------------------ */

export const PLANTER = {
  wheelR: 0.2,
  /** press-wheel sprocket → lay shaft; lay shaft → seed meter */
  zWheel: 12,
  zLayIn: 24,
  zLayOut: 12,
  zMeter: 18,
  pitch: PITCH['1/2'],
  /** loop A rises from the press-wheel axle; loop B runs on to the seed meter (directions, pitches) */
  angleA: (78 * Math.PI) / 180,
  pitchesA: 30,
  angleB: (12 * Math.PI) / 180,
  pitchesB: 24,
  cells: 16,
}

/** Seed-plate turns per press-wheel turn and the resulting seed spacing (m). */
export function planterTrain(speedKmh: number) {
  const r1 = PLANTER.zWheel / PLANTER.zLayIn
  const r2 = PLANTER.zLayOut / PLANTER.zMeter
  const meterPerWheel = r1 * r2
  const wheelRpm = ((speedKmh / 3.6) / (2 * PI * PLANTER.wheelR)) * 60
  return { meterPerWheel, wheelRpm, layRpm: wheelRpm * r1, meterRpm: wheelRpm * meterPerWheel, spacing: (2 * PI * PLANTER.wheelR) / (meterPerWheel * PLANTER.cells) }
}

export const live = { m0: 0, rpm2: 0, v: 0, links: 0, C: 0 }
