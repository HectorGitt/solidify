/**
 * Crop-processing engineering (AEE 504): materials handling (conveyors), size reduction,
 * separation (screens, aerodynamics, cyclones, centrifuges) and plant-layout metrics.
 *
 * Sources (see docs/notes-inventory/AEE504-AEE536-crop-processing.md):
 * - HAND = "AGE 504 Handling and planning new.docx" (Note 3 Materials handling, Note 4 Factory layout)
 * - RED  = "AGE 504 note 2, reduction.doc" (size reduction; law forms per Fellows Ch 4)
 * - SEP  = "seperation 504.docx" (separation; eqs 1–18)
 * - PQ   = "AEE 504 past question.pdf"
 * All functions are SI unless the name says otherwise.
 */

const G = 9.81
const { PI, sqrt, log, pow, abs } = Math

/* ================================ Conveyors (HAND Note 3) ================================ */

/** H1: volumetric capacity (m³/h) = A (m²) × v (m/min) × 60; here v is taken in m/s (× 60 × 60). */
export function beltCapacityM3h(area: number, speed: number) {
  return area * speed * 60 * 60
}

/**
 * Cross-section of the load on a three-roll troughed belt: the trapezoid between the rolls (A)
 * plus the circular-segment surcharge above line AB (As) — HAND "Design (preliminary)" C = V(A + As).
 * The usable width b = B − 2M (clear margin M) is split equally among the three rolls (standard
 * trough geometry; the split is not given in the notes).
 */
export function troughSection(B: number, margin: number, troughAngle: number, surchargeAngle: number) {
  const b = Math.max(0, B - 2 * margin)
  const l = b / 3
  const top = l + 2 * l * Math.cos(troughAngle)
  const h = l * Math.sin(troughAngle)
  const A = ((l + top) / 2) * h
  const a = Math.max(1e-6, surchargeAngle)
  const R = top / (2 * Math.sin(a))
  const As = surchargeAngle > 1e-6 ? R * R * (a - Math.sin(a) * Math.cos(a)) : 0
  return { b, l, top, h, A, As, area: A + As, R }
}

/**
 * H4: power to drive a belt conveyor = empty-belt friction + horizontal (load friction) + lift.
 * Q mass flow (kg/s), L length (m), H lift (m), v speed (m/s), wBelt moving mass of belt and idler
 * rolls per metre (kg/m), f idler friction factor. +20 % for belts wider than 0.9 m.
 */
export function beltConveyorPower(p: { Q: number; L: number; H: number; v: number; wBelt: number; f: number; width: number }) {
  const empty = p.f * p.wBelt * p.L * G * p.v
  const horizontal = p.f * p.Q * p.L * G
  const lift = p.Q * G * p.H
  const base = empty + horizontal + lift
  const wide = p.width > 0.9 ? 0.2 : 0
  return { empty, horizontal, lift, base, total: base * (1 + wide), wide }
}

/**
 * H5: chain (flight / drag) conveyor power P = 2·V·L·Wc·f + W·(L·Fc + H)·V
 * V speed (m/s), L length (m), Wc chain + flight weight per metre (N/m), f chain-on-runway friction,
 * W material weight per metre (N/m), Fc material friction, H lift (m). Result in W, before the safety factor.
 */
export function chainConveyorPower(V: number, L: number, Wc: number, f: number, W: number, Fc: number, H: number) {
  const chain = 2 * V * L * Wc * f
  const material = W * (L * Fc + H) * V
  return { chain, material, total: chain + material }
}

/** H6: screw volume swept per revolution π(D² − d²)p/4 (m³/rev). */
export function screwVolumePerRev(D: number, d: number, p: number) {
  return (PI * (D * D - d * d) * p) / 4
}

/** Screw capacity (m³/h) at n rpm; `eff` = actual/theoretical (0.3–0.5 in the notes). */
export function screwCapacityM3h(D: number, d: number, p: number, n: number, eff = 1) {
  return screwVolumePerRev(D, d, p) * n * 60 * eff
}

/**
 * H7: screw power P = [π(D² − d²)/4]·p·ρ·n·L·F (× safety factor 1.25–2). With ρ as bulk density
 * (kg/m³) and n in rev/s the product is a weight flow × length × material factor; × g gives watts.
 */
export function screwPower(D: number, d: number, p: number, rho: number, rpm: number, L: number, F: number, sf = 1) {
  const massFlow = screwVolumePerRev(D, d, p) * rho * (rpm / 60)
  const P = massFlow * G * L * F
  return { massFlow, P, total: P * sf }
}

/** H8: bucket elevator power P = Q·H (+10–15 %). Q mass flow kg/s, H lift m. */
export function bucketElevatorPower(Q: number, H: number, allowance = 0.1) {
  const P = Q * G * H
  return { P, total: P * (1 + allowance) }
}

/**
 * Centrifugal discharge over the head pulley: material leaves the bucket when v²/(gR) > 1
 * (centrifugal force exceeds weight at the top). Standard elevator theory, not in the notes.
 */
export function headDischargeFactor(v: number, R: number) {
  return (v * v) / (G * R)
}

