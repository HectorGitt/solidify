import * as THREE from 'three'
import { create } from 'zustand'
import { hookeAcceleration, hookeOutputAngle, hookeVelocityRatio, rad, rpmToRad } from '@/physics/joints'
import { crossQuaternion, drivenPin, shaftAngleFor, yawQuat } from '../shared/cardan'

/**
 * Single Hooke's joint on a test rig: driving shaft along +X into the joint at the origin,
 * driven shaft leaving at the shaft angle δ in the horizontal (XZ) plane.
 * θ = 0 when the driving yoke's pins lie in the plane of the two shafts.
 */
export const RIG = {
  /** shaft axis height above the bearing feet */
  drop: 0.15,
  /** bearing centre distance from the joint centre */
  bearingAt: 0.3,
  shaftLen: 0.46,
  /** index discs (driver and driven) */
  discAt: 0.405,
  discR: 0.075,
}

export interface HookeParams {
  /** shaft angle δ, degrees */
  delta: number
  /** driver speed, rpm */
  rpm: number
  /** driven rotating mass for the inertia-torque working */
  weight: number
  /** radius of gyration, m */
  k: number
  /** driver angle used in the inertia-torque working, degrees */
  thetaProbe: number
}

export const DEFAULTS: HookeParams = { delta: 20, rpm: 1000, weight: 147, k: 0.25, thetaProbe: 45 }

interface Store extends HookeParams {
  set: (p: Partial<HookeParams>) => void
  reset: () => void
}

export const useHooke = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/* ------------------------------ live values (3D → panel) ------------------------------ */

export interface LiveHooke {
  /** driver angle, degrees 0…360 */
  theta: number
  /** driven angle, degrees 0…360 (from the 3D geometry) */
  thetaB: number
  /** θ_B − θ, degrees */
  lag: number
  ratio: number
  omegaB: number
  alphaB: number
  /** inertia torque I·α_B on the driven mass, N·m */
  torque: number
}

export const live: LiveHooke = { theta: 0, thetaB: 0, lag: 0, ratio: 1, omegaB: 0, alphaB: 0, torque: 0 }

/* ------------------------------ joint geometry → member orientations ------------------------------ */

const Z = new THREE.Vector3(0, 0, 1)
const Y = new THREE.Vector3(0, 1, 0)
const X = new THREE.Vector3(1, 0, 0)

export interface JointPose {
  /** driving pin direction (world) */
  u1: THREE.Vector3
  /** driven pin direction (world) */
  u2: THREE.Vector3
  /** driven shaft axis */
  a2: THREE.Vector3
  cross: THREE.Quaternion
  /** driven shaft rotation about its own axis (rad); π at θ = 0 */
  phi: number
}

/**
 * Pose of every member for driver angle θ and shaft angle δ (both rad). Solved from the
 * geometry: the cross's arms stay at right angles, one arm on each yoke's pin axis.
 */
export function jointPose(theta: number, delta: number, out?: JointPose): JointPose {
  const p = out ?? { u1: new THREE.Vector3(), u2: new THREE.Vector3(), a2: new THREE.Vector3(), cross: new THREE.Quaternion(), phi: 0 }
  const base = yawQuat(delta)
  p.a2.copy(X).applyQuaternion(base)
  p.u1.copy(Z).applyAxisAngle(X, theta)
  drivenPin(p.a2, p.u1, p.u2)
  crossQuaternion(p.u1, p.u2, p.cross)
  p.phi = shaftAngleFor(base, Y, p.u2)
  return p
}

/** Formula values for the panel at driver angle θ (rad). */
export function formulaAt(theta: number, p: Pick<HookeParams, 'delta' | 'rpm'>) {
  const d = rad(p.delta)
  return {
    ratio: hookeVelocityRatio(d, theta),
    omegaB: p.rpm * hookeVelocityRatio(d, theta),
    alphaB: hookeAcceleration(d, theta, rpmToRad(p.rpm)),
    thetaB: hookeOutputAngle(d, theta),
  }
}

/** Curves over one driver revolution for the charts. */
export function curves(p: Pick<HookeParams, 'delta' | 'rpm'>, n = 181) {
  const xs: number[] = []
  const ratio: number[] = []
  const acc: number[] = []
  const lag: number[] = []
  const d = rad(p.delta)
  const w = rpmToRad(p.rpm)
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 * Math.PI
    xs.push((t * 180) / Math.PI)
    ratio.push(hookeVelocityRatio(d, t))
    acc.push(hookeAcceleration(d, t, w))
    lag.push(((hookeOutputAngle(d, t) - t) * 180) / Math.PI)
  }
  return { xs, ratio, acc, lag }
}

/** 2017/18 marking-scheme Q4(d) answers (δ = 20°, 1000 rpm, θ = 10°…90°). */
export const GUIDE_TABLE = [1060, 1048, 1030, 1009, 987, 968, 953, 943, 940]
/** The guide's second joint at 15° with ω_B = 1060 rpm as its steady input (table 2 i). */
export const GUIDE_SECOND = [1095, 1088, 1078, 1066, 1053, 1041, 1032, 1026, 1024]
