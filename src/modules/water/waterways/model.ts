import { create } from 'zustand'
import { designParabola, designTrapezoid, designTriangle, manningV, normalDepth, parabola, sectionFromArea, trapezoid, triangle, type Shape } from '@/physics/water'
import { C } from '../_shared/cites'

export { C }
export type { Shape }

export interface WaterwayParams {
  shape: Shape
  /** design: size the channel for Q at the permissible velocity; check: velocity of a given area and depth */
  mode: 'design' | 'check'
  Q: number
  v: number
  n: number
  /** slope, % */
  s: number
  Z: number
  freeboard: number
  /* check mode */
  a: number
  d: number
  /** fraction of the design flow running now */
  flowFrac: number
}

export const DEFAULTS: WaterwayParams = { shape: 'trapezoidal', mode: 'design', Q: 5.67, v: 1.75, n: 0.055, s: 3, Z: 4, freeboard: 0.1, a: 2.55, d: 0.4, flowFrac: 1 }

interface Store extends WaterwayParams {
  set: (p: Partial<WaterwayParams>) => void
  reset: () => void
}
export const useWaterway = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** The channel as built: bottom width b (trapezoid), side slope Z, top width t at design flow depth d, design depth D and top width T. */
export interface Channel {
  ok: boolean
  shape: Shape
  b: number
  Z: number
  d: number
  t: number
  D: number
  T: number
  a: number
  p: number
  R: number
  v: number
  Q: number
  /** Manning-required R (design mode) */
  Rreq: number
}

export function channelOf(p: WaterwayParams): Channel {
  const s = p.s / 100
  if (p.mode === 'check') {
    const sec = sectionFromArea(p.shape, p.a, p.d, p.Z)
    const D = p.d + p.freeboard
    const b = sec.b ?? 0
    const Z = sec.Z ?? p.Z
    const T = p.shape === 'trapezoidal' ? b + 2 * Z * D : p.shape === 'triangular' ? (sec.t * D) / p.d : sec.t * Math.sqrt(D / p.d)
    const v = manningV(sec.R, s, p.n)
    return { ok: b >= 0, shape: p.shape, b, Z, d: p.d, t: sec.t, D, T, a: sec.a, p: sec.p, R: sec.R, v, Q: sec.a * v, Rreq: sec.R }
  }
  if (p.shape === 'trapezoidal') {
    const r = designTrapezoid({ Q: p.Q, v: p.v, n: p.n, s, Z: p.Z, freeboard: p.freeboard })
    if (!r.ok) return { ok: false, shape: p.shape, b: 0, Z: p.Z, d: 0.5, t: 4, D: 0.6, T: 5, a: r.a, p: r.p, R: r.R, v: p.v, Q: p.Q, Rreq: r.R }
    return { ok: r.b > 0, shape: p.shape, b: r.b, Z: p.Z, d: r.d, t: r.t, D: r.D, T: r.T, a: r.a, p: r.p, R: r.R, v: p.v, Q: p.Q, Rreq: r.R }
  }
  if (p.shape === 'parabolic') {
    const r = designParabola({ Q: p.Q, v: p.v, n: p.n, s, freeboard: p.freeboard })
    const sec = parabola(r.t, r.d)
    return { ok: true, shape: p.shape, b: 0, Z: 0, d: r.d, t: r.t, D: r.D, T: r.T, a: sec.a, p: sec.p, R: sec.R, v: p.v, Q: p.Q, Rreq: r.R }
  }
  // a triangle of side slope Z has a fixed R for a given area, so Manning gives the velocity it actually runs at
  const r = designTriangle({ Q: p.Q, v: p.v, n: p.n, s, Z: p.Z, freeboard: p.freeboard })
  const sec = triangle(r.d, p.Z)
  return { ok: true, shape: p.shape, b: 0, Z: p.Z, d: r.d, t: r.t, D: r.D, T: r.T, a: sec.a, p: sec.p, R: sec.R, v: r.vActual, Q: sec.a * r.vActual, Rreq: r.Rneeded }
}

/** Half-width of the channel at height y above the bed. */
export function halfWidth(ch: Channel, y: number) {
  if (ch.shape === 'trapezoidal') return ch.b / 2 + ch.Z * y
  if (ch.shape === 'triangular') return ch.Z * y
  return (ch.t / 2) * Math.sqrt(Math.max(0, y) / ch.d)
}

/** Flow now: normal depth for flowFrac × capacity in the built channel. */
export function flowNow(ch: Channel, p: WaterwayParams) {
  const Qn = Math.max(1e-3, ch.Q * p.flowFrac)
  return normalDepth(ch.shape, Qn, p.s / 100, p.n, { b: ch.b, Z: ch.Z, t: ch.t, dRef: ch.d })
}

/** Section properties at any depth (for the chart). */
export function sectionAt(ch: Channel, y: number) {
  if (ch.shape === 'trapezoidal') return trapezoid(ch.b, y, ch.Z)
  if (ch.shape === 'triangular') return triangle(y, ch.Z)
  return parabola(2 * halfWidth(ch, y), y)
}

/** VW Table 7.2 cover groups (labels for the picker). */
export const live = { v: 0, d: 0, q: 0 }