/** H9: pneumatic conveyor pipe area A = Q/V and fan power P = Q·H/E. Q air m³/s, V m/s, H static pressure Pa. */
export function pneumaticDesign(Q: number, V: number, H: number, E: number) {
  const A = Q / V
  const D = sqrt((4 * A) / PI)
  return { A, D, P: (Q * H) / E }
}

/** Water-gauge pressure (cm H₂O) → Pa. Low-pressure systems run below 35 cm. */
export const cmWaterToPa = (cm: number) => cm * 0.01 * 1000 * G

/* ============================== Size reduction (RED / FEL Ch 4) ============================== */

/** Kick's law (n = 1): E = C_K ln(L₁/L₂). */
export function kickEnergy(Ck: number, L1: number, L2: number) {
  return Ck * log(L1 / L2)
}

/** Rittinger's law (n = 2): E = C_R(1/L₂ − 1/L₁). */
export function rittingerEnergy(Cr: number, L1: number, L2: number) {
  return Cr * (1 / L2 - 1 / L1)
}

/**
 * Bond's law (n = 1.5): E = W_i(√(100/d₂) − √(100/d₁)), d in µm (80 %-passing sizes), W_i in J/kg.
 * Equivalent to 2C_B(1/√L₂ − 1/√L₁). The notes print "n = 1" for Bond — the exponent is 1.5.
 */
export function bondEnergy(Wi: number, d1: number, d2: number) {
  return Wi * (sqrt(100 / d2) - sqrt(100 / d1))
}

export type Law = 'kick' | 'rittinger' | 'bond'

/** Size function f(L) whose difference sets the energy: E ∝ f(L₂) − f(L₁). */
export function lawFn(law: Law, L: number) {
  return law === 'kick' ? -log(L) : law === 'rittinger' ? 1 / L : 1 / sqrt(L)
}

/**
 * Power for a new duty from a known one (same feed rate and material): P₂ = P₁·ΔF₂/ΔF₁.
 * Used for "is the motor adequate" questions (FEL sample 4.1; PQ p6 Q3c; PQ p1 Q5b).
 */
export function scalePower(law: Law, P1: number, L1: number, L2a: number, L2b: number, L1b = L1) {
  const d1 = lawFn(law, L2a) - lawFn(law, L1)
  const d2 = lawFn(law, L2b) - lawFn(law, L1b)
  return (P1 * d2) / d1
}

/** Size-reduction ratio RR = L₁/L₂ (coarse < 8:1, fine > 100:1). */
export const reductionRatio = (L1: number, L2: number) => L1 / L2

/** IS sieve series used in the notes (top → pan) with openings in mm; the pan is 0. */
export const IS_SIEVES = [
  { no: '100', mm: 1.0 },
  { no: '70', mm: 0.708 },
  { no: '50', mm: 0.5 },
  { no: '40', mm: 0.42 },
  { no: '30', mm: 0.296 },
  { no: '20', mm: 0.211 },
  { no: '15', mm: 0.157 },
  { no: 'Pan', mm: 0 },
] as const

/** Convert masses retained to percentages. */
export function percentRetained(masses: number[]) {
  const tot = masses.reduce((a, b) => a + b, 0)
  return masses.map((m) => (tot > 0 ? (100 * m) / tot : 0))
}

/**
 * Fineness modulus FM = Σ(% retained × multiplier)/100, multipliers 7…0 from the top sieve to the pan
 * (RED "fineness modulus method"). `pct` is top → pan (8 values).
 */
export function finenessModulus(pct: number[]) {
  const n = pct.length
  let s = 0
  for (let i = 0; i < n; i++) s += pct[i] * (n - 1 - i)
  return s / 100
}

/** Average particle size D = 0.135(1.366)^FM, in mm (RED; the notes mix "cm" and "mm"). */
export const averageSizeMm = (FM: number) => 0.135 * pow(1.366, FM)

/**
 * Uniformity index (RED): coarse = % on the top three sieves (100+70+50), medium = next two (40+30),
 * fine = the rest (20+15+pan); each ÷10 and rounded. Returns raw % and the rounded ratio.
 */
export function uniformityIndex(pct: number[]) {
  const sum = (a: number, b: number) => pct.slice(a, b).reduce((x, y) => x + y, 0)
  const coarse = sum(0, 3)
  const medium = sum(3, 5)
  const fine = sum(5, pct.length)
  return { coarse, medium, fine, ratio: [Math.round(coarse / 10), Math.round(medium / 10), Math.round(fine / 10)] as [number, number, number] }
}

/* ================================ Separation (SEP) ================================ */

/** Screen mass ratios (eqs 3–4): A/F = (X_F − X_B)/(X_A − X_B), B/F = (X_A − X_F)/(X_A − X_B). */
export function screenSplit(XF: number, XA: number, XB: number) {
  const AF = (XF - XB) / (XA - XB)
  return { AF, BF: 1 - AF }
}

/**
 * Screen effectiveness (eqs 5–9): E_A = A·X_A/(F·X_F) (oversize recovered in the overflow),
 * E_B = B(1 − X_B)/[F(1 − X_F)] (undersize recovered in the underflow), E = E_A·E_B.
 */
