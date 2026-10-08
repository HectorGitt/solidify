/**
 * Chassis mechanics: centre of gravity, weight transfer, hitching and instability.
 * Source: Macmillan Ch. 6 (65851_Macmillan.pdf, also Hitching and Mechanics of Tractor
 * Chassis-1.docx), eqs 6.1–6.35. Forces in N, lengths in m, angles in radians.
 *
 * Symbols follow the notes: x wheelbase; xr, xf CG distance from rear/front axle; yg CG height
 * above the rear axle; r rear rolling radius; x' rear contact point to drawbar (horizontal);
 * y' drawbar height; α slope; θ angle of pull P below the horizontal.
 */

export interface Chassis {
  /** total weight, N */
  W: number
  /** wheelbase */
  x: number
  /** CG ahead of rear axle */
  xr: number
  /** CG height above rear axle */
  yg: number
  /** rear rolling radius */
  r: number
  /** drawbar: horizontal distance behind rear contact point */
  xd: number
  /** drawbar height above ground */
  yd: number
}

const g = 9.81

/** Farmland tractor, Macmillan App. II. */
export const FARMLAND: Chassis = { W: 2850 * g, x: 1.88, xr: 0.54, yg: 0.13, r: 0.635, xd: 0.6, yd: 0.45 }

export const staticFront = (c: Chassis) => (c.W * c.xr) / c.x
export const staticRear = (c: Chassis) => c.W - staticFront(c)

/** Eq 6.1: xr = Wf·x/W. */
export function cgFromFrontWeight(Wf: number, W: number, x: number) {
  return (Wf * x) / W
}

/**
 * Eqs 6.4–6.5: dynamic axle loads uphill (α ≥ 0 up a slope) with pull P at angle θ below
 * horizontal at the drawbar. Instability (rear overturn) when Vf ≤ 0.
 */
export function dynamicLoads(c: Chassis, P: number, theta = 0, alpha = 0) {
  const Wf = staticFront(c) * Math.cos(alpha)
  const Wr = staticRear(c) * Math.cos(alpha)
  const slopeT = (c.W * Math.sin(alpha) * (c.r + c.yg)) / c.x
  const Vf = Wf - slopeT - (P * Math.cos(theta) * c.yd) / c.x - (P * Math.sin(theta) * c.xd) / c.x
  const Vr = Wr + slopeT + (P * Math.cos(theta) * c.yd) / c.x + (P * Math.sin(theta) * (c.x + c.xd)) / c.x
  return { Vf, Vr, Wf, Wr, transfer: Wf - Vf, unstable: Vf <= 0 }
}

/** Simple level-ground weight transfer used in the exam papers: ΔW = P·h/L. */
export function simpleTransfer(P: number, h: number, L: number) {
  return (P * h) / L
}

/** Eq 6.8: gross tractive coefficient needed. */
export function requiredPsi(c: Chassis, P: number, theta: number, alpha: number, rho: number) {
  const { Vr } = dynamicLoads(c, P, theta, alpha)
  return (c.W * Math.sin(alpha) + P * Math.cos(theta) + rho * (c.W * Math.cos(alpha) + P * Math.sin(theta))) / Vr
}

/** Eqs 6.9–6.10: steepest slope the tractor can climb / descend (rear-wheel drive). */
export function maxSlopes(c: Chassis, psi: number, rho: number) {
  const xf = c.x - c.xr
  const up = Math.atan((psi * xf - rho * c.x) / (c.x - psi * (c.r + c.yg)))
  const down = Math.atan((psi * xf + rho * c.x) / (c.x + psi * (c.r + c.yg)))
  return { up, down }
}

/** tan αs = xr/(r + yg): static rear-overturn slope (≈40°, tan 0.6–0.8). */
export function staticOverturnTan(c: Chassis) {
  return c.xr / (c.r + c.yg)
}

/** Eq 6.35: ψ' at impending instability, h = y'/(r + yg). */
export function instabilityPsi(tanAlpha: number, tanAlphaS: number, h: number) {
  return tanAlpha + (tanAlphaS - tanAlpha) / h
}

/** Problem 6.16: drawbar height that tips the tractor before the soil shears. */
export function tippingDrawbarHeight(W: number, xr: number, A: number, cPa: number, phi: number) {
  return (W * xr) / (A * cPa + W * Math.tan(phi))
}

/* --------------------------- hitch comparison (Figs 6.10–6.12) --------------------------- */

export interface SoilForce {
  /** soil force magnitude, N */
  S: number
  /** angle below horizontal */
  theta: number
  /** horizontal distance of the soil-force point behind the drawbar/hitch */
  b: number
  /** vertical offset of the soil force below the hitch (depth) */
  z: number
  /** implement wheel distance behind the hitch (semi-mounted) */
  a: number
}

export type HitchKind = 'trailed' | 'semi' | 'mounted'

/** Eqs 6.11–6.16: rear and front axle loads for the three hitches under the same soil force. */
export function hitchLoads(c: Chassis, s: SoilForce, kind: HitchKind) {
  const Wf = staticFront(c)
  const Wr = staticRear(c)
  const { S, theta, a, b, z } = s
  const { x, xd: xp, yd: yp } = c
  const sh = S * Math.cos(theta)
  const sv = S * Math.sin(theta)
  let Vr: number
  if (kind === 'trailed') {
    Vr = Wr + (sh * yp) / x
  } else if (kind === 'semi') {
    Vr = Wr + (sv * (a - b) * (x + xp)) / (a * x) + (sh * (a * yp + (z + yp) * (x + xp))) / (a * x)
  } else {
    Vr = Wr + (sv * (x + xp + b)) / x - (sh * z) / x
  }
  let Vf: number
  if (kind === 'mounted') Vf = Wf - (sv * (xp + b)) / x + (sh * z) / x
  else if (kind === 'trailed') Vf = Wf - (sh * yp) / x
  else Vf = Wf - (sv * (a - b) * xp) / (a * x) - (sh * (a * yp + (z + yp) * xp)) / (a * x)
  return { Vf, Vr, gainRear: Vr - Wr, lossFront: Wf - Vf }
}

