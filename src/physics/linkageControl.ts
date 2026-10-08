/**
 * Three-point linkage statics, draft/position control, the tractor–implement PTO driveline and
 * the manual steering linkage. Pure functions in SI units (m, N, rad, s).
 *
 * Sources: Macmillan Ch. 6 (virtual hitch point, Fig 6.5; AEE502 Hitching notes); AEE510
 * Tractor Hydraulic System pp3–7 (draft control Fig 41, position control, linkage Fig 42);
 * AEE510 Transmission of Power p4 (PTO drive shaft Fig A2.7, BS 1495 hitch rule) and Tractor
 * Transmission System p10 (PTO standards, guarding); AEE510 Tractor Steering pp1–5 (manual
 * linkage Fig 44, toe-in Fig 47). Where the notes give no equation (virtual work, the control
 * loop, Ackermann, turning circle) the function says so.
 */
import { hookeAngle, hookeSpeedRatio } from '@/core/drive'
import { DEFAULT_LINKAGE, solveLinkage, type LinkageGeom, type LinkagePose, type P2 } from '@/tractor/linkage'

const { PI, sin, cos, tan, atan2, hypot, max, min, abs } = Math

/* ================================ 1. three-point linkage ================================ */

/** The shared linkage with a different top-link (turnbuckle) length and/or implement mast height. */
export function linkageWith(top: number, mast = DEFAULT_LINKAGE.mast, g: LinkageGeom = DEFAULT_LINKAGE): LinkageGeom {
  return { ...g, top, mast }
}

/**
 * Implement (hitch) frame → tractor side view. Hitch frame: origin at the lower hitch point L,
 * +Y up the mast, −X rearward — the frame <Tractor mounted> uses.
 */
export function hitchToWorld(pose: LinkagePose, p: P2): P2 {
  const c = cos(pose.mastTilt)
  const s = sin(pose.mastTilt)
  return { x: pose.L.x + p.x * c + p.y * s, y: pose.L.y - p.x * s + p.y * c }
}

