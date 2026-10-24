/**
 * Soil & water conservation engineering (AEE507): consumptive use, irrigation efficiencies,
 * farm-pond storage, well hydraulics (Dupuit–Thiem), grassed-waterway / terrace channel design
 * (Manning) and the Universal Soil Loss Equation. Pure functions; SI units unless stated.
 * Sources: docs/notes-inventory/AEE507-water-irrigation.md (IPP, SG, WRD, VW, CS-B, S1, S2).
 */

const { PI, log, sqrt, sin, atan, exp, abs, pow, max, min } = Math

/* ------------------------------ 1. Consumptive use (IPP p1–2) ------------------------------ */

/** Temperature coefficient of the SCS Blaney–Criddle method, K_t = 0.0311T + 0.24 (T in °C). */
export const blaneyKt = (T: number) => 0.0311 * T + 0.24

/** Consumptive-use factor f = p(0.46T + 8.13), mm per period; p = % of annual daytime hours in the period. */
export const blaneyF = (T: number, p: number) => p * (0.46 * T + 8.13)

/**
 * SCS Blaney–Criddle ET (mm per period) = K_cs·K_t·p(0.46T + 8.13). With `RH` it is the adjusted
 * form of Fapohunda & Ude (1992): × (1.49 − 0.01·RH).
 */
export function blaneyCriddle({ T, p, kc, RH }: { T: number; p: number; kc: number; RH?: number }) {
  const Kt = blaneyKt(T)
  const f = blaneyF(T, p)
  const et = kc * Kt * f
  const adj = RH === undefined ? 1 : 1.49 - 0.01 * RH
  return { Kt, f, ET: et * adj, ETunadjusted: et, adj }
}

/** Saturated vapour pressure, mb: e° = 1.3329·exp(21.07 − 5336/(T + 273.1)) (IPP p2). */
export const satVapourMb = (T: number) => 1.3329 * exp(21.07 - 5336 / (T + 273.1))

/** Latent heat of vaporisation, cal/g: L = 595.9 − 0.55T. */
export const latentCal = (T: number) => 595.9 - 0.55 * T

/**
 * Jensen–Haise ET_p = C_T(T − T_x)R_s (Ly/day) with C_T = 1/(C₁ + 7.6C_H), C_H = 50/(e₂ − e₁),
 * C₁ = 38 − 2E/305, T_x = −2.5 − 0.14(e₂ − e₁) − E/550; converted with mm/day = Ly × 10/L.
 * e₂, e₁: saturated vapour pressures at the mean maximum and minimum of the warmest month.
 */
export function jensenHaise({ T, Rs, Tmax, Tmin, E }: { T: number; Rs: number; Tmax: number; Tmin: number; E: number }) {
  const e2 = satVapourMb(Tmax)
  const e1 = satVapourMb(Tmin)
  const de = e2 - e1
  const CH = 50 / de
  const C1 = 38 - (2 * E) / 305
  const CT = 1 / (C1 + 7.6 * CH)
  const Tx = -2.5 - 0.14 * de - E / 550
  const ETly = CT * (T - Tx) * Rs
  const L = latentCal(T)
  return { e1, e2, CH, C1, CT, Tx, ETly, L, ETmm: (ETly * 10) / L }
}

/* ------------------------------ 2. Leaching and efficiencies (IPP p3–5) ------------------------------ */

/** Leaching requirement LR = D_d/D_i = EC_i/EC_d. */
export const leachingRequirement = (ECi: number, ECd: number) => ECi / ECd

/** Weighted EC of rain plus irrigation water. */
export const weightedEC = (Dr: number, ECr: number, Di: number, ECi: number) => (Dr * ECr + Di * ECi) / (Dr + Di)

/** Depth to apply so that a fraction LR drains below the root zone: D_i = D_cu/(1 − LR). (Follows from LR = D_d/D_i.) */
export const depthWithLeaching = (Dcu: number, LR: number) => Dcu / (1 - LR)

/** Christiansen distribution efficiency E_d = 1 − y/d, y = mean |x̄ − x_i| (fraction). */
export function christiansen(depths: number[]) {
  const nn = depths.length
  const mean = depths.reduce((a, b) => a + b, 0) / nn
  const sumDev = depths.reduce((a, x) => a + abs(x - mean), 0)
  const y = sumDev / nn
  return { mean, sumDev, y, Ed: 1 - y / mean }
}