export function screenEffectiveness(XF: number, XA: number, XB: number) {
  const { AF, BF } = screenSplit(XF, XA, XB)
  const EA = (AF * XA) / XF
  const EB = (BF * (1 - XB)) / (1 - XF)
  const E = ((XF - XB) * (XA - XF) * XA * (1 - XB)) / ((XA - XB) ** 2 * (1 - XF) * XF)
  return { AF, BF, EA, EB, E }
}

/** Cumulative fraction of material coarser than sieve k (sum of % retained on sieves 0…k)/100. */
export function cumulativeOversize(pct: number[], k: number) {
  let s = 0
  for (let i = 0; i <= k; i++) s += pct[i]
  return s / 100
}

/** Reynolds number Re = DVρ/µ (eq 10). */
export const reynolds = (D: number, V: number, rho: number, mu: number) => (D * abs(V) * rho) / mu

/** Stokes terminal velocity (eqs 11–12, Re < 0.1): V = gD²(ρp − ρa)/(18µ). Negative = rises. */
export function stokesVelocity(D: number, rhoP: number, rhoF: number, mu: number, g = G) {
  return (g * D * D * (rhoP - rhoF)) / (18 * mu)
}

/** Drag coefficient for a sphere: 24/Re (Stokes, as the notes) blended to the standard curve above Re ≈ 0.1 (beyond notes). */
export function dragCoefficient(Re: number) {
  if (Re < 0.1) return 24 / Math.max(Re, 1e-12)
  if (Re < 1000) return (24 / Re) * (1 + 0.15 * pow(Re, 0.687))
  return 0.44
}

/**
 * Terminal velocity by iteration (eqs 8–9): V = √[2mg(ρp − ρa)/(C·ρp·ρa·A)], C = C(Re).
 * Sphere-equivalent diameter D, particle density ρp, air density ρa, viscosity µ.
 */
export function terminalVelocity(D: number, rhoP: number, rhoA = 1.2, mu = 1.81e-5) {
  const m = (PI / 6) * D ** 3 * rhoP
  const A = (PI / 4) * D * D
  let V = Math.min(30, abs(stokesVelocity(D, rhoP, rhoA, mu)))
  for (let i = 0; i < 60; i++) {
    const C = dragCoefficient(reynolds(D, V, rhoA, mu))
    const Vn = sqrt((2 * m * G * (rhoP - rhoA)) / (C * rhoP * rhoA * A))
    if (abs(Vn - V) < 1e-9) return Vn
    V = 0.5 * (V + Vn)
  }
  return V
}

/** Cyclone (eqs 13–17): centrifugal force C_f = WV²/(gR), resultant F = W√(S² + 1), separation factor S = V²/(gR). */
export function cycloneForces(V: number, R: number, W = 1) {
  const S = (V * V) / (G * R)
  return { S, Cf: W * S, F: W * sqrt(S * S + 1) }
}

/** Centrifuge / cyclone radial Stokes velocity (eq 18): U = D²rω²(ρp − ρf)/(18µ), ω = 2πN (N rev/s). */
export function centrifugeVelocity(D: number, r: number, N: number, rhoP: number, rhoF: number, mu: number) {
  const w = 2 * PI * N
  return (D * D * r * w * w * (rhoP - rhoF)) / (18 * mu)
}

/**
 * Smallest particle that reaches the cyclone wall in N_t turns of the outer vortex (Rosin–Rammler–
 * Intelligent critical diameter, beyond the notes): d = √(9µb/(πN_tVΔρ)), b = inlet width.
 */
export function cycloneCriticalDiameter(mu: number, b: number, Nt: number, V: number, drho: number) {
  return sqrt((9 * mu * b) / (PI * Nt * V * drho))
}

/* ============================== Plant layout (HAND Note 4) ============================== */

export type XY = [number, number]

/** Length of a polyline route. */
export function routeLength(pts: XY[]) {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return s
}

function segX(a: XY, b: XY, c: XY, d: XY) {
  const o = (p: XY, q: XY, r: XY) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const d1 = o(a, b, c)
  const d2 = o(a, b, d)
  const d3 = o(c, d, a)
  const d4 = o(c, d, b)
  return d1 * d2 < -1e-12 && d3 * d4 < -1e-12
}

/** Number of places where a set of flow routes cross each other or themselves (non-adjacent segments). */
export function flowCrossings(routes: XY[][]) {
  const segs: { a: XY; b: XY; r: number; i: number }[] = []
  routes.forEach((pts, r) => {
    for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], r, i })
  })
  let n = 0
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]
      const t = segs[j]
      if (s.r === t.r && abs(s.i - t.i) < 2) continue
      if (segX(s.a, s.b, t.a, t.b)) n++
    }
  return n
}

/** Handling effort Σ(mass × distance) for each transport leg (t·m per batch) — what "minimise handling" minimises. */
export function handlingEffort(legs: { mass: number; dist: number }[]) {
  return legs.reduce((s, l) => s + l.mass * l.dist, 0)
}
