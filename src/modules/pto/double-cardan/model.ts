import * as THREE from 'three'
import { create } from 'zustand'
import { DriveGraph, hookeJoint } from '@/core/drive'
import { doubleHooke, hitchJointAngles, rad, rpmToRad, secondJointPhase, type DoubleJointSpec } from '@/physics/joints'
import { yawQuat } from '../shared/cardan'

/**
 * Two Hooke's joints joined by a telescopic intermediate shaft. Frame: input shaft along +X
 * into joint 1 at the origin; the intermediate shaft bends δ₁ in the horizontal (XZ) plane;
 * joint 2 bends δ₂ in a plane twisted γ about the intermediate shaft.
 */
export const RIG = {
  drop: 0.15,
  /** joint-centre distance along the intermediate shaft */
  L: 0.5,
  inBearing: 0.28,
  outBearing: 0.2,
  outLen: 0.32,
  discR: 0.07,
}

export type Arrangement = 'W' | 'Z'
export type Mode = 'rig' | 'turn'

export interface DCParams {
  mode: Mode
  /** degrees */
  delta1: number
  delta2: number
  equal: boolean
  /** twist of the intermediate shaft's second yoke relative to its first, degrees (0 = in line) */
  phase: number
  /** twist of joint 2's plane about the intermediate shaft, degrees (0 = one plane) */
  twist: number
  arrangement: Arrangement
  rpm: number
  /** turning tractor: implement angle ψ (deg) and hitch position a/(a+b) */
  psi: number
  hitch: number
}

export const DEFAULTS: DCParams = { mode: 'rig', delta1: 20, delta2: 20, equal: true, phase: 0, twist: 0, arrangement: 'W', rpm: 1000, psi: 40, hitch: 0.5 }

interface Store extends DCParams {
  set: (p: Partial<DCParams>) => void
  reset: () => void
}

export const useDC = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) =>
    set((s) => {
      const n = { ...s, ...p }
      if (n.equal && n.mode === 'rig') {
        if (p.delta2 !== undefined && p.delta1 === undefined) n.delta1 = n.delta2
        else n.delta2 = n.delta1
      }
      return n
    }),
  reset: () => set(DEFAULTS),
}))

/** Total PTO-to-implement joint spacing used for the turning layout (m). */
export const TURN_SPAN = 0.8

/** The joint spec actually in force (turning mode derives δ₁, δ₂ from the hitch geometry). */
export function effectiveSpec(p: DCParams): DoubleJointSpec & { arrangement: Arrangement } {
  if (p.mode === 'turn') {
    const a = TURN_SPAN * p.hitch
    const h = hitchJointAngles(a, TURN_SPAN - a, rad(p.psi))
    return { delta1: h.delta1, delta2: h.delta2, phase: 0, twist: 0, arrangement: 'W' }
  }
  return { delta1: rad(p.delta1), delta2: rad(p.delta2), phase: rad(p.phase), twist: rad(p.twist), arrangement: p.arrangement }
}

/* ------------------------------ frames ------------------------------ */

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

export interface Frames {
  /** intermediate-shaft base orientation (local X → a₁) */
  b1: THREE.Quaternion
  a1: THREE.Vector3
  /** output base orientation (local X → a₂, local −Y → reference pin of joint 2's output) */
  b2: THREE.Quaternion
  a2: THREE.Vector3
  /** joint-2 centre */
  j2: THREE.Vector3
}

export function frames(spec: DoubleJointSpec & { arrangement: Arrangement }, L = RIG.L): Frames {
  const b1 = yawQuat(spec.delta1)
  const a1 = X.clone().applyQuaternion(b1)
  const twistQ = new THREE.Quaternion().setFromAxisAngle(X, spec.twist ?? 0)
  const q = b1.clone().multiply(twistQ)
  const n2 = Y.clone().applyQuaternion(q)
  const m2 = Z.clone().applyQuaternion(q)
  const sign = spec.arrangement === 'W' ? 1 : -1
  const a2 = a1.clone().applyAxisAngle(n2, sign * spec.delta2)
  const ref = a2.clone().cross(m2).normalize()
  const yAxis = ref.clone().negate()
  const zAxis = a2.clone().cross(yAxis)
  const b2 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a2, yAxis, zAxis))
  return { b1, a1, b2, a2, j2: a1.clone().multiplyScalar(L) }
}

/** Body rotations for the 3D: input θ, intermediate θ_C, output (joint-2 output angle). */
export interface Angles {
  theta: number
  thetaC: number
  thetaOut2: number
}

/** Pin directions implied by the body rotations (for the crosses). */
export function pins(f: Frames, a: Angles, phase: number) {
  const u0 = Z.clone().applyAxisAngle(X, a.theta)
  const u1 = Y.clone().negate().applyAxisAngle(X, a.thetaC).applyQuaternion(f.b1)
  const u2 = Y.clone().negate().applyAxisAngle(X, a.thetaC + phase).applyQuaternion(f.b1)
  const u3 = Y.clone().negate().applyAxisAngle(X, a.thetaOut2).applyQuaternion(f.b2)
  return { u0, u1, u2, u3 }
}

/**
 * Drive graph: motor → input, Hooke's joint 1 → intermediate, Hooke's joint 2 → output.
 * The parameter getter is read every step, so sliders act immediately.
 */
export function makeGraph(get: () => DoubleJointSpec) {
  const g = new DriveGraph()
  g.body('in')
  g.body('mid')
  g.body('out')
  g.addMap(hookeJoint('j1', 'in', 'mid', () => get().delta1))
  // the second joint's phase depends on the live yoke phase and plane twist, so rebuild its map
  g.addMap({
    id: 'j2',
    outputs: ['out'],
    apply(graph) {
      const s = get()
      hookeJoint('j2', 'mid', 'out', () => s.delta2, secondJointPhase(s)).apply(graph)
    },
  })
  return g
}

/** θ_out2 (output body angle from joint 2's reference) from the graph's output angle. */
export const outBodyAngle = (graphOut: number, spec: DoubleJointSpec) => graphOut - secondJointPhase(spec)

/* ------------------------------ live (3D → panel) ------------------------------ */

export interface LiveDC {
  theta: number
  ratioC: number
  ratio: number
  omegaC: number
  omegaOut: number
  /** output angle − input angle, degrees */
  lag: number
}

export const live: LiveDC = { theta: 0, ratioC: 1, ratio: 1, omegaC: 0, omegaOut: 0, lag: 0 }

/** Curves over one input revolution. */
export function curves(spec: DoubleJointSpec, n = 181) {
  const xs: number[] = []
  const c: number[] = []
  const o: number[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 * Math.PI
    const d = doubleHooke(spec, t)
    xs.push((t * 180) / Math.PI)
    c.push(d.ratioC)
    o.push(d.ratio)
  }
  return { xs, c, o }
}

export const toRad = rpmToRad

/** 2017/18 marking scheme Q4(d), second joint at 15°: each ω_B taken as a steady input (tables 2 i–v). */
export const GUIDE_SECOND: [number, number[]][] = [
  [1060, [1095, 1088, 1078, 1066, 1053, 1041, 1032, 1026, 1024]],
  [1048, [1083, 1076, 1066, 1054, 1041, 1030, 1020, 1014, 1012]],
  [1030, [1064, 1057, 1048, 1036, 1023, 1012, 1003, 997, 995]],
  [1009, [1042, 1036, 1026, 1014, 1002, 991, 982, 977, 975]],
  [987, [1020, 1013, 1004, 992, 981, 970, 961, 955, 953]],
]