/* ------------- appended for the chassis scenes (weight transfer, hitches, stability) ------------- */

/** Pull at which the front wheels just unload (Vf = 0 in Eq 6.4). */
export function liftPull(c: Chassis, theta = 0, alpha = 0) {
  const Wf = staticFront(c) * Math.cos(alpha) - (c.W * Math.sin(alpha) * (c.r + c.yg)) / c.x
  return (Wf * c.x) / (Math.cos(theta) * c.yd + Math.sin(theta) * c.xd)
}

/**
 * Eq 6.8 solved for the pull P at which the required gross tractive coefficient equals ψ′
 * (Macmillan Problem 6.8 "needs iteration"; Eqs 6.5 and 6.8 are linear in P, so it is direct).
 */
export function pullForPsi(c: Chassis, psi: number, theta: number, alpha: number, rho = 0) {
  const Vr0 = dynamicLoads(c, 0, theta, alpha).Vr
  const k = (Math.cos(theta) * c.yd + Math.sin(theta) * (c.x + c.xd)) / c.x
  const num = psi * Vr0 - c.W * Math.sin(alpha) - rho * c.W * Math.cos(alpha)
  const den = Math.cos(theta) + rho * Math.sin(theta) - psi * k
  return num / den
}

/** Horizontal axle spacing x″ when the front axle is lifted to height yLift (rear axle at rr stays put). */
export function raisedSpacing(rr: number, rf: number, x: number, yLift: number) {
  const L = Math.hypot(x, rr - rf)
  return Math.sqrt(Math.max(0, L * L - (yLift - rr) ** 2))
}

/** Eq 6.3: β = atan((rr − rf)/x) + atan((y′ − rr)/x″), the rotation of the axle line when the front is raised. */
export function raiseAngle(rr: number, rf: number, x: number, yLift: number, xpp: number) {
  return Math.atan((rr - rf) / x) + Math.atan((yLift - rr) / xpp)
}

/** Eq 6.2: x′r = W′f·x″/W (CG distance ahead of the rear axle with the front raised). */
export function cgFromRaisedFront(WfRaised: number, W: number, xpp: number) {
  return (WfRaised * xpp) / W
}

/** Eq 6.3: yg = (xr − x′r/cosβ)/tanβ. */
export function cgHeightFromRaise(xr: number, xrRaised: number, beta: number) {
  return (xr - xrRaised / Math.cos(beta)) / Math.tan(beta)
}

/** Forward model for Eqs 6.2–6.3: front scale reading W′f when the tractor is tilted nose-up by β. */
export function raisedFrontReading(c: Chassis, beta: number, xpp: number) {
  const xrR = c.xr * Math.cos(beta) - c.yg * Math.sin(beta)
  return (c.W * xrR) / xpp
}

/** Eqs 6.17–6.21: the tanθ limits above which each statement about the hitches holds. */
export function hitchConditionLimits(c: Chassis, s: SoilForce) {
  const { a, b, z } = s
  const { x, xd, yd } = c
  return {
    /** 6.17 fully mounted: rear axle gains weight */
    mountedRearGains: z / (x + xd + b),
    /** 6.18 fully mounted: front axle loses weight */
    mountedFrontLoses: z / (xd + b),
    /** 6.19 mounted transfers more than semi-mounted */
    mountedOverSemi: (z + yd) / b,
    /** 6.20 mounted transfers more than trailed */
    mountedOverTrailed: (z + yd) / (x + xd + b),
    /** 6.21 semi-mounted transfers more than trailed (as given in the notes) */
    semiOverTrailed: (z + yd) / (a - b),
  }
}

export interface WeightTransferHitch {
  /** trailer weight W′ (N) at b from the hitch; trailer axle at a behind the hitch */
  Wt: number
  a: number
  b: number
  /** drawbar pull P (N) at height y′ */
  P: number
  /** constant lift force F (N) in the chain, moment arm c (m) */
  F: number
  c: number
}

/** Eqs 6.30–6.31 (Fig 6.15): axle loads with a weight-transfer hitch; T = W′(a − b)/a. */
export function weightTransferHitchLoads(ch: Chassis, h: WeightTransferHitch) {
  const { x, xd, yd } = ch
  const { Wt, a, b, P, F, c } = h
  const T = (Wt * (a - b)) / a
  const Vr = staticRear(ch) + (Wt * (a - b) * (x + xd)) / (a * x) + (P * yd * (a + x + xd)) / (a * x) + (F * c * (a + x + xd)) / (a * x)
  const Vf = staticFront(ch) - (Wt * (a - b) * xd) / (a * x) - (P * (xd + a) * yd) / (a * x) - (F * c * (a + xd)) / (a * x)
  return { Vf, Vr, T, gainRear: Vr - staticRear(ch), lossFront: staticFront(ch) - Vf }
}

/** Eqs 6.22–6.24: handle force U on a two-wheel walking tractor (handle at xh ahead/behind the axle). */
export function walkingHandleForce(W: number, xr: number, r: number, yg: number, xh: number, alpha = 0, P = 0, theta = 0, xd = 0, yd = 0) {
  const U0 = (W * Math.cos(alpha) * xr) / xh - (W * Math.sin(alpha) * (r + yg)) / xh
  const U = U0 - (P * Math.cos(theta) * yd) / xh - (P * Math.sin(theta) * xd) / xh
  return { U0, U }
}
