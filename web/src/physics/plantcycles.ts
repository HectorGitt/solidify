import { WATER, type RefrigerantTable } from './fluidtables'

/** where x sits in an ascending list: the row below it and the share of the way to the next */
function locate(xs: number[], x: number): [number, number] {
  const top = xs.length - 2
  let i = 0
  while (i < top && xs[i + 1] < x) i++
  const u = (x - xs[i]) / (xs[i + 1] - xs[i])
  return [i, Math.max(0, Math.min(1, u))]
}

const mix = (a: number, b: number, u: number) => a + (b - a) * u

/** a row of the table, blended between its neighbours */
function satRow(rows: number[][], i: number, u: number) {
  return rows[i].map((v, k) => mix(v, rows[i + 1][k], u))
}

/** the [h, s] curve against superheat at one saturation state */
function supRow(sup: number[][][], i: number, u: number) {
  return sup[i].map((c, k) => [mix(c[0], sup[i + 1][k][0], u), mix(c[1], sup[i + 1][k][1], u)])
}

/** enthalpy where the entropy along a superheat curve reaches s, and the superheat there */
function atEntropy(curve: number[][], dts: number[], s: number) {
  let k = 0
  while (k < curve.length - 2 && curve[k + 1][1] < s) k++
  const u = (s - curve[k][1]) / (curve[k + 1][1] - curve[k][1])
  return { h: mix(curve[k][0], curve[k + 1][0], u), superheat: mix(dts[k], dts[k + 1], u) }
}

/* ------------------------------ Vapour-compression refrigeration ------------------------------ */

export function refrigerantSat(t: RefrigerantTable, T: number) {
  const [i, u] = locate(t.sat.map((r) => r[0]), T)
  const [, p, hf, hg, sf, sg] = satRow(t.sat, i, u)
  return { T, p, hf, hg, sf, sg }
}

/**
 * The ideal cycle between two saturation temperatures (°C). State 1 leaves the evaporator, 2 leaves the
 * compressor, 3 leaves the condenser as saturated liquid and 4 leaves the valve at the same enthalpy.
 * Dry compression takes in saturated vapour; wet compression ends at saturated vapour instead.
 */
export function refrigeration(t: RefrigerantTable, Te: number, Tc: number, wet = false) {
  const lo = refrigerantSat(t, Te)
  const hi = refrigerantSat(t, Tc)
  const [i, u] = locate(t.sat.map((r) => r[0]), Tc)
  let h1 = lo.hg
  let x1 = 1
  let h2: number
  let T2: number
  if (wet) {
    x1 = (hi.sg - lo.sf) / (lo.sg - lo.sf)
    h1 = lo.hf + x1 * (lo.hg - lo.hf)
    h2 = hi.hg
    T2 = Tc
  } else {
    const s = atEntropy(supRow(t.sup, i, u), t.dts, lo.sg)
    h2 = s.h
    T2 = Tc + s.superheat
  }
  const h3 = hi.hf
  const h4 = h3
  const effect = h1 - h4
  const work = h2 - h1
  return { lo, hi, h1, h2, h3, h4, x1, T2, x4: (h4 - lo.hf) / (lo.hg - lo.hf), effect, work, rejected: h2 - h3, cop: effect / work, carnot: (Te + 273.15) / (Tc - Te) }
}

/* ------------------------------ Rankine steam plant ------------------------------ */

const pressures = WATER.sat.map((r) => r[0])
const logP = pressures.map(Math.log)

export function steamSat(bar: number) {
  const [i, u] = locate(logP, Math.log(bar))
  const [, T, hf, hg, sf, sg, vf] = satRow(WATER.sat, i, u)
  return { p: bar, T, hf, hg, sf, sg, vf }
}

/** h and s of steam at a pressure and temperature; at or below saturation it is taken as dry saturated */
export function superheated(bar: number, T: number) {
  const [i, u] = locate(logP, Math.log(bar))
  const sat = steamSat(bar)
  const d = Math.max(0, T - sat.T)
  const curve = supRow(WATER.sup, i, u)
  const [k, v] = locate(WATER.dts, d)
  return { h: mix(curve[k][0], curve[k + 1][0], v), s: mix(curve[k][1], curve[k + 1][1], v), T: sat.T + d }
}

/** the state reached by expanding to a pressure at entropy s: wet if inside the dome, otherwise superheated */
function expandTo(bar: number, s: number) {
  const c = steamSat(bar)
  if (s <= c.sg) {
    const x = (s - c.sf) / (c.sg - c.sf)
    return { h: c.hf + x * (c.hg - c.hf), x }
  }
  const [i, u] = locate(logP, Math.log(bar))
  return { h: atEntropy(supRow(WATER.sup, i, u), WATER.dts, s).h, x: 1 }
}

export interface RankineInput {
  /** boiler and condenser pressures, bar */
  pb: number
  pc: number
  /** steam temperature at the turbine, °C */
  T: number
  /** isentropic efficiency of the turbine, 0 to 1 */
  etaT: number
}

/** 1 leaves the condenser, 2 leaves the pump, 3 leaves the superheater, 4 leaves the turbine; all kJ/kg */
export function rankine({ pb, pc, T, etaT }: RankineInput) {
  const cond = steamSat(pc)
  const boil = steamSat(pb)
  const h1 = cond.hf
  const pump = (cond.vf * (pb - pc) * 1e5) / 1000
  const h2 = h1 + pump
  const s3 = superheated(pb, T)
  const ideal = expandTo(pc, s3.s)
  const turbine = etaT * (s3.h - ideal.h)
  const h4 = s3.h - turbine
  const x4 = Math.min(1, (h4 - cond.hf) / (cond.hg - cond.hf))
  const qIn = s3.h - h2
  const qOut = h4 - h1
  const net = turbine - pump
  return { cond, boil, h1, h2, h3: s3.h, s3: s3.s, h4, T3: s3.T, xIdeal: ideal.x, x4, pump, turbine, qIn, qOut, net, efficiency: net / qIn, carnot: 1 - (cond.T + 273.15) / (s3.T + 273.15), steamRate: 3600 / net, workRatio: net / turbine }
}

/** the saturation dome, for a temperature-entropy chart */
export function steamDome() {
  const rows = WATER.sat
  return { s: [...rows.map((r) => r[4]), ...[...rows].reverse().map((r) => r[5])], T: [...rows.map((r) => r[1]), ...[...rows].reverse().map((r) => r[1])] }
}
