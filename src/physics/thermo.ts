/**
 * Air-standard cycles (Otto, Diesel, Dual) — AEE509 Thermodynamics of ICE.
 * Sources: AEE 509 (Thermodynamic).pdf p1–6; AEE 509 Miscellaneous Exercises p9–12.
 *
 * Units: pressure kPa, temperature K, specific volume m³/kg, energy kJ/kg.
 */

export interface Gas {
  /** ratio of specific heats */
  k: number
  /** gas constant, kJ/kg·K */
  R: number
  /** kJ/kg·K */
  cp: number
  /** kJ/kg·K */
  cv: number
}

/** Exam constants used throughout AEE509. */
export const AIR: Gas = { k: 1.4, R: 0.287, cp: 1.005, cv: 0.718 }

export function makeGas(k: number, cv: number): Gas {
  const R = cv * (k - 1)
  return { k, R, cv, cp: cv + R }
}

export type CycleKind = 'otto' | 'diesel' | 'dual'

export interface CycleInput {
  kind: CycleKind
  /** compression ratio V1/V2 */
  r: number
  /** state 1 pressure, kPa */
  P1: number
  /** state 1 temperature, K */
  T1: number
  /** pressure ratio P3/P2 of constant-volume heat addition (Otto, Dual). 1 for Diesel. */
  alpha: number
  /** cut-off ratio V(end of const-P heating)/V2 (Diesel, Dual). 1 for Otto. */
  delta: number
  gas?: Gas
}

export interface StatePoint {
  P: number
  T: number
  v: number
  /** entropy relative to state 1, kJ/kg·K */
  s: number
}

export interface CycleResult {
  input: Required<CycleInput>
  /** Cardinal states. For Otto/Diesel, `c` (end of const-V heating) equals 3 or 2 as appropriate. */
  s1: StatePoint
  s2: StatePoint
  /** end of constant-volume heat addition */
  s3: StatePoint
  /** end of constant-pressure heat addition (start of expansion) */
  s4: StatePoint
  /** end of expansion (V = V1) */
  s5: StatePoint
  qInV: number
  qInP: number
  qIn: number
  qOut: number
  wNet: number
  /** thermal efficiency from energy balance */
  eta: number
  /** thermal efficiency from the closed-form ASE formula (should equal eta) */
  etaFormula: number
  /** mean effective pressure, kPa */
  mep: number
  Pmax: number
  Tmax: number
}

function entropy(g: Gas, T: number, v: number, T1: number, v1: number) {
  return g.cv * Math.log(T / T1) + g.R * Math.log(v / v1)
}

/** Closed-form dual-cycle ASE (reduces to Otto when delta=1 and Diesel when alpha=1). */
export function aseFormula(r: number, alpha: number, delta: number, k: number): number {
  const lead = 1 / Math.pow(r, k - 1)
  const num = alpha * Math.pow(delta, k) - 1
  const den = alpha - 1 + alpha * k * (delta - 1)
  if (Math.abs(den) < 1e-12) return 1 - lead // Otto limit (alpha→1, delta→1 handled by L'Hôpital: ratio → 1)
  return 1 - lead * (num / den)
}

export function airStandardCycle(input: CycleInput): CycleResult {
  const g = input.gas ?? AIR
  const { r, P1, T1 } = input
  const alpha = input.kind === 'diesel' ? 1 : input.alpha
  const delta = input.kind === 'otto' ? 1 : input.delta
  const k = g.k

  const v1 = (g.R * T1) / P1
  const v2 = v1 / r
  const T2 = T1 * Math.pow(r, k - 1)
  const P2 = P1 * Math.pow(r, k)

  const T3 = T2 * alpha
  const P3 = P2 * alpha
  const v3 = v2

  const T4 = T3 * delta
  const P4 = P3
  const v4 = v2 * delta

  const v5 = v1
  const T5 = T4 * Math.pow(v4 / v5, k - 1)
  const P5 = P4 * Math.pow(v4 / v5, k)

  const qInV = g.cv * (T3 - T2)
  const qInP = g.cp * (T4 - T3)
  const qIn = qInV + qInP
  const qOut = g.cv * (T5 - T1)
  const wNet = qIn - qOut
  const eta = qIn > 0 ? wNet / qIn : 0
  const mep = wNet / (v1 - v2)

  const sp = (P: number, T: number, v: number): StatePoint => ({ P, T, v, s: entropy(g, T, v, T1, v1) })

  return {
    input: { ...input, alpha, delta, gas: g },
    s1: sp(P1, T1, v1),
    s2: sp(P2, T2, v2),
    s3: sp(P3, T3, v3),
    s4: sp(P4, T4, v4),
    s5: sp(P5, T5, v5),
    qInV,
    qInP,
    qIn,
    qOut,
    wNet,
    eta,
    etaFormula: aseFormula(r, alpha, delta, k),
    mep,
    Pmax: P3,
    Tmax: T4,
  }
}

/* ---------- Converters from the ways exam questions specify heat addition ---------- */

/** Otto: alpha from heat added at constant volume. */
export function alphaFromHeat(qIn: number, r: number, T1: number, g: Gas = AIR) {
  const T2 = T1 * Math.pow(r, g.k - 1)
  return (T2 + qIn / g.cv) / T2
}

/** Otto/Dual: alpha from a peak pressure. */
export function alphaFromPmax(Pmax: number, r: number, P1: number, g: Gas = AIR) {
  return Pmax / (P1 * Math.pow(r, g.k))
}