export function worldToHitch(pose: LinkagePose, p: P2): P2 {
  const c = cos(pose.mastTilt)
  const s = sin(pose.mastTilt)
  const dx = p.x - pose.L.x
  const dy = p.y - pose.L.y
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

/** Unit vector of a soil force on the implement: rearward, θ below the horizontal (Macmillan's S). */
export const soilDir = (theta: number): P2 => ({ x: -cos(theta), y: -sin(theta) })

/** Height of the line of action of S (through P, θ below horizontal, pointing rearward) at x. */
export function draftLineY(P: P2, theta: number, x: number) {
  return P.y + (x - P.x) * tan(theta)
}

/** Moment (about +Z, anticlockwise seen from +Z) of force F at P about point O. */
export const momentAbout = (O: P2, P: P2, F: P2) => (P.x - O.x) * F.y - (P.y - O.y) * F.x

export interface VCheck {
  /** height of the draft line above V at V's x position (m); + = line passes above V */
  e: number
  /** moment of a unit S about V, m (+ = anticlockwise from +Z) */
  arm: number
  /** true when the soil force turns the implement into the soil about V */
  pullIn: boolean
}

/**
 * Macmillan Fig 6.5: the implement turns about the virtual hitch point V (instantaneous centre).
 * With V ahead of the soil force, a draft line passing ABOVE V pulls the implement in; through V
 * is free-link equilibrium. Returns null when the links are parallel (V at infinity).
 */
export function draftAboutV(V: P2 | null, P: P2, theta: number): VCheck | null {
  if (!V) return null
  const e = draftLineY(P, theta, V.x) - V.y
  const arm = momentAbout(V, P, soilDir(theta))
  // rotation +ω about V moves points behind V downward: pull-in when arm·(V.x − P.x) > 0
  return { e, arm, pullIn: arm * (V.x - P.x) > 0 }
}

export interface LoadOnImplement {
  /** application point in the hitch frame */
  at: P2
  /** force, N, in the tractor side view (x forward, y up) */
  F: P2
}

/**
 * Generalised force on the linkage's one degree of freedom (lower-link angle φ, + = hitch
 * lower), by virtual work: Q = Σ F·dP/dφ. Q > 0 drives the implement down (into the soil).
 * Equivalent to the moment about V (the instantaneous centre) — beyond the notes.
 */
export function generalisedForce(phi: number, g: LinkageGeom, loads: LoadOnImplement[], h = 1e-5) {
  const a = solveLinkage(phi - h, g)
  const b = solveLinkage(phi + h, g)
  let Q = 0
  for (const l of loads) {
    const pa = hitchToWorld(a, l.at)
    const pb = hitchToWorld(b, l.at)
    Q += (l.F.x * (pb.x - pa.x) + l.F.y * (pb.y - pa.y)) / (2 * h)
  }
  return Q
}

/**
 * Total lift-rod tension (both rods) that holds the implement with the lift arms locked
 * (restrained working, Fig 6.5c). Virtual work: Q δφ = T δℓ with ℓ = |D − E(φ)|. Beyond notes.
 */
export function liftRodTension(phi: number, g: LinkageGeom, loads: LoadOnImplement[], h = 1e-5) {
  const p = solveLinkage(phi, g)
  const Q = generalisedForce(phi, g, loads, h)
  const ell = (q: number) => {
    const s = solveLinkage(q, g)
    return hypot(p.D.x - s.E.x, p.D.y - s.E.y)
  }
  const dl = (ell(phi + h) - ell(phi - h)) / (2 * h)
  return abs(dl) < 1e-9 ? 0 : Q / dl
}

/**
 * Top-link force from the moments about the lower hitch point (the top link is a two-force
 * member). + = compression — the draft-control signal of AEE510 Fig 41.
 */
export function topLinkForce(pose: LinkagePose, g: LinkageGeom, loads: LoadOnImplement[]) {
  let M = 0
  for (const l of loads) M += momentAbout(pose.L, hitchToWorld(pose, l.at), l.F)
  const ux = pose.U.x - g.B.x
  const uy = pose.U.y - g.B.y
  const n = hypot(ux, uy)
  // compression C pushes the mast top away from B: force C·(U − B)/|U − B|
  const k = momentAbout(pose.L, pose.U, { x: ux / n, y: uy / n })
  return abs(k) < 1e-9 ? 0 : -M / k
}

/** Bisection for a root of f on [a, b] (f(a), f(b) of opposite sign), else null. */
export function bisect(f: (x: number) => number, a: number, b: number, iters = 60): number | null {
  let fa = f(a)
  const fb = f(b)
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) return null
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2
    const fm = f(m)
    if (fa * fm <= 0) b = m
    else {
      a = m
      fa = fm
    }
  }
  return (a + b) / 2
}

/* ============================ 2. draft and position control ============================ */

/**
 * Specific soil resistance along the field (N per m² of furrow section), varying with x so the
 * draft changes while ploughing. Typical 30–90 kPa (beyond notes); `v` 0…1 sets the variation.
 */
export function soilResistance(x: number, k0: number, v: number) {
  const wave = 0.42 * sin((2 * PI * x) / 13) + 0.2 * sin((2 * PI * x) / 4.3 + 1.1)
  const pan = 0.75 * Math.exp(-(((x - 27) / 2.6) ** 2)) - 0.45 * Math.exp(-(((x - 45) / 3) ** 2))
  // a compacted strip (old wheeling) with sharp edges
  const strip = x > 35 && x < 39 ? 0.6 : 0
  return k0 * max(0.25, 1 + v * (wave + pan + strip))
}

/** Plough draft D = k·w·d (specific resistance × furrow cross-section). Beyond notes. */
export const ploughDraft = (k: number, width: number, depth: number) => k * width * max(0, depth)

/** The tractor–implement "plant" seen by the hydraulic controller. */
export interface DraftPlant {
  /** working depth (m) for a lower-hitch height h */
  depth(h: number): number
  /** top-link compression (N) at hitch height h with draft D */
  compression(h: number, D: number): number
  hMin: number
  hMax: number
}

export type ControlMode = 'draft' | 'position'