/** Storage efficiency from auger depths: the stored part is capped at the root depth. */
export function augerStorage(depths: number[], rootDepth: number) {
  const capped = depths.map((d) => min(d, rootDepth))
  const meanStored = capped.reduce((a, b) => a + b, 0) / capped.length
  return { meanStored, Es: meanStored / rootDepth }
}

/** Christiansen E_d for a depth profile that falls linearly from head to tail (y = range/4 for a linear profile). */
export function linearProfileEd(dHead: number, dTail: number) {
  const mean = (dHead + dTail) / 2
  const y = abs(dHead - dTail) / 4
  return { mean, y, Ed: 1 - y / mean }
}

export interface SurfaceEvent {
  /** flow diverted at the source, m³/s */
  Qsource: number
  /** flow delivered to the field, m³/s */
  Qfield: number
  /** irrigation time, h */
  hours: number
  /** field area, m² */
  area: number
  /** surface runoff, m³/s for runoffHours */
  Qrunoff: number
  runoffHours: number
  /** wetting depth at the head and the tail, m (linear in between) */
  dHead: number
  dTail: number
  /** root-zone depth, m */
  root: number
  /** available water-holding capacity, m water per m soil (20 cm/m = 0.2) */
  whc: number
  /** depletion at irrigation (0.6 = 60 %) */
  depletion: number
}

/**
 * Surface-irrigation event (IPP p3–5; S1 Q3c, S2 Q2c): conveyance, application, storage and
 * distribution efficiencies. Infiltrated water is split in proportion to the wetting depth;
 * the part below the root zone is deep percolation.
 */
export function surfaceEvent(e: SurfaceEvent) {
  const Wi = e.Qsource * e.hours * 3600
  const Wd = e.Qfield * e.hours * 3600
  const runoff = min(Wd, e.Qrunoff * e.runoffHours * 3600)
  const infiltrated = Wd - runoff
  // fraction of the infiltrated volume lying below the root zone, for a linear depth profile
  const N = 200
  let tot = 0
  let below = 0
  for (let i = 0; i < N; i++) {
    const d = e.dHead + ((e.dTail - e.dHead) * (i + 0.5)) / N
    tot += d
    below += max(0, d - e.root)
  }
  const deep = tot > 0 ? (infiltrated * below) / tot : 0
  const Ws = infiltrated - deep
  const Wn = e.whc * e.root * e.depletion * e.area
  const dist = linearProfileEd(e.dHead, e.dTail)
  return {
    Wi,
    Wd,
    runoff,
    infiltrated,
    deep,
    Ws,
    Wn,
    conveyanceLoss: Wi - Wd,
    Ec: Wd / Wi,
    Ea: Ws / Wd,
    Es: min(1, Ws / Wn),
    Ed: dist.Ed,
    dist,
  }
}

/** Generic efficiency E = output/input (IPP p3). Water-use E_u = W_u/W_d; consumptive-use E_cu = W_cu/W_d. */
export const efficiency = (output: number, input: number) => output / input

/** Water stored from a gravimetric moisture change: depth = Δw·(ρ_d/ρ_w)·D (IPP p12 #2). */
export const storedFromMoisture = (w0: number, w1: number, rhoDry: number, depth: number) => (w1 - w0) * (rhoDry / 1000) * depth

/** Season irrigation requirement IR = (ΣET − ΣR_e)/E_a. */
export const irrigationRequirement = (sumET: number, sumRe: number, Ea: number) => max(0, sumET - sumRe) / Ea

/* ------------------------------ SG water budget (US units) ------------------------------ */

export const GAL_PER_ACRE_INCH = 27158

/** Hours per week to replace weekly ET (in/day × 7) over `acres` with a system output of `galPerHour`. */
export function hoursPerWeek(etInPerDay: number, acres: number, galPerHour: number) {
  const gal = etInPerDay * 7 * acres * GAL_PER_ACRE_INCH
  return { gal, hours: gal / galPerHour }
}

/** Required pump flow, gpm: ET × 1.25 (75 % application efficiency) × area ÷ minutes pumped per day. */
export const requiredGpm = (etInPerDay: number, acres: number, hoursPerDay: number) => (etInPerDay * acres * GAL_PER_ACRE_INCH * 1.25) / (hoursPerDay * 60)

