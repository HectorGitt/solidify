import { create } from 'zustand'
import { C } from '../_shared/cites'

export { C }

export type Method = 'basin' | 'border' | 'furrow' | 'sprinkler' | 'drip' | 'sub'

/** Field frame: X runs from the head (x = −L/2, water in) to the tail; Z across; Y up, ground at 0. */
export const FIELD = { L: 30, W: 18, soilDepth: 2.6, cell: 0.15 }
export const FURROW = { spacing: 0.75, ridge: 0.16 }
export const BORDER = { strip: 4.5, ridge: 0.18 }
export const SPRINK = { xs: [-12, -6, 0, 6, 12], zs: [-6, 0, 6], riser: 0.9 }
export const DRIP = { laterals: [-6, -3, 0, 3, 6], dx: 1.5, x0: -12 }
export const SUB = { drains: [-6, -2, 2, 6], depth: 0.9 }

export interface IrrParams {
  method: Method
  /** final wetting depth at the head and tail of a surface-irrigated run, m */
  dHead: number
  dTail: number
  /** root-zone depth, m */
  root: number
  /** sim seconds per irrigation event */
  cycle: number
  /** sprinkler wetted radius (m) — schematic; spacing formulas are not in the notes */
  wetRadius: number
}

export const DEFAULTS: IrrParams = { method: 'furrow', dHead: 1.8, dTail: 1.2, root: 1.8, cycle: 24, wetRadius: 5 }

interface Store extends IrrParams {
  set: (p: Partial<IrrParams>) => void
  reset: () => void
}
export const useIrr = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/* ------------------------------ event timeline ------------------------------ */

/** Event phase 0…1.25 (the last 0.25 is a hold showing the final state). */
export const phaseAt = (t: number, cycle: number) => (t / cycle) % 1.25

/** Advance: the front reaches the tail at u = 0.55; inflow is cut off at u = 0.7, after which the water recedes from the head. */
export const ADV = { reach: 0.55, cutoff: 0.7 }

export const frontX = (u: number) => -FIELD.L / 2 + FIELD.L * Math.min(1, u / ADV.reach)
export const recedeX = (u: number) => -FIELD.L / 2 + FIELD.L * Math.max(0, Math.min(1, (u - ADV.cutoff) / (1 - ADV.cutoff)))

/** Linear head-to-tail final wetting depth (IPP p5–6; the efficiency problems). */
export const finalDepth = (p: Pick<IrrParams, 'dHead' | 'dTail'>, x: number) => p.dHead + ((p.dTail - p.dHead) * (x + FIELD.L / 2)) / FIELD.L

/**
 * Wetting depth at x and phase u for a surface method: grows with the opportunity time (time since the
 * front arrived) and reaches the linear final profile at u = 1. The √ growth is schematic (infiltration
 * equations are not in the notes).
 */
export function wetDepth(p: IrrParams, x: number, u: number) {
  const xr = (x + FIELD.L / 2) / FIELD.L
  if (p.method === 'basin') {
    const k = Math.max(0, Math.min(1, u))
    return ((p.dHead + p.dTail) / 2) * Math.sqrt(k)
  }
  const arrive = ADV.reach * xr
  if (u <= arrive) return 0
  const k = Math.min(1, (u - arrive) / (1 - arrive))
  return finalDepth(p, x) * Math.sqrt(k)
}

/** Sprinkler catch at a point: overlapping triangular patterns (schematic), relative to one head's centre value. */
export function sprinklerCatch(x: number, z: number, R: number) {
  let c = 0
  for (const hx of SPRINK.xs)
    for (const hz of SPRINK.zs) {
      const r = Math.hypot(x - hx, z - hz)
      if (r < R) c += 1 - r / R
    }
  return c
}

/* ------------------------------ notes content ------------------------------ */

export interface MethodInfo {
  label: string
  how: string
  pros: string[]
  cons: string[]
  cite: ReturnType<typeof C.ipp>
}

