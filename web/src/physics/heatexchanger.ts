/** Double-pipe heat exchangers: the log-mean method for sizing, and effectiveness-NTU for an exchanger already built. */

export type Flow = 'parallel' | 'counter'

/** log-mean of the temperature differences at the two ends */
export function lmtd(dt1: number, dt2: number) {
  if (Math.abs(dt1 - dt2) < 1e-6) return dt1
  return (dt1 - dt2) / Math.log(dt1 / dt2)
}

/** the end differences for known terminal temperatures */
export function endDifferences(flow: Flow, Thi: number, Tho: number, Tci: number, Tco: number): [number, number] {
  return flow === 'parallel' ? [Thi - Tci, Tho - Tco] : [Thi - Tco, Tho - Tci]
}

/** the area needed for a duty; null when the temperatures can't be reached in this arrangement (the streams would have to cross) */
export function areaFor(flow: Flow, Q: number, U: number, Thi: number, Tho: number, Tci: number, Tco: number) {
  const [a, b] = endDifferences(flow, Thi, Tho, Tci, Tco)
  if (a <= 0 || b <= 0) return null
  return Q / (U * lmtd(a, b))
}

export function effectiveness(flow: Flow, ntu: number, r: number) {
  if (flow === 'parallel') return (1 - Math.exp(-ntu * (1 + r))) / (1 + r)
  if (Math.abs(1 - r) < 1e-6) return ntu / (1 + ntu)
  const e = Math.exp(-ntu * (1 - r))
  return (1 - e) / (1 - r * e)
}

export interface Exchanger {
  flow: Flow
  /** inlet temperatures, °C */
  Thi: number
  Tci: number
  /** capacity rates m·cp, W/K */
  Ch: number
  Cc: number
  /** W/m²K, m² */
  U: number
  A: number
}

export function rate(x: Exchanger) {
  const Cmin = Math.min(x.Ch, x.Cc)
  const Cmax = Math.max(x.Ch, x.Cc)
  const r = Cmin / Cmax
  const ntu = (x.U * x.A) / Cmin
  const eff = effectiveness(x.flow, ntu, r)
  const Q = eff * Cmin * (x.Thi - x.Tci)
  const Tho = x.Thi - Q / x.Ch
  const Tco = x.Tci + Q / x.Cc
  const [a, b] = endDifferences(x.flow, x.Thi, Tho, x.Tci, Tco)
  return { ntu, r, eff, Q, Tho, Tco, dt1: a, dt2: b, lmtd: lmtd(a, b) }
}

/** the two stream temperatures a share s of the way along, measured from the hot inlet */
export function along(x: Exchanger, s: number) {
  const { Tco, Tho } = rate(x)
  const UA = x.U * x.A
  const counter = x.flow === 'counter'
  const m = UA * (1 / x.Ch + (counter ? -1 : 1) / x.Cc)
  const start = x.Thi - (counter ? Tco : x.Tci)
  const area = Math.abs(m) < 1e-9 ? start * s : (start * (1 - Math.exp(-m * s))) / m
  const Th = x.Thi - (UA / x.Ch) * area
  const Tc = counter ? Tco - (UA / x.Cc) * area : x.Tci + (UA / x.Cc) * area
  // the far end is pinned exactly, whatever the rounding
  return s >= 1 ? { Th: Tho, Tc: counter ? x.Tci : Tco } : { Th, Tc }
}
