import { create } from 'zustand'
import { axialForceUniformPressure, clutchTorque, coneClutchTorque, frictionPairs, frictionRadius, powerFromTorque, type ClutchTheory } from '@/physics/clutch'
import { bandTensions, coneFaceWidth, coneNormalForce, heatGenerated, selfLockingArm, shoeLeverForce, shoeNormalForce, simpleBandLever } from '@/physics/elements'

const { PI, acos, atan2, hypot } = Math
export const rad = (d: number) => (d * PI) / 180
export const deg = (r: number) => (r * 180) / PI

export type Mode = 'disc' | 'cone' | 'shoe' | 'band'

export interface CBParams {
  mode: Mode
  /** clutch engagement 0 (released) … 1 (fully engaged) */
  engage: number
  rpm: number
  /* multiple-disc clutch (Fig 14-1, MG16 Q5d) */
  nSteel: number
  nBronze: number
  Ro: number
  Ri: number
  fd: number
  /** average pressure, Pa */
  p: number
  theory: ClutchTheory
  /* cone clutch */
  F: number
  fc: number
  alpha: number
  cRo: number
  cRi: number
  /* single shoe brake (Fig 15-10) */
  T: number
  fs: number
  R: number
  a: number
  b: number
  c: number
  dir: 'cw' | 'ccw'
  /* band brake (Fig 15-7) */
  Tb: number
  fb: number
  wrap: number
  rb: number
  la: number
  lb: number
}

export const DEFAULTS: CBParams = {
  mode: 'disc',
  engage: 1,
  rpm: 300,
  nSteel: 5,
  nBronze: 4,
  Ro: 0.035,
  Ri: 0.025,
  fd: 0.1,
  p: 350e3,
  theory: 'pressure',
  F: 1500,
  fc: 0.3,
  alpha: rad(12.5),
  cRo: 0.06,
  cRi: 0.05,
  T: 225,
  fs: 0.3,
  R: 0.36,
  a: 0.36,
  b: 0.9,
  c: 0.04,
  dir: 'cw',
  Tb: 170,
  fb: 0.2,
  wrap: rad(280),
  rb: 0.225,
  la: 0.08,
  lb: 0.5,
}

interface Store extends CBParams {
  set: (p: Partial<CBParams>) => void
  reset: () => void
}
export const useCB = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export function discResult(p: CBParams) {
  const n = frictionPairs(p.nSteel, p.nBronze)
  const F = axialForceUniformPressure(p.p, p.Ro, p.Ri)
  const Rf = frictionRadius(p.Ro, p.Ri, p.theory)
  const T = clutchTorque(F, p.fd, Rf, n)
  // uniform wear: p = F/(2π r (Ro − Ri)) — max at Ri, min at Ro
  const pMax = F / (2 * PI * p.Ri * (p.Ro - p.Ri))
  const pMin = F / (2 * PI * p.Ro * (p.Ro - p.Ri))
  return { n, F, Rf, T, P: powerFromTorque(T, p.rpm), pMax, pMin, pAvg: F / (PI * (p.Ro ** 2 - p.Ri ** 2)) }
}

export function coneResult(p: CBParams) {
  const T = coneClutchTorque(p.F, p.fc, p.alpha, p.cRo, p.cRi, p.theory)
  return { T, Fn: coneNormalForce(p.F, p.alpha), b: coneFaceWidth(p.cRo, p.cRi, p.alpha), Rf: frictionRadius(p.cRo, p.cRi, p.theory), P: powerFromTorque(T, p.rpm) }
}

export function shoeResult(p: CBParams) {
  const N = shoeNormalForce(p.T, p.fs, p.R)
  const sense = p.dir === 'cw' ? 'aiding' : 'opposing'
  const F = shoeLeverForce(N, p.fs, p.a, p.b, p.c, sense)
  const V = (2 * PI * p.rpm * p.R) / 60
  return { N, fN: p.fs * N, F, selfLock: selfLockingArm(p.a, p.fs), locks: p.dir === 'cw' && F <= 0, V, Hg: heatGenerated(p.fs, N, V) }
}

export function bandResult(p: CBParams) {
  const t = bandTensions(p.Tb, p.rb, p.fb, p.wrap)
  const V = (2 * PI * p.rpm * p.rb) / 60
  return { ...t, F: simpleBandLever(t.F2, p.la, p.lb), V, Hg: (t.F1 - t.F2) * V }
}

/**
 * Band-brake layout: lever horizontal at depth h below the drum centre, fixed pivot O (tight end)
 * at x = −la/2, slack end A at x = +la/2. h is solved so the band wraps exactly `wrap`.
 * Returns the tangent-point angles (band runs O → left tangent → over the top → right tangent → A).
 */
export function bandLayout(r: number, wrap: number, la: number) {
  const gapFor = (h: number) => {
    const O = [-la / 2, -h]
    const A = [la / 2, -h]
    const tl = atan2(O[1], O[0]) - acos(r / hypot(O[0], O[1]))
    const tr = atan2(A[1], A[0]) + acos(r / hypot(A[0], A[1]))
    return { gap: tr - tl, tl, tr }
  }
  // gap grows with h (towards 180°) — bisection
  let lo = Math.sqrt(Math.max(0, r * r - (la * la) / 4)) + 1e-6
  let hi = r * 20
  const target = 2 * PI - wrap
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (gapFor(mid).gap < target) lo = mid
    else hi = mid
  }
  const h = (lo + hi) / 2
  return { h, ...gapFor(h) }
}

export const live = { drum: 0, driven: 0, omegaD: 0 }