export interface ControlParams {
  mode: ControlMode
  /** draft control: top-link compression the sensing spring is set to hold, N */
  setC: number
  /** position control: lower-hitch height set by the lever, m */
  setH: number
  /** response knob 0 (slow) … 1 (fast) */
  response: number
  /** mean specific soil resistance, N/m² */
  k0: number
  /** soil variability 0…1 */
  variability: number
  /** forward speed, m/s */
  speed: number
  /** total plough width, m */
  width: number
  /** field length simulated, m */
  length: number
  /** hitch height when the run starts (dropped into work), m */
  h0: number
}

/** Valve gain for the response knob (m/s of hitch per N of error); log scale. Beyond notes. */
export const draftGain = (response: number) => 2.5e-5 * Math.pow(30, response)
/** Sensing (spring/dashpot) lag, s. */
export const SENSE_TAU = 0.2
/** Fastest hitch movement at full pump flow, m/s. */
export const HITCH_VMAX = 0.16

export interface ControlTrace {
  x: number[]
  t: number[]
  h: number[]
  depth: number[]
  draft: number[]
  comp: number[]
  k: number[]
  /** hitch rate commanded by the valve, m/s (+ = lifting) */
  rate: number[]
}

/**
 * Closed-loop run along the field (AEE510 Fig 41). Draft control: the top-link compression,
 * felt through a heavy spring, moves the control-valve spool; too much draft lifts the
 * implement, too little lowers it, so the draft stays near the setting. Position control: the
 * valve follows the lift-arm position only, so depth stays fixed and the draft follows the soil.
 * The valve is modelled as a proportional, rate-limited spool (beyond notes).
 */
export function simulateControl(p: ControlParams, plant: DraftPlant, dt = 0.02, every = 2): ControlTrace {
  const tr: ControlTrace = { x: [], t: [], h: [], depth: [], draft: [], comp: [], k: [], rate: [] }
  let h = p.h0
  let x = 0
  let t = 0
  let sensed = p.mode === 'draft' ? p.setC : 0
  const Kv = draftGain(p.response)
  const Kp = 1 + 7 * p.response
  const vmax = HITCH_VMAX * (0.35 + 0.65 * p.response)
  let i = 0
  while (x <= p.length + 1e-9) {
    const k = soilResistance(x, p.k0, p.variability)
    const d = plant.depth(h)
    const D = ploughDraft(k, p.width, d)
    const C = plant.compression(h, D)
    sensed += ((C - sensed) * dt) / SENSE_TAU
    let rate: number
    if (p.mode === 'draft') {
      const err = sensed - p.setC
      rate = abs(err) < 60 ? 0 : max(-vmax, min(vmax, Kv * err))
    } else {
      const err = h - p.setH
      rate = abs(err) < 0.001 ? 0 : max(-vmax, min(vmax, -Kp * err))
    }
    if (i % every === 0) {
      tr.x.push(x)
      tr.t.push(t)
      tr.h.push(h)
      tr.depth.push(d)
      tr.draft.push(D)
      tr.comp.push(C)
      tr.k.push(k)
      tr.rate.push(rate)
    }
    h = max(plant.hMin, min(plant.hMax, h + rate * dt))
    x += p.speed * dt
    t += dt
    i++
  }
  return tr
}

/** Linear interpolation of a trace column at field position x. */
export function traceAt(tr: ControlTrace, col: keyof ControlTrace, x: number) {
  const xs = tr.x
  const ys = tr[col]
  if (xs.length === 0) return 0
  if (x <= xs[0]) return ys[0]
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
  const dx = xs[1] - xs[0]
  const i = min(xs.length - 2, Math.floor((x - xs[0]) / dx))
  const u = (x - xs[i]) / (xs[i + 1] - xs[i])
  return ys[i] + (ys[i + 1] - ys[i]) * u
}

/** Mean and range (max − min) of a series between x0 and x1. */
export function seriesStats(xs: number[], ys: number[], x0 = -Infinity, x1 = Infinity) {
  let s = 0
  let n = 0
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] < x0 || xs[i] > x1) continue
    s += ys[i]
    n++
    lo = min(lo, ys[i])
    hi = max(hi, ys[i])
  }
  return { mean: n ? s / n : 0, range: n ? hi - lo : 0, lo, hi }
}

