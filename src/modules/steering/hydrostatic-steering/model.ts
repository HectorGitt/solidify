import { create } from 'zustand'
import { cite } from '@/content/citations'
import { TRACTOR } from '@/tractor/dims'

/** Tractor Steering .pdf (AEE510), PDF p1–6 = book pp90–95. */
export const ST = (where: string) => cite('AEE510', 'Tractor Steering .pdf', where)

const { PI } = Math
export const deg = (r: number) => (r * 180) / PI
export const rad = (d: number) => (d * PI) / 180

/**
 * Front axle and steering, plan view in X–Z. Frame: origin on the ground under the front-axle
 * centre, +X forward, +Z to the tractor's left, Y up (shared tractor convention).
 * Front tyre and track from the shared tractor dims; arm and cylinder sizes are typical.
 */
export const AX = {
  wheelbase: TRACTOR.wheelbase,
  wheelR: TRACTOR.front.radius,
  wheelW: TRACTOR.front.width,
  rimR: TRACTOR.front.rimRadius,
  /** wheel centre z (half track) */
  wheelZ: TRACTOR.front.track / 2,
  /** kingpin z */
  kpZ: TRACTOR.front.track / 2 - 0.09,
  y: TRACTOR.front.radius,
  /** steering-arm length */
  arm: 0.16,
  /** lock angle of the inner wheel */
  lock: rad(38),
}

/** Ackermann arm angle: arm lines meet on the rear-axle centre (beyond notes). */
export const BETA = Math.atan2(AX.kpZ, AX.wheelbase)

type V = { x: number; z: number }

/** Rotate a plan-view vector about Y by +δ (δ > 0 = steer left; the wheel front swings to +Z). */
function rot(v: V, d: number): V {
  return { x: v.x * Math.cos(d) - v.z * Math.sin(d), z: v.x * Math.sin(d) + v.z * Math.cos(d) }
}

/** Arm-end (track-rod ball) position for each side at steer angle δ. */
export function armEnd(side: 1 | -1, d: number, frac = 1): V {
  const v = rot({ x: -AX.arm * frac * Math.cos(BETA), z: -side * AX.arm * frac * Math.sin(BETA) }, d)
  return { x: v.x, z: side * AX.kpZ + v.z }
}

export const TRACK_ROD = 2 * (AX.kpZ - AX.arm * Math.sin(BETA))

/** Right-wheel angle that keeps the track-rod length when the left wheel is at δL (Newton). */
export function rightAngle(dL: number) {
  const P = armEnd(1, dL)
  let d = dL
  for (let i = 0; i < 30; i++) {
    const f = (dd: number) => {
      const Q = armEnd(-1, dd)
      return Math.hypot(P.x - Q.x, P.z - Q.z) - TRACK_ROD
    }
    const h = 1e-6
    const fd = (f(d + h) - f(d - h)) / (2 * h)
    const step = f(d) / fd
    d -= step
    if (Math.abs(step) < 1e-12) break
  }
  return d
}

/** Ideal Ackermann outer angle for an inner angle: cot δo − cot δi = t/L (beyond notes). */
export function ackermannOuter(inner: number, t = 2 * AX.kpZ, L = AX.wheelbase) {
  if (Math.abs(inner) < 1e-9) return 0
  const s = Math.sign(inner)
  return s * Math.atan(1 / (1 / Math.tan(Math.abs(inner)) + t / L))
}

/** Turning radius to the outside front wheel (beyond notes): R = L/sin δo + (wheel offset). */
export function turningRadius(outer: number) {
  return Math.abs(outer) < 1e-6 ? Infinity : AX.wheelbase / Math.sin(Math.abs(outer)) + (AX.wheelZ - AX.kpZ)
}

/* ------------------------------ steering cylinder ------------------------------ */

const CYL_FRAC = 0.7
export const CYL = {
  bore: 0.05,
  rod: 0.025,
  /** cap-end pivot on the axle beam */
  anchor: { x: -AX.arm * Math.cos(BETA) * CYL_FRAC, z: -0.02 },
  /** rod attaches part-way along the LEFT steering arm */
  frac: CYL_FRAC,
  y: AX.y + 0.075,
}

export const A_CAP = (PI / 4) * CYL.bore ** 2
export const A_ANN = A_CAP - (PI / 4) * CYL.rod ** 2

/** Cylinder pin-to-pin length for a left-wheel angle. */
export function cylLength(dL: number) {
  const P = armEnd(1, dL, CYL.frac)
  return Math.hypot(P.x - CYL.anchor.x, P.z - CYL.anchor.z)
}

