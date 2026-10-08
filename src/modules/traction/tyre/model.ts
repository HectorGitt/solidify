import { create } from 'zustand'
import { cite, SRC } from '@/content/citations'
import { RECOMMENDED_PRESSURE_BAR, contactPatch, decodeTyreSize, inflationState, type TyreSize } from '@/physics/tyres'

export const TT = (where: string) => SRC.tt510(where)
export const L27 = (where: string) => SRC.l27(where)
export const TTS = (where: string) => SRC.tts510(where)
export { cite }

export type Build = 'bias' | 'belted' | 'radial'
export type Tread = 'R1' | 'R2' | 'R3' | 'F2'

/** What each construction contains (AEE510 Tires and Tracks p3, Figs 3–4). */
export const BUILDS: Record<Build, { label: string; plies: number; plyAngle: number; belts: number; beltAngle: number; text: string }> = {
  bias: {
    label: 'Bias ply',
    plies: 4,
    plyAngle: 38,
    belts: 0,
    beltAngle: 0,
    text: 'Body cords run from bead to bead at an angle, the direction alternating in each ply, so the plies cross each other. Stiff sidewall, cheaper, rugged.',
  },
  belted: {
    label: 'Belted bias',
    plies: 2,
    plyAngle: 38,
    belts: 2,
    beltAngle: 24,
    text: 'A bias-ply body with low-angle, rigid belts under the tread to stiffen the tread area.',
  },
  radial: {
    label: 'Belted radial',
    plies: 1,
    plyAngle: 90,
    belts: 4,
    beltAngle: 20,
    text: 'Body cords run straight from bead to bead at about 90° to the centre line, plus belts under the tread. The flexible sidewall lets the tread lie flat on the ground — radials give 5–7 % better tractive efficiency than bias tyres.',
  },
}

/** Tread codes listed in the notes (TT p4–5). */
export const TREAD_CODES: { group: string; codes: [string, string][] }[] = [
  { group: 'Front (steering)', codes: [['F-1', 'Rice'], ['F-2', 'Single rib'], ['F-2D', 'Dual rib'], ['F-2T', 'Triple rib'], ['F-3', 'Industrial']] },
  { group: 'Rear (drive)', codes: [['R-1', 'Regular (bar) tread'], ['R-2', 'Cane and rice — deep tread'], ['R-3', 'Shallow, non-directional'], ['R-4', 'Industrial']] },
  { group: 'Implement', codes: [['I-1', ''], ['I-3', ''], ['I-4', ''], ['I-6', '']] },
  { group: 'Industrial', codes: [['E-1 … E-7', '']] },
]

export const TREADS: Record<Tread, { label: string; lugScale: number; text: string }> = {
  R1: { label: 'R-1 regular', lugScale: 1, text: 'Regular agricultural drive tread: angled bars in a chevron. The V must point downward when viewed from the front (reverse only on ground-driven implements).' },
  R2: { label: 'R-2 cane & rice', lugScale: 2, text: 'Deep bars for wet, soft conditions (cane and rice). A suffix "O" or "C" means open or closed tread.' },
  R3: { label: 'R-3 shallow', lugScale: 0.45, text: 'Shallow, non-directional tread for turf and hard surfaces where little soil disturbance is wanted.' },
  F2: { label: 'F-2 single rib', lugScale: 0.8, text: 'Front steering tread with one raised rib around the centre to resist side-slip.' },
}

export type Duty = 'front-field' | 'front-road' | 'front-loader' | 'rear-field' | 'rear-road'

/** Bell's general guide (TTS p14), bar. */
export const DUTIES: Record<Duty, { label: string; bar: number }> = {
  'front-field': { label: 'Front · field', bar: RECOMMENDED_PRESSURE_BAR.front.field },
  'front-road': { label: 'Front · road', bar: RECOMMENDED_PRESSURE_BAR.front.road },
  'front-loader': { label: 'Front · loader', bar: RECOMMENDED_PRESSURE_BAR.front.loader },
  'rear-field': { label: 'Rear · field', bar: RECOMMENDED_PRESSURE_BAR.rear.field },
  'rear-road': { label: 'Rear · road', bar: RECOMMENDED_PRESSURE_BAR.rear.road },
}

export interface TyreParams {
  code: string
  build: Build
  /** bias only: 4 plies, or 2 plies of larger cords with the same 4-ply rating (Fig 3) */
  plies: 2 | 4
  tread: Tread
  reversed: boolean
  tube: boolean
  peel: boolean
  duty: Duty
  /** inflation pressure, bar (gauge) */
  pressure: number
  /** wheel load, kN */
  load: number
}

export const DEFAULTS: TyreParams = {
  code: '18.4-38',
  build: 'bias',
  plies: 4,
  tread: 'R1',
  reversed: false,
  tube: false,
  peel: true,
  duty: 'rear-field',
  pressure: 0.8,
  load: 20,
}

interface Store extends TyreParams {
  set: (p: Partial<TyreParams>) => void
  reset: () => void
}

export const useTyre = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Decode, falling back to the default size when the typed code is not valid. */
export function sizeOf(code: string): { size: TyreSize; valid: boolean } {
  const s = decodeTyreSize(code)
  if (s) return { size: s, valid: true }
  return { size: decodeTyreSize(DEFAULTS.code)!, valid: false }
}

export const SIZE_PRESETS: { code: string; note: string; cite: ReturnType<typeof TT> }[] = [
  { code: '24.5-32', note: 'Size-code example: 24.5 in section width on the recommended rim, 32 in rim diameter.', cite: TT('p5, Fig 7') },
  { code: '12.4/11-28', note: 'Dual sizing: new size 12.4 in, old size 11 in, 28 in rim.', cite: TT('p5') },
  { code: '18.4-38', note: 'From the liquid-ballast chart: an 18.4-38 8-ply carries 11,940 lb and takes 188 gal.', cite: TT('p13') },
  { code: '13.6/12-36', note: '75 % water fill in a 13.6/12-36 ≈ 190 kg.', cite: TTS('p15') },
  { code: '20.8R42', note: 'Example: 20.8R42 duals at 83 kPa.', cite: L27('p32') },
  { code: '710/70R38', note: '710/70R38 correct at 41 kPa vs 193 kPa over-inflated.', cite: L27('p32') },
]

/** Everything the view and panel derive from the parameters. */
export function derive(p: TyreParams) {
  const { size, valid } = sizeOf(p.code)
  const rec = DUTIES[p.duty].bar
  const state = inflationState(p.pressure, rec)
  const patch = contactPatch(p.load * 1000, p.pressure * 1e5, size, state)
  return { size, valid, rec, state, patch }
}