/* ============================== 3. PTO drive shaft (Fig A2.7) ============================== */

/** PTO standards, AEE510 Tractor Transmission System p10. */
export const PTO_STANDARDS = {
  '540': { rpm: 540, splines: 6, diameter: 0.035, label: '540 rpm · 6 splines · Ø35 mm (1⅜ in)' },
  '1000': { rpm: 1000, splines: 21, diameter: 0.044, label: '1000 rpm · 21 splines · Ø44 mm (1¾ in)' },
} as const
export type PtoStd = keyof typeof PTO_STANDARDS

/** Angle between two 2-D directions (0…π). */
export function angleBetween(a: P2, b: P2) {
  return abs(atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y))
}

/**
 * Plan view of a trailed PTO machine turning (articulation γ about the drawbar pin): front
 * joint b1 ahead of the pin on the tractor axis, rear joint b2 behind it on the implement axis.
 * BS 1495 (Culpin p4): with the pin midway (b1 = b2) both joint angles are γ/2.
 */
export function trailedJoints(b1: number, b2: number, gamma: number) {
  const J1 = { x: b1, y: 0 }
  const J2 = { x: -b2 * cos(gamma), y: -b2 * sin(gamma) }
  const s = { x: J2.x - J1.x, y: J2.y - J1.y }
  const length = hypot(s.x, s.y)
  const beta1 = angleBetween({ x: -1, y: 0 }, s)
  const beta2 = angleBetween(s, { x: -cos(gamma), y: -sin(gamma) })
  return { J1, J2, length, beta1, beta2 }
}

/**
 * Two Hooke's joints in series (AEE502 Hooke's joint notes; Culpin p4–5): output angle and
 * speed ratios for input angle θ. `phaseError` is the twist between the intermediate-shaft
 * yokes (0 = yokes in line). Equal angles with yokes in line give uniform output.
 */
export function doubleHooke(theta: number, beta1: number, beta2: number, phaseError = 0) {
  const mid = hookeAngle(theta, beta1)
  const rMid = hookeSpeedRatio(theta, beta1)
  const ph = PI / 2 + phaseError
  const out = hookeAngle(mid - ph, beta2) + ph
  const rOut = hookeSpeedRatio(mid - ph, beta2) * rMid
  return { mid, out, rMid, rOut }
}

/** Range of the output-speed ratio over one revolution. */
export function doubleHookeRange(beta1: number, beta2: number, phaseError = 0, n = 720) {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < n; i++) {
    const r = doubleHooke((2 * PI * i) / n, beta1, beta2, phaseError).rOut
    lo = min(lo, r)
    hi = max(hi, r)
  }
  return { lo, hi }
}

/** Length of string (or clothing) a shaft of diameter D wraps up in one second at N rpm: πDN/60. */
export const wrapPerSecond = (D: number, rpm: number) => (PI * D * rpm) / 60

/* =============================== 4. manual steering linkage =============================== */

/**
 * Plan geometry of the front axle (x forward, z lateral; kingpins at z = ±zk). Track-rod arms
 * point rearward and inward by `beta` (Ackermann trapezoid); a knuckle angle δ about +Y turns
 * the wheel's front toward −Z for δ > 0.
 */
export interface FrontAxle {
  /** half kingpin spacing */
  zk: number
  /** track-rod arm length */
  arm: number
  /** inward slope of the track-rod arms from the rearward direction */
  beta: number
  /** wheelbase (for Ackermann and turning circle) */
  wheelbase: number
}

/** Track-rod ball positions (x, z) for knuckle angles δ+ (+Z side) and δ− (−Z side). */
export function trackRodEnds(ax: FrontAxle, dPlus: number, dMinus: number) {
  const { zk, arm: a, beta: b } = ax
  return {
    plus: { x: -a * cos(b - dPlus), z: zk + a * sin(dPlus - b) },
    minus: { x: -a * cos(b + dMinus), z: -zk + a * sin(dMinus + b) },
  }
}

/** Track-rod length that gives zero toe at straight ahead. */
export function trackRodNominal(ax: FrontAxle) {
  return 2 * (ax.zk - ax.arm * sin(ax.beta))
}