export const METHODS: Record<Method, MethodInfo> = {
  basin: {
    label: 'Basin',
    how: 'Controlled flooding: large streams fill level plots surrounded by levees (bunds, dikes) to the desired depth; the water then infiltrates or is drained.',
    pros: ['Adaptable to nearly all soils and crops', 'Low power needs — cheap to run', 'Uniform depth on level plots'],
    cons: ['Needs land grading and levees', 'Large streams needed', 'Not for crops sensitive to ponding'],
    cite: C.ipp('p5–6 controlled flooding (checks/basins)'),
  },
  border: {
    label: 'Border',
    how: 'Parallel earth ridges guide a sheet of water down the slope; strips 3–30 m wide and 100–800 m long. Water turned on at the high end flows down and diminishes as it infiltrates.',
    pros: ['Suits close-growing crops on gentle uniform slopes', 'Whole farm irrigated in 1–3 days within a 10–14-day interval', 'Cheap: low power needs'],
    cons: ['Needs land grading', 'Head–tail gradient: deep percolation at the head, under-irrigation at the tail', 'Runoff at the tail unless controlled'],
    cite: C.ipp('p5–6 borders'),
  },
  furrow: {
    label: 'Furrow',
    how: 'Small channels run down or across the slope; water seeps through the furrow bottom and sides. Only ½ to ⅕ of the surface is wetted, which cuts evaporation.',
    pros: ['Only ½–⅕ of the surface wetted: less evaporation', 'Suits row crops', 'Low power needs'],
    cons: ['Needs land grading', 'Lateral wetting must meet between furrows', 'Head–tail infiltration gradient'],
    cite: C.ipp('p5–6 furrows'),
  },
  sprinkler: {
    label: 'Sprinkler',
    how: 'A pump unit, mainline, laterals, risers and sprinkler heads (with quick couplers and controls) spray water over the crop like rain. Shown: a solid-set system — laterals placed at the start of the season and left in place.',
    pros: ['Sandy or shallow soils and uneven slopes', 'No land grading', 'Good control of light applications', 'Can apply fertiliser'],
    cons: ['High initial cost', 'Labour for portable systems', 'High pumping power', 'Affected by wind and high evaporation'],
    cite: C.ipp('p7–9, Fig. 2'),
  },
  drip: {
    label: 'Drip',
    how: 'Low-pressure system: emitters discharge 1–8 L/h at 0.15–2 atm. Source → control head (filter, fertiliser injector, backflow valve, controller) → main → manifold → plastic laterals → emitters. Each emitter wets an onion-shaped bulb.',
    pros: ['Little evaporation and less weed growth', 'Young orchards, high-value crops, saline water', 'Works on uneven terrain', 'Can be fully automated'],
    cons: ['Emitter clogging (filters needed)', 'Salt accumulates at the edge of the wetted zone', 'Cost of pipework'],
    cite: C.ipp('p6–7, Fig. 1'),
  },
  sub: {
    label: 'Sub-irrigation',
    how: 'Water-table control: a water table is raised and held below the root zone, fed through open ditches, mole or tile drains; capillarity carries water up to the roots. Needs permeable topsoil over an impermeable layer or a high water table, and good-quality water.',
    pros: ['Low labour', 'Fewer weed seeds; less evaporation', 'No disruption of the surface'],
    cons: ['Salinity hazard — salts rise with the water', 'High cost', 'Only on suitable soils and sites'],
    cite: C.ipp('p9–10 sub-irrigation'),
  },
}

/** Selection criteria (IPP p10–11; S1 Q5b, S2 Q4b). */
export const CRITERIA = [
  'Cost (system, land preparation, labour)',
  'Labour availability',
  'Water availability and supply',
  'Water quality',
  'Reliability',
  'The crop and its value',
  'Type of energy available (gravity may be enough)',
  'Soil condition and the land preparation possible',
  'Topography and climate (wind)',
]

/* ------------------------------ live ------------------------------ */

export const live = { u: 0, front: 0, wetFrac: 0, dHeadNow: 0, dTailNow: 0, flowing: false }