/** Acres a well of `gpm` can irrigate (inverse of requiredGpm). */
export const acresFromGpm = (gpm: number, etInPerDay: number, hoursPerDay: number) => (gpm * hoursPerDay * 60) / (etInPerDay * GAL_PER_ACRE_INCH * 1.25)

/* ------------------------------ 3. Farm-pond storage (WRD p3, Table 1) ------------------------------ */

/** Annual water needs, ha-m per unit (WRD Table 1). */
export const POND_NEEDS = {
  person: 0.01,
  fire: 0.03,
  steer: 0.002,
  milkCow: 0.004,
  horse: 0.0014,
  turkeys100: 0.0017,
  chickens100: 0.001,
  swine: 0.0002,
  sheep: 0.0002,
  sprayApplication: 0.0002,
} as const

export interface PondDemand {
  persons: number
  fire: boolean
  steers: number
  milkCows: number
  horses: number
  turkeys: number
  chickens: number
  swine: number
  sheep: number
  /** irrigated area, ha, and depth per season, m */
  irrHa: number
  irrDepth: number
}

export function pondNeeds(d: PondDemand) {
  const items = {
    household: d.persons * POND_NEEDS.person,
    fire: d.fire ? POND_NEEDS.fire : 0,
    steers: d.steers * POND_NEEDS.steer,
    milkCows: d.milkCows * POND_NEEDS.milkCow,
    horses: d.horses * POND_NEEDS.horse,
    turkeys: (d.turkeys / 100) * POND_NEEDS.turkeys100,
    chickens: (d.chickens / 100) * POND_NEEDS.chickens100,
    swine: d.swine * POND_NEEDS.swine,
    sheep: d.sheep * POND_NEEDS.sheep,
    irrigation: d.irrHa * d.irrDepth,
  }
  const total = Object.values(items).reduce((a, b) => a + b, 0)
  return { items, total }
}

/** Gross storage, ha-m, when a fraction `loss` of storage is lost to seepage, evaporation etc.: needs/(1 − loss). */
export const pondStorage = (needs: number, loss: number) => needs / (1 - loss)

/** Area irrigable from a storage (ha-m) after losses, at a seasonal depth (m). */
export const irrigableArea = (storage: number, loss: number, depth: number) => (storage * (1 - loss)) / depth

/* ------------------------------ 4. Well hydraulics (WRD p4–9) ------------------------------ */

/** Darcy Q = K·i·a. */
export const darcy = (K: number, i: number, a: number) => K * i * a

/** Unconfined (gravity) well, Dupuit–Thiem: Q = πK(H² − h_w²)/ln(R/r_w). Units follow K. */
export const unconfinedQ = (K: number, H: number, hw: number, R: number, rw: number) => (PI * K * (H * H - hw * hw)) / log(R / rw)

/** Confined (artesian) well: Q = 2πKd(H − h_w)/ln(R/r_w). */
export const confinedQ = (K: number, d: number, H: number, hw: number, R: number, rw: number) => (2 * PI * K * d * (H - hw)) / log(R / rw)

/** Water-table height at radius r around an unconfined well: h² = h_w² + Q ln(r/r_w)/(πK). */
export const unconfinedHead = (Q: number, K: number, hw: number, rw: number, r: number) => sqrt(max(0, hw * hw + (Q * log(max(r, rw) / rw)) / (PI * K)))

/** Piezometric head at radius r around a confined well: h = h_w + Q ln(r/r_w)/(2πKd). */
export const confinedHead = (Q: number, K: number, d: number, hw: number, rw: number, r: number) => hw + (Q * log(max(r, rw) / rw)) / (2 * PI * K * d)

/** K from two observation wells in an unconfined aquifer: K = Q ln(r₂/r₁)/[π(h₂² − h₁²)], h_i = H − s_i; T = K·H. */
export function twoWellUnconfined(Q: number, H: number, r1: number, s1: number, r2: number, s2: number) {
  const h1 = H - s1
  const h2 = H - s2
  const K = (Q * log(r2 / r1)) / (PI * (h2 * h2 - h1 * h1))
  return { h1, h2, K, T: K * H }
}