/** Diesel: cut-off ratio from heat added at constant pressure. */
export function deltaFromHeat(qIn: number, r: number, T1: number, g: Gas = AIR) {
  const T2 = T1 * Math.pow(r, g.k - 1)
  return (T2 + qIn / g.cp) / T2
}

/** Diesel: cut-off ratio from "cut-off at x% of stroke": V3 = V2 + x(V1 − V2). */
export function deltaFromCutoffFraction(x: number, r: number) {
  return 1 + x * (r - 1)
}

/** Dual: split total heat into const-V fraction f and const-P remainder. */
export function dualFromHeatSplit(qIn: number, f: number, r: number, T1: number, g: Gas = AIR) {
  const T2 = T1 * Math.pow(r, g.k - 1)
  const T3 = T2 + (f * qIn) / g.cv
  const T4 = T3 + ((1 - f) * qIn) / g.cp
  return { alpha: T3 / T2, delta: T4 / T3 }
}

/** Dual: given Pmax and the rule Qv = Qp (the recurring AEE509 exam question). */
export function dualFromPmaxEqualHeat(Pmax: number, r: number, P1: number, T1: number, g: Gas = AIR) {
  const alpha = alphaFromPmax(Pmax, r, P1, g)
  const T2 = T1 * Math.pow(r, g.k - 1)
  const T3 = alpha * T2
  const qv = g.cv * (T3 - T2)
  const T4 = T3 + qv / g.cp
  return { alpha, delta: T4 / T3 }
}

/* ---------- Path through the cycle as a function of cylinder volume / crank angle ---------- */

export type Stroke = 'intake' | 'compression' | 'power' | 'exhaust'

export interface InstantState {
  P: number
  T: number
  v: number
  s: number
  stroke: Stroke
  /** which process segment we're on, for highlighting */
  process: '0-1' | '1-2' | '2-3' | '3-4' | '4-5' | '5-1' | '1-0'
}

/**
 * Ideal four-stroke state at crank angle θ (degrees, 0–720, 0 = TDC start of intake),
 * given the instantaneous volume ratio x = V/V1 ∈ [1/r, 1].
 */
export function stateAtCrank(c: CycleResult, thetaDeg: number, volFrac: number): InstantState {
  const g = c.input.gas
  const k = g.k
  const th = ((thetaDeg % 720) + 720) % 720
  const v = c.s1.v * volFrac
  const mk = (P: number, stroke: Stroke, process: InstantState['process']): InstantState => {
    const T = (P * v) / g.R
    return { P, T, v, s: entropy(g, T, v, c.s1.T, c.s1.v), stroke, process }
  }
  // gas exchange strokes: the cylinder is open, so the trapped-mass model does not apply.
  // Report the inlet state (T1, s = 0) — the marker sits on the P1 line of the P–V diagram.
  const open = (stroke: Stroke, process: InstantState['process']): InstantState => ({ P: c.s1.P, T: c.s1.T, v, s: 0, stroke, process })
  if (th < 180) return open('intake', '0-1')
  if (th < 360) return mk(c.s1.P * Math.pow(c.s1.v / v, k), 'compression', '1-2')
  if (th < 540) {
    // heat addition happens at TDC (const V) then along const P until v = v4
    if (v <= c.s4.v) return mk(c.s4.P, 'power', c.input.delta > 1 ? '3-4' : '2-3')
    return mk(c.s4.P * Math.pow(c.s4.v / v, k), 'power', '4-5')
  }
  return open('exhaust', '1-0')
}

/** Display temperature of exhaust gas: state 5 expanded isentropically to P1 (blow-down). */
export function exhaustGasTemperature(c: CycleResult) {
  const k = c.input.gas.k
  return c.s5.T * Math.pow(c.s1.P / c.s5.P, (k - 1) / k)
}

/** Closed loop polyline in (v, P) and (s, T) for plotting. */
export function cycleLoop(c: CycleResult, n = 80) {
  const g = c.input.gas
  const k = g.k
  const pts: { v: number; P: number; T: number; s: number }[] = []
  const push = (v: number, P: number) => {
    const T = (P * v) / g.R
    pts.push({ v, P, T, s: entropy(g, T, v, c.s1.T, c.s1.v) })
  }
  // 1 → 2 isentropic compression
  for (let i = 0; i <= n; i++) {
    const v = c.s1.v + (c.s2.v - c.s1.v) * (i / n)
    push(v, c.s1.P * Math.pow(c.s1.v / v, k))
  }
  // 2 → 3 constant volume (sample in T for a smooth T-s curve)
  for (let i = 1; i <= n / 4; i++) push(c.s2.v, c.s2.P + (c.s3.P - c.s2.P) * (i / (n / 4)))
  // 3 → 4 constant pressure
  for (let i = 1; i <= n / 4; i++) push(c.s3.v + (c.s4.v - c.s3.v) * (i / (n / 4)), c.s4.P)
  // 4 → 5 isentropic expansion
  for (let i = 1; i <= n; i++) {
    const v = c.s4.v + (c.s5.v - c.s4.v) * (i / n)
    push(v, c.s4.P * Math.pow(c.s4.v / v, k))
  }
  // 5 → 1 constant volume heat rejection
  for (let i = 1; i <= n / 4; i++) push(c.s1.v, c.s5.P + (c.s1.P - c.s5.P) * (i / (n / 4)))
  return pts
}
