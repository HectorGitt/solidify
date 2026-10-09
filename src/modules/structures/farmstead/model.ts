import { create } from 'zustand'
import { cite } from '@/content/citations'
import { DRIVES, FARMSTEAD_MAX_FRACTION, HAZARD_SEPARATION, ft, inPlume, windAxisAngle, windVerdict, zoneRadii } from '@/physics/structures'

export const C = {
  ln: (w: string) => cite('AEE505', 'AEE 505 Lecture note 2 new.pdf', w),
  ass: (w: string) => cite('AEE505', 'AEE505 Ass.pdf', w),
}

export interface FarmsteadParams {
  widths: [number, number, number, number]
  /** bearing the prevailing wind blows FROM, ° clockwise from north (layout axis points north) */
  windFrom: number
  driveW: number
  turnR: number
  /** production area, ha */
  prodHa: number
  /** distance from the fuel store to the workshop, m */
  fuelGap: number
  plume: boolean
  checks: Record<string, boolean>
}

export const DEFAULTS: FarmsteadParams = {
  widths: [20, 20, 20, 20],
  windFrom: 200,
  driveW: ft(18),
  turnR: ft(45),
  prodHa: 60,
  fuelGap: 18,
  plume: true,
  checks: {},
}

interface Store extends FarmsteadParams {
  set: (p: Partial<FarmsteadParams>) => void
  setWidth: (i: number, w: number) => void
  reset: () => void
}

export const useFarmstead = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  setWidth: (i, w) =>
    set((s) => {
      const widths = [...s.widths] as FarmsteadParams['widths']
      widths[i] = w
      return { widths }
    }),
  reset: () => set({ ...DEFAULTS, checks: {} }),
}))

export interface Rect {
  id: string
  /** centre (east, north), size across (east) and along (north) */
  e: number
  n: number
  w: number
  d: number
}

/** Plan layout (east, north in m) of the zones, buildings and services. */
export function layout(p: Pick<FarmsteadParams, 'widths' | 'driveW' | 'turnR' | 'fuelGap'>) {
  const r = zoneRadii(p.widths)
  const rr = [0, ...r]
  const chord = (k: number) => Math.sqrt(Math.max(0, rr[k] ** 2 - rr[k - 1] ** 2))
  const mid = (k: number) => rr[k - 1] + rr[k]
  const w = p.widths
  const bw = (k: number, f = 0.5, max = 24) => Math.min(max, Math.max(6, f * chord(k)))
  const bd = (k: number, max = 20) => Math.min(max, Math.max(5, 0.9 * w[k - 1]))
  const off = (k: number, width: number) => Math.max(0.55 * chord(k), p.driveW / 2 + 3 + width / 2)

  const house: Rect = { id: 'dwelling', e: -Math.max(0.42 * w[0], p.driveW / 2 + 2 + 0.25 * w[0]), n: w[0], w: Math.max(8, 0.5 * w[0]), d: Math.max(7, 0.4 * w[0]) }
  const court = { n: 2 * r[0] + 0.5 * w[1], r: p.turnR }
  const shedW = bw(2, 0.45)
  const shed: Rect = { id: 'machinery-shed', e: -Math.max(off(2, shedW), court.r + 2 + shedW / 2), n: mid(2), w: shedW, d: bd(2) }
  const shop: Rect = { id: 'workshop', e: Math.max(off(2, shedW * 0.7), court.r + 2 + (shedW * 0.7) / 2), n: mid(2), w: shedW * 0.7, d: bd(2, 14) }
  const fuel: Rect = { id: 'fuel-store', e: shop.e + shop.w / 2 + p.fuelGap + 2, n: mid(2), w: 4, d: 4 }
  const silo = { e: -off(3, 8), n: mid(3), r: Math.min(4, 0.15 * w[2] + 1) }
  const feed: Rect = { id: 'feed-store', e: off(3, bw(3, 0.4)), n: mid(3), w: bw(3, 0.4), d: bd(3, 14) }
  const barnW = bw(4, 0.4, 30)
  const barns: Rect[] = [-1, 1].map((s, i) => ({ id: `barn-${i}`, e: s * off(4, barnW), n: mid(4), w: barnW, d: bd(4, 26) }))
  const parking = { e: p.driveW / 2 + 2 + (3 * DRIVES.stall.w) / 2, n: 2 + DRIVES.stall.l / 2, stalls: 3 }
  const tank = { e: Math.max(0.5 * w[0], parking.e + 8), n: 2 * r[0] - 3 }
  const septic = { e: house.e - house.w / 2 - 3, n: Math.max(4, house.n - house.d / 2 - 4) }
  return { r, rr, chord, house, court, shed, shop, fuel, silo, feed, barns, parking, tank, septic, far: 2 * r[3] }
}
export type Layout = ReturnType<typeof layout>

/** Shortest distance between two rectangles' edges in plan (0 if they overlap). */
export function rectGap(a: Rect, b: Rect) {
  const dx = Math.max(0, Math.abs(a.e - b.e) - (a.w + b.w) / 2)
  const dy = Math.max(0, Math.abs(a.n - b.n) - (a.d + b.d) / 2)
  return Math.hypot(dx, dy)
}

export function assess(p: FarmsteadParams) {
  const L = layout(p)
  const angle = windAxisAngle(p.windFrom, 0)
  const verdict = windVerdict(angle)
  const plumeHits = L.barns.some((b) => inPlume([b.e, b.n], p.windFrom, [L.house.e, L.house.n], 22, 3 * L.far))
  const area = Math.PI * L.r[3] ** 2
  const frac = area / (p.prodHa * 1e4)
  const others: Rect[] = [L.house, L.shed, L.shop, L.feed, ...L.barns]
  const fuelGap = Math.min(...others.map((o) => rectGap(L.fuel, o)))
  return { L, angle, verdict, plumeHits, area, frac, fracOk: frac <= FARMSTEAD_MAX_FRACTION, fuelGap, fuelOk: fuelGap >= HAZARD_SEPARATION - 1e-6 }
}

export const live = { heading: 0 }