/** Drawdown in the pumped well from the nearer observation well (unconfined). */
export function wellDrawdown(Q: number, K: number, H: number, r1: number, h1: number, rw: number) {
  const hw2 = h1 * h1 - (Q * log(r1 / rw)) / (PI * K)
  const hw = sqrt(max(0, hw2))
  return { hw2, hw, sw: H - hw }
}

/** Confined, two piezometers: T = Q ln(r₂/r₁)/[2π(s₁ − s₂)]. */
export const twoWellConfinedT = (Q: number, r1: number, s1: number, r2: number, s2: number) => (Q * log(r2 / r1)) / (2 * PI * (s1 - s2))

/** WRD Table 2: aquifer materials. */
export const AQUIFER_TABLE = [
  { id: 'limestone', label: 'Dense limestone / shale', porosity: 5, yield: 2, K: 1 },
  { id: 'sandstone', label: 'Sandstone', porosity: 15, yield: 8, K: 700 },
  { id: 'gravel', label: 'Gravel', porosity: 25, yield: 22, K: 5000 },
  { id: 'sand', label: 'Sand', porosity: 35, yield: 25, K: 800 },
  { id: 'clay', label: 'Clay', porosity: 45, yield: 3, K: 1 },
] as const

/** WRD Table 3: radius of influence, m. */
export const RADIUS_TABLE = [
  { label: 'Fine sand with clay and silt', lo: 30, hi: 90 },
  { label: 'Fine–medium clean sand', lo: 90, hi: 180 },
  { label: 'Coarse sand + fine gravel', lo: 180, hi: 300 },
  { label: 'Coarse sand and gravel', lo: 300, hi: 600 },
] as const

/* ------------------------------ 5. Channels: Manning and Fig. 7.1 (VW) ------------------------------ */

export type Shape = 'trapezoidal' | 'triangular' | 'parabolic'

/** Manning v = R^(2/3)·s^(1/2)/n (SI). */
export const manningV = (R: number, s: number, n: number) => (pow(R, 2 / 3) * sqrt(s)) / n

/** Hydraulic radius needed for velocity v: R = (vn/√s)^1.5. */
export const radiusFor = (v: number, s: number, n: number) => pow((v * n) / sqrt(s), 1.5)

/** Slope needed for velocity v at hydraulic radius R: s = (vn/R^(2/3))². */
export const slopeFor = (v: number, R: number, n: number) => pow((v * n) / pow(R, 2 / 3), 2)

export interface Section {
  a: number
  p: number
  R: number
  /** top width at the flow depth */
  t: number
}

/** Fig. 7.1 geometry. Trapezoid: b, Z; triangle: Z; parabola: top width t (param `t`). */
export function trapezoid(b: number, d: number, Z: number): Section {
  const a = b * d + Z * d * d
  const p = b + 2 * d * sqrt(Z * Z + 1)
  return { a, p, R: a / p, t: b + 2 * Z * d }
}
export function triangle(d: number, Z: number): Section {
  const a = Z * d * d
  const p = 2 * d * sqrt(Z * Z + 1)
  return { a, p, R: a / p, t: 2 * Z * d }
}
export function parabola(t: number, d: number): Section {
  const a = (2 / 3) * t * d
  const p = t + (8 * d * d) / (3 * t)
  return { a, p, R: a / p, t }
}

/** Section of each shape with a given flow area and depth (S1 Q2c, S2 Q3d). */
export function sectionFromArea(shape: Shape, a: number, d: number, Z = 4): Section & { b?: number; Z?: number } {
  if (shape === 'trapezoidal') {
    const b = (a - Z * d * d) / d
    return { ...trapezoid(b, d, Z), b, Z }
  }
  if (shape === 'triangular') {
    const z = a / (d * d)
    return { ...triangle(d, z), Z: z }
  }
  return parabola((1.5 * a) / d, d)
}

/** Top width at depth D of each shape (T for the design depth). */
export function topWidthAt(shape: Shape, sec: { b?: number; Z?: number; t: number }, d: number, D: number) {
  if (shape === 'trapezoidal') return (sec.b ?? 0) + 2 * (sec.Z ?? 4) * D
  if (shape === 'triangular') return (sec.t * D) / d
  return sec.t * sqrt(D / d)
}

/**
 * Trapezoidal waterway by Manning only (VW Ex 7.1 procedure; S1 Q2b, S2 Q5d):
 * a = Q/v, R = (vn/√s)^1.5, p = a/R, then (2√(Z²+1) − Z)d² − pd + a = 0 (smaller root, b > 0).
 */