/** Knuckle angle of the −Z wheel for a +Z angle δ+ and track-rod length Lt (branch nearest δ+). */
export function otherWheel(ax: FrontAxle, dPlus: number, Lt: number) {
  const f = (dm: number) => {
    const e = trackRodEnds(ax, dPlus, dm)
    return hypot(e.plus.x - e.minus.x, e.plus.z - e.minus.z) - Lt
  }
  let best: number | null = null
  const n = 160
  let a = dPlus - 0.9
  let fa = f(a)
  for (let i = 1; i <= n; i++) {
    const b = dPlus - 0.9 + (1.8 * i) / n
    const fb = f(b)
    if (fa * fb <= 0) {
      const r = bisect(f, a, b, 50)
      if (r !== null && (best === null || abs(r - dPlus) < abs(best - dPlus))) best = r
    }
    a = b
    fa = fb
  }
  return best ?? dPlus
}

/** Symmetric toe angle ε (+ = toe-in) for a track-rod length change ΔL (rear track rod). */
export function toeForRod(ax: FrontAxle, dL: number) {
  const L = trackRodNominal(ax) + dL
  const f = (e: number) => {
    const t = trackRodEnds(ax, e, -e)
    return t.plus.z - t.minus.z - L
  }
  return bisect(f, -0.6, 0.6) ?? 0
}

/**
 * Toe-in check of AEE510 Fig 47: rim-to-rim distances at hub height in front (A) and behind (B)
 * the axle, measured at radius r from the wheel centres. Toe-in when A < B (by 3–6 mm).
 */
export function toeAB(trackAtHub: number, r: number, dPlus: number, dMinus: number) {
  // +Z wheel: front rim point moves by −r·sinδ+ in z; −Z wheel by −r·sinδ−
  const A = trackAtHub - r * sin(dPlus) + r * sin(dMinus)
  const B = trackAtHub + r * sin(dPlus) - r * sin(dMinus)
  return { A, B, diff: B - A }
}

/** ΔL of the track rod for a wanted toe-in B − A (m), by bisection. */
export function rodForToe(ax: FrontAxle, r: number, diff: number) {
  return bisect((dL) => toeAB(0, r, toeForRod(ax, dL), -toeForRod(ax, dL)).diff - diff, -0.05, 0.05) ?? 0
}

/** Ideal Ackermann outer angle for an inner angle (cot δo − cot δi = t/l). Beyond notes. */
export function ackermannOuter(inner: number, ax: FrontAxle) {
  if (abs(inner) < 1e-9) return 0
  const s = Math.sign(inner)
  return s * Math.atan(1 / (1 / tan(abs(inner)) + (2 * ax.zk) / ax.wheelbase))
}

/**
 * Turning radii from the outer-wheel angle (beyond notes): rear-axle centre path and the
 * outer front wheel's path (kingpin offset `scrub` outward of the kingpin).
 */
export function turningRadii(outer: number, ax: FrontAxle, scrub = 0) {
  const o = abs(outer)
  if (o < 1e-6) return { rearMid: Infinity, outerFront: Infinity }
  const rearMid = ax.wheelbase / tan(o) - ax.zk
  const outerFront = ax.wheelbase / sin(o) + scrub
  return { rearMid, outerFront }
}

/**
 * Knuckle angle δ that a drag link of length `link` gives for a drop-arm ball at `ball`, when the
 * steering arm (length s, at height y above the kingpin base, pointing inward along −Z at δ = 0)
 * is on the +Z kingpin at (xk, zk). 3-D: drop arm swings in the X–Y plane; arm end moves in X–Z.
 */
export function knuckleFromDragLink(ball: { x: number; y: number; z: number }, link: number, kp: { x: number; y: number; z: number }, s: number) {
  const armEnd = (d: number) => ({ x: kp.x - s * sin(d), y: kp.y, z: kp.z - s * cos(d) })
  const f = (d: number) => {
    const e = armEnd(d)
    return hypot(e.x - ball.x, e.y - ball.y, e.z - ball.z) - link
  }
  const d = bisect(f, -1.0, 1.0) ?? 0
  return { delta: d, end: armEnd(d) }
}