/** Left-wheel angle for a cylinder length (bisection; length falls as δL increases). */
export function angleForLength(len: number) {
  let lo = -AX.lock * 1.3
  let hi = AX.lock * 1.3
  const fLo = cylLength(lo) - len
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const f = cylLength(mid) - len
    if (Math.sign(f) === Math.sign(fLo)) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Left-wheel limits: inner lock on a left turn, outer angle when the right wheel is at lock. */
function leftLimits() {
  let lo = -AX.lock
  for (let i = 0; i < 50; i++) {
    // find δL < 0 with right wheel at −lock
    if (rightAngle(lo) < -AX.lock) lo += 0.002
    else break
  }
  return { min: lo, max: AX.lock }
}
export const LEFT = leftLimits()
export const L_AT_LEFT_LOCK = cylLength(LEFT.max)
export const L_AT_RIGHT_LOCK = cylLength(LEFT.min)
export const STROKE = L_AT_RIGHT_LOCK - L_AT_LEFT_LOCK

/**
 * Hydrostatic steering: the metering unit sends D cm³ per steering-wheel revolution to the
 * cylinder. Turning left retracts the rod (oil to the annulus); turning right extends it.
 * Turns lock-to-lock = V_retract/D + … (both sides of a single-rod cylinder).
 */
export function turnsLockToLock(Dcm3: number) {
  return (STROKE * A_ANN * 1e6) / Dcm3 / 2 + (STROKE * A_CAP * 1e6) / Dcm3 / 2
}

/* ------------------------------ gerotor (metering unit) ------------------------------ */

export const GEROTOR = { lobes: 7, Rp: 0.034, roller: 0.0085, e: 0.0042, width: 0.016 }

/**
 * Rotor profile (N − 1 teeth) as the inner envelope of the stator rollers seen from the rotor.
 * Rotor centre at e(cos ψ, sin ψ), rotor spin φ = −ψ/(N − 1); roller k at Rp(cos 2πk/N, …).
 */
export function rotorProfile(n = 360) {
  const { lobes: N, Rp, roller: rr, e } = GEROTOR
  const Q = (psi: number) => {
    const a = psi / (N - 1)
    const px = Rp - e * Math.cos(psi)
    const py = -e * Math.sin(psi)
    return { x: px * Math.cos(a) - py * Math.sin(a), y: px * Math.sin(a) + py * Math.cos(a) }
  }
  const pts: { x: number; y: number }[] = []
  const T = 2 * PI * (N - 1)
  for (let i = 0; i < n; i++) {
    const psi = (T * i) / n
    const p = Q(psi)
    const h = 1e-5
    const a = Q(psi - h)
    const b = Q(psi + h)
    let nx = -(b.y - a.y)
    let ny = b.x - a.x
    const l = Math.hypot(nx, ny)
    nx /= l
    ny /= l
    if (nx * p.x + ny * p.y > 0) {
      nx = -nx
      ny = -ny
    }
    pts.push({ x: p.x + rr * nx, y: p.y + rr * ny })
  }
  return pts
}

/** Gerotor pose for a steering-wheel angle (rad): rotor spins with the wheel, its centre orbits 6× as fast the other way. */
export function gerotorPose(wheel: number) {
  const psi = -(GEROTOR.lobes - 1) * wheel
  return { spin: wheel, cx: GEROTOR.e * Math.cos(psi), cy: GEROTOR.e * Math.sin(psi) }
}

/* ------------------------------ parameters ------------------------------ */

export type Variant = 'hydrostatic' | 'assisted'

export interface SteerParams {
  variant: Variant
  /** steering-wheel target angle, degrees (+ = left) */
  wheel: number
  /** sweep lock to lock automatically */
  auto: boolean
  engineOn: boolean
  /** metering-unit displacement, cm³/rev */
  D: number
  /** pump flow, L/min */
  Q: number
  /** manual box ratio for the power-assisted variant */
  ratio: number
  /** toe-in A − B, mm; exaggerated in the view when `showToe` is on */
  toe: number
  showToe: boolean
  flows: boolean
}

export const DEFAULTS: SteerParams = { variant: 'hydrostatic', wheel: 0, auto: true, engineOn: true, D: 80, Q: 18, ratio: 20, toe: 4.5, showToe: false, flows: true }

interface Store extends SteerParams {
  set: (p: Partial<SteerParams>) => void
  reset: () => void
}

export const useSteer = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Toe angle per wheel for a toe-in (A − B) measured across the rims at hub height. */
export function toeAngle(toeMm: number) {
  return Math.atan(toeMm / 1000 / 2 / (2 * AX.rimR))
}

export interface LiveSteer {
  /** actual steering-wheel angle, deg */
  wheel: number
  left: number
  right: number
  cylLen: number
  /** flow to the cylinder, L/min (+ = left turn) */
  qCyl: number
  /** pump flow returned to tank through the open-centre valve, L/min */
  qTank: number
  atLock: boolean
  blocked: boolean
}

export const live: LiveSteer = { wheel: 0, left: 0, right: 0, cylLen: cylLength(0), qCyl: 0, qTank: 0, atLock: false, blocked: false }