export function designTrapezoid({ Q, v, n, s, Z, freeboard = 0.1 }: { Q: number; v: number; n: number; s: number; Z: number; freeboard?: number }) {
  const a = Q / v
  const R = radiusFor(v, s, n)
  const p = a / R
  const c = 2 * sqrt(Z * Z + 1) - Z
  const disc = p * p - 4 * c * a
  if (disc < 0) return { ok: false as const, a, R, p, c, disc }
  const d = (p - sqrt(disc)) / (2 * c)
  const b = p - 2 * d * sqrt(Z * Z + 1)
  const D = d + freeboard
  return { ok: true as const, a, R, p, c, disc, d, b, D, t: b + 2 * Z * d, T: b + 2 * Z * D }
}

/** Parabolic waterway by Manning only (VW Ex 7.2 first pass): d ≈ 1.5R, t = 1.5a/d, then iterate R exactly. */
export function designParabola({ Q, v, n, s, freeboard = 0.1 }: { Q: number; v: number; n: number; s: number; freeboard?: number }) {
  const a = Q / v
  const R = radiusFor(v, s, n)
  // solve t²d/(1.5t² + 4d²) = R with t = 1.5a/d
  let d = 1.5 * R
  for (let i = 0; i < 60; i++) {
    const t = (1.5 * a) / d
    const r = parabola(t, d).R
    d *= R / r
  }
  const t = (1.5 * a) / d
  const D = d + freeboard
  return { a, R, d, t, D, T: t * sqrt(D / d) }
}

/** Triangular waterway by Manning only for a given side slope Z: a = Zd², R = Zd/(2√(Z²+1)). */
export function designTriangle({ Q, v, n, s, Z, freeboard = 0.1 }: { Q: number; v: number; n: number; s: number; Z: number; freeboard?: number }) {
  const a = Q / v
  const d = sqrt(a / Z)
  const sec = triangle(d, Z)
  const D = d + freeboard
  return { a, R: sec.R, Rneeded: radiusFor(v, s, n), d, t: sec.t, D, T: (sec.t * D) / d, vActual: manningV(sec.R, s, n) }
}

/**
 * Diversion terrace / channel with a fixed bottom width (S1 Q1c, S2 Q1c, VW Prob 7.8):
 * a = Q/v, Zd² + bd − a = 0, then s = (vn/R^(2/3))².
 */
export function designTerrace({ Q, v, n, b, Z, freeboard = 0.1 }: { Q: number; v: number; n: number; b: number; Z: number; freeboard?: number }) {
  const a = Q / v
  const d = (-b + sqrt(b * b + 4 * Z * a)) / (2 * Z)
  const sec = trapezoid(b, d, Z)
  return { a, d, D: d + freeboard, p: sec.p, R: sec.R, s: slopeFor(v, sec.R, n), t: sec.t, T: b + 2 * Z * (d + freeboard) }
}

/** Flow depth at which a section carries Q (bisection on Manning). */
export function normalDepth(shape: Shape, Q: number, s: number, n: number, dims: { b?: number; Z?: number; t?: number; dRef?: number }) {
  const at = (d: number): Section => {
    if (shape === 'trapezoidal') return trapezoid(dims.b ?? 0, d, dims.Z ?? 4)
    if (shape === 'triangular') return triangle(d, dims.Z ?? 4)
    const t = (dims.t ?? 1) * sqrt(d / (dims.dRef ?? 1))
    return parabola(t, d)
  }
  let lo = 1e-4
  let hi = 5
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2
    const sec = at(m)
    if (sec.a * manningV(sec.R, s, n) > Q) hi = m
    else lo = m
  }
  const d = (lo + hi) / 2
  const sec = at(d)
  return { d, ...sec, v: manningV(sec.R, s, n) }
}

