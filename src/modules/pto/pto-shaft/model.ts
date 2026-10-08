import * as THREE from 'three'
import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { hitchToWorld, type PtoStd } from '@/physics/linkageControl'
import { TRACTOR } from '@/tractor/dims'
import { phiForHitchHeight, solveLinkage } from '@/tractor/linkage'

export const C = {
  shaft: [SRC.top510('p4 Fig A2.7 PTO drive shaft')],
  uj: [SRC.top510('p4–5 universal joints, BS 1495'), SRC.hj502('velocity ratio')],
  std: [SRC.tts510('p10 PTO standards'), SRC.pto502('540 rpm 6-spline')],
  guard: [SRC.tts510('p10 guarding, 114 kg'), SRC.pto502('shields; 7 ft of string in 1 s')],
}

export type HitchMode = 'mounted' | 'trailed'

export interface PtoShaftParams {
  mode: HitchMode
  /** lower hitch height (mounted), m */
  hitch: number
  /** articulation angle in a turn (trailed), degrees */
  gamma: number
  /** implement joint behind the drawbar pin (trailed), m */
  b2: number
  std: PtoStd
  /** twist between the intermediate-shaft yokes, degrees (0 = in line) */
  phaseErr: number
  guards: boolean
}

export const DEFAULTS: PtoShaftParams = { mode: 'mounted', hitch: 0.45, gamma: 0, b2: 0.2, std: '540', phaseErr: 0, guards: true }

interface Store extends PtoShaftParams {
  set: (p: Partial<PtoShaftParams>) => void
  reset: () => void
}
export const usePtoShaft = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Front joint centre, just behind the 540 rpm stub end (TRACTOR.pto.x). */
export const J1 = new THREE.Vector3(TRACTOR.pto.x - 0.1, TRACTOR.pto.y, 0)
export const PIN = new THREE.Vector3(TRACTOR.drawbar.x, TRACTOR.drawbar.y, 0)
/** Tractor-side distance b1 from the front joint to the drawbar pin. */
export const B1 = J1.x - PIN.x
/** Mower gearbox input joint in the hitch frame. */
export const MOWER_J2 = { x: -0.55, y: 0.12 }
/** yoke + hub length at each end before the telescopic tubes start */
export const END = 0.11

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export interface DrivelineGeom {
  J2: THREE.Vector3
  /** unit axes: tractor PTO (toward J1), shaft J1→J2, implement input (from J2 into the implement) */
  aIn: THREE.Vector3
  aMid: THREE.Vector3
  aOut: THREE.Vector3
  length: number
  beta1: number
  beta2: number
  /** hitch-frame pose for the mounted implement */
  mastTilt: number
  L: { x: number; y: number }
}

export function driveline(p: Pick<PtoShaftParams, 'mode' | 'hitch' | 'gamma' | 'b2'>): DrivelineGeom {
  const aIn = v(-1, 0, 0)
  let J2: THREE.Vector3
  let aOut: THREE.Vector3
  let mastTilt = 0
  let L = { x: 0, y: 0 }
  if (p.mode === 'mounted') {
    const lk = solveLinkage(phiForHitchHeight(p.hitch))
    const w = hitchToWorld(lk, MOWER_J2)
    J2 = v(w.x, w.y, 0)
    aOut = v(-Math.cos(lk.mastTilt), Math.sin(lk.mastTilt), 0)
    mastTilt = lk.mastTilt
    L = lk.L
  } else {
    const g = (p.gamma * Math.PI) / 180
    aOut = v(-1, 0, 0).applyAxisAngle(v(0, 1, 0), g)
    J2 = PIN.clone().add(v(0, J1.y - PIN.y, 0)).addScaledVector(aOut, p.b2)
  }
  const s = J2.clone().sub(J1)
  const length = s.length()
  const aMid = s.normalize()
  return { J2, aIn, aMid, aOut, length, beta1: aIn.angleTo(aMid), beta2: aMid.angleTo(aOut), mastTilt, L }
}

/** Telescopic tubes "cut to suit" the implement: each 62 % of the straight free length. */
export function tubeLengths(p: Pick<PtoShaftParams, 'mode' | 'b2'>) {
  const straight = p.mode === 'mounted' ? driveline({ mode: 'mounted', hitch: 0.45, gamma: 0, b2: p.b2 }).length : B1 + p.b2
  const free = straight - 2 * END
  return { outer: 0.62 * free, inner: 0.62 * free }
}

/** Tube overlap for a shaft length (m); negative = the tubes have pulled apart. */
export function overlap(p: Pick<PtoShaftParams, 'mode' | 'b2'>, length: number) {
  const t = tubeLengths(p)
  return t.outer + t.inner - (length - 2 * END)
}

export interface LivePto {
  theta: number
  nIn: number
  nMid: number
  nOut: number
  beta1: number
  beta2: number
  length: number
  overlap: number
}
export const live: LivePto = { theta: 0, nIn: 0, nMid: 0, nOut: 0, beta1: 0, beta2: 0, length: 0, overlap: 0 }