/** VW Table 7.2 permissible velocities, m/s: [resistant, easily eroded] by slope band. */
export const PERMISSIBLE = [
  { cover: 'Bermuda grass', bands: { '0-5': [2.4, 1.8], '5-10': [2.1, 1.5], '>10': [1.8, 1.2] } },
  { cover: 'Bahia, buffalo, Kentucky bluegrass, brome, tall fescue', bands: { '0-5': [2.1, 1.5], '5-10': [1.8, 1.2], '>10': [1.5, 0.9] } },
  { cover: 'Grass mixtures, reed canary', bands: { '0-5': [1.5, 1.2], '5-10': [1.2, 0.9] } },
  { cover: 'Lespedeza, lovegrass, redtop, alfalfa, red fescue', bands: { '0-5': [1.0, 0.8] } },
  { cover: 'Annuals: common lespedeza, Sudan grass', bands: { '0-5': [1.0, 0.8] } },
] as const

export function permissibleVelocity(coverIndex: number, slopePct: number, erodible: boolean) {
  const row = PERMISSIBLE[coverIndex]
  const band = slopePct <= 5 ? '0-5' : slopePct <= 10 ? '5-10' : '>10'
  const bands = row.bands as Record<string, readonly [number, number] | undefined>
  const v = bands[band]
  if (!v) return null
  return erodible ? v[1] : v[0]
}

/* ------------------------------ 6. USLE (CS-B p4–6) ------------------------------ */

/** Slope angle from percent slope. */
export const slopeAngle = (sPct: number) => atan(sPct / 100)

/** m = β/(1 + β), β = (sinθ/0.0896)/[3(sinθ)^0.8 + 0.56]. */
export function usleM(sPct: number) {
  const st = sin(slopeAngle(sPct))
  const beta = st / 0.0896 / (3 * pow(st, 0.8) + 0.56)
  return beta / (1 + beta)
}

/** L = (l/22)^m (l horizontal slope length, m). */
export const usleL = (l: number, sPct: number) => pow(l / 22, usleM(sPct))

/** S: 3.0(sinθ)^0.8 + 0.56 for l < 4 m; 10.8 sinθ + 0.03 for s < 9 %; 16.8 sinθ − 0.50 for s ≥ 9 %. */
export function usleS(sPct: number, l = 22) {
  const st = sin(slopeAngle(sPct))
  if (l < 4) return 3.0 * pow(st, 0.8) + 0.56
  return sPct < 9 ? 10.8 * st + 0.03 : 16.8 * st - 0.5
}

/** Exam-hint slope factor S = (0.43 + 0.30s + 0.043s²)/6.574 (s in %). */
export const usleSHint = (sPct: number) => (0.43 + 0.3 * sPct + 0.043 * sPct * sPct) / 6.574

/** Soil erodibility K = 2.8×10⁻⁷M^1.14(12 − a) + 4.3×10⁻³(b − 2) + 3.3×10⁻³(c − 3), M = (%silt + %vfs)(100 − %clay). */
export function usleK({ silt, vfs, clay, om, structure, permeability }: { silt: number; vfs: number; clay: number; om: number; structure: number; permeability: number }) {
  const M = (silt + vfs) * (100 - clay)
  return { M, K: 2.8e-7 * pow(M, 1.14) * (12 - om) + 4.3e-3 * (structure - 2) + 3.3e-3 * (permeability - 3) }
}

/** A = R·K·L·S·C·P, Mg/ha/yr. */
export function usle({ R, K, l, sPct, C, P }: { R: number; K: number; l: number; sPct: number; C: number; P: number }) {
  const m = usleM(sPct)
  const L = usleL(l, sPct)
  const S = usleS(sPct, l)
  return { m, L, S, LS: L * S, A: R * K * L * S * C * P }
}

/** P-factor values given in the notes and exam hints. */
export const P_FACTORS = {
  none: 1,
  contour: 0.5,
  strip: 0.25,
  terrace: 0.12,
  terraceUnderground: 0.1,
} as const

/* ------------------------------ 7. Wind (WE slides) ------------------------------ */

/** Transport mode of a wind-blown grain by diameter, mm (WE s7–10). */
export function windMode(dMm: number): 'suspension' | 'saltation' | 'creep' | 'pavement' {
  if (dMm < 0.05) return 'suspension'
  if (dMm <= 0.5) return 'saltation'
  if (dMm <= 1) return 'creep'
  return 'pavement'
}

/** Logarithmic wind profile u(z) = u_ref·ln(z/z₀)/ln(z_ref/z₀) — standard boundary-layer form (beyond the notes). */
export const logWind = (uRef: number, zRef: number, z0: number, z: number) => (z <= z0 ? 0 : (uRef * log(z / z0)) / log(zRef / z0))
