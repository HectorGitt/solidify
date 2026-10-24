import { create } from 'zustand'
import { cite } from '@/content/citations'
import { ROOMS, allocateOccupants, checkRoom, type RoomKind } from '@/physics/structures'

export const C = {
  ln: (w: string) => cite('AEE505', 'AEE 505 Lecture note 2 new.pdf', w),
  ass: (w: string) => cite('AEE505', 'AEE505 Ass.pdf', w),
}

export interface Room {
  name: string
  kind: RoomKind
  /** min corner (x east, z south) and size, m */
  x: number
  z: number
  w: number
  d: number
}
/** Door centred at (x, z) on a wall running along `axis`. */
export interface Door {
  x: number
  z: number
  axis: 'x' | 'z'
  w?: number
}
export interface Plan {
  id: PlanId
  name: string
  group: 'Traditional' | 'Contemporary'
  rooms: Room[]
  doors: Door[]
  roofs: { x: number; z: number; w: number; d: number }[]
  pros: string
  cons: string
  cite: string
  /** the yard is walled in (counts as inside for security) */
  enclosedYard?: boolean
}

export type PlanId = 'mp-one' | 'mp-several' | 'sp-huts' | 'external' | 'courtyard' | 'corridor' | 'central'

const R = (name: string, kind: RoomKind, x: number, z: number, w: number, d: number): Room => ({ name, kind, x, z, w, d })
const Dx = (x: number, z: number, w = 0.9): Door => ({ x, z, axis: 'x', w })
const Dz = (x: number, z: number, w = 0.9): Door => ({ x, z, axis: 'z', w })

export const PLANS: Plan[] = [
  {
    id: 'mp-one',
    name: 'Multi-purpose house, one room',
    group: 'Traditional',
    rooms: [R('All-purpose room (sleep, cook, store, animals)', 'multi', 0, 0, 5, 4)],
    doors: [Dx(2.5, 4)],
    roofs: [{ x: 0, z: 0, w: 5, d: 4 }],
    pros: 'Least material; good security (one door).',
    cons: 'No privacy; health hazard — people, cooking and animals share one room.',
    cite: 'p14',
  },
  {
    id: 'mp-several',
    name: 'Multi-purpose house, several rooms',
    group: 'Traditional',
    rooms: [R('Hall: cooking, store & animals', 'kitchen', 0, 0, 4, 6), R('Sleeping room A', 'bedroom', 4, 0, 5, 3), R('Sleeping room B', 'bedroom', 4, 3, 5, 3)],
    doors: [Dx(2, 6), Dz(4, 1.5), Dz(4, 4.5)],
    roofs: [{ x: 0, z: 0, w: 9, d: 6 }],
    pros: 'Good security; better privacy than one room.',
    cons: 'More material; health still poor — cooking, food, sleeping and animals under one roof.',
    cite: 'p14–15',
  },
  {
    id: 'sp-huts',
    name: 'Single-purpose houses',
    group: 'Traditional',
    rooms: [
      R('Compound', 'yard', 0, 0, 12, 10),
      R('Sleeping hut 1', 'bedroom', 0.5, 0.5, 3.4, 3.4),
      R('Sleeping hut 2', 'bedroom', 8.1, 0.5, 3.4, 3.4),
      R('Washing slab', 'wash', 5, 0.5, 2, 1.6),
      R('Kitchen hut', 'kitchen', 0.5, 6.5, 3, 3),
      R('Store', 'store', 5, 7, 2.5, 2.5),
      R('Animal shelter', 'animals', 8, 6.5, 4, 3),
    ],
    doors: [Dx(2.2, 3.9), Dx(9.8, 3.9), Dx(6, 2.1, 0.8), Dx(2, 6.5), Dx(6.25, 7), Dx(10, 6.5, 1.2)],
    roofs: [
      { x: 0.5, z: 0.5, w: 3.4, d: 3.4 },
      { x: 8.1, z: 0.5, w: 3.4, d: 3.4 },
      { x: 5, z: 0.5, w: 2, d: 1.6 },
      { x: 0.5, z: 6.5, w: 3, d: 3 },
      { x: 5, z: 7, w: 2.5, d: 2.5 },
      { x: 8, z: 6.5, w: 4, d: 3 },
    ],
    pros: 'Very good privacy; minimal health hazard; easy to expand hut by hut.',
    cons: 'Most material; security may be poor (many doors, scattered huts).',
    cite: 'p15',
  },
  {
    id: 'external',
    name: 'External-access type',
    group: 'Contemporary',
    rooms: [
      R('Bedroom 1', 'bedroom', 0, 0, 3.5, 3.5),
      R('Bedroom 2', 'bedroom', 3.5, 0, 3, 3.5),
      R('Bedroom 3', 'bedroom', 6.5, 0, 3, 3.5),
      R('Living room', 'living', 9.5, 0, 4, 3.5),
      R('Kitchen', 'kitchen', 13.5, 0, 3, 3.5),
      R('Store', 'store', 16.5, 0, 2, 3.5),
      R('Veranda', 'veranda', 0, 3.5, 18.5, 2),
    ],
    doors: [Dx(1.75, 3.5), Dx(5, 3.5), Dx(8, 3.5), Dx(11.5, 3.5), Dx(15, 3.5), Dx(17.5, 3.5, 0.8)],
    roofs: [{ x: 0, z: 0, w: 18.5, d: 5.5 }],
    pros: 'Each room independent — suits an extended family or a change of owner.',
    cons: 'Security depends on many costly external doors; no internal links.',
    cite: 'p16',
  },
  {
    id: 'courtyard',
    name: 'Courtyard type',
    group: 'Contemporary',
    rooms: [
      R("Parents' bedroom", 'bedroom', 0, 0, 4, 3.5),
      R("Boys' room", 'bedroom', 4, 0, 3.5, 3.5),
      R("Girls' room", 'bedroom', 7.5, 0, 3.5, 3.5),
      R('Office', 'office', 11, 0, 4, 3.5),
      R('Living room', 'living', 0, 3.5, 3.5, 4.2),
      R('Bath & washing', 'wash', 0, 7.7, 3.5, 1.8),
      R('Kitchen', 'kitchen', 11.5, 3.5, 3.5, 3.6),
      R('Store', 'store', 11.5, 7.1, 3.5, 2.4),
      R('Courtyard', 'yard', 3.5, 3.5, 8, 6),
    ],
    doors: [Dx(3.75, 3.5, 0.5), Dx(5.75, 3.5), Dx(9.25, 3.5), Dx(13, 0), Dz(3.5, 5.6), Dz(3.5, 8.6, 0.8), Dz(11.5, 5.3), Dz(11.5, 8.3), Dz(0, 5.6, 1.0), Dz(15, 5.3), Dx(7.5, 9.5, 1.5)],
    enclosedYard: true,
    roofs: [
      { x: 0, z: 0, w: 15, d: 3.5 },
      { x: 0, z: 3.5, w: 3.5, d: 6 },
      { x: 11.5, z: 3.5, w: 3.5, d: 6 },
    ],
    pros: 'Rooms open onto an enclosed yard: better security and privacy; shaded outdoor living.',
    cons: 'More wall and roof per m² than a compact block.',
    cite: 'p16–17; Ass p3–6',
  },
  {
    id: 'corridor',
    name: 'Corridor type',
    group: 'Contemporary',
    rooms: [
      R('Bedroom 1', 'bedroom', 0, 0, 3.5, 3.5),
      R('Bedroom 2', 'bedroom', 3.5, 0, 3.5, 3.5),
      R('Bedroom 3', 'bedroom', 7, 0, 3.5, 3.5),
      R('Bath & washing', 'wash', 10.5, 0, 2, 3.5),
      R('Store', 'store', 12.5, 0, 1.5, 3.5),
      R('Corridor', 'corridor', 0, 3.5, 14, 1.2),
      R('Living room', 'living', 0, 4.7, 4, 4),
      R('Kitchen', 'kitchen', 4, 4.7, 3.5, 4),
      R('Office', 'office', 7.5, 4.7, 2.5, 4),
      R('Bedroom 4', 'bedroom', 10, 4.7, 4, 4),
    ],
    doors: [Dx(1.75, 3.5), Dx(5.25, 3.5), Dx(8.75, 3.5), Dx(11.5, 3.5, 0.8), Dx(13.25, 3.5, 0.7), Dx(2, 4.7), Dx(5.75, 4.7), Dx(8.75, 4.7), Dx(12, 4.7), Dz(0, 4.1, 1.0), Dz(14, 4.1, 1.0)],
    roofs: [{ x: 0, z: 0, w: 14, d: 8.7 }],
    pros: 'Good security and privacy: every room is reached from the corridor.',
    cons: 'The corridor is dark and is floor area used only for circulation.',
    cite: 'p17',
  },
  {
    id: 'central',
    name: 'Central-room type',
    group: 'Contemporary',
    rooms: [
      R('Central meeting / dining room', 'living', 3, 3, 6.5, 5),
      R('Bedroom 1', 'bedroom', 3, 0, 3.25, 3),
      R('Bedroom 2', 'bedroom', 6.25, 0, 3.25, 3),
      R('Kitchen', 'kitchen', 0, 3, 3, 3),
      R('Store', 'store', 0, 6, 3, 2),
      R('Bedroom 3', 'bedroom', 9.5, 3, 3, 3),
      R('Bath & washing', 'wash', 9.5, 6, 3, 2),
      R('Office', 'office', 3, 8, 3.6, 2.5),
      R('Entrance porch', 'veranda', 6.6, 8, 2.9, 2.5),
    ],
    doors: [Dx(4.6, 3), Dx(7.9, 3), Dz(3, 4.5), Dz(3, 7), Dz(9.5, 4.5), Dz(9.5, 7), Dx(4.8, 8), Dx(8, 8, 1.0), Dz(0, 4.5)],
    roofs: [{ x: 0, z: 0, w: 12.5, d: 10.5 }],
    pros: 'Very good security: every room is entered from the central room.',
    cons: 'The central room must be big enough for circulation as well as furniture.',
    cite: 'p17',
  },
]

export interface HouseParams {
  plan: PlanId
  family: number
  scale: number
  plinth: number
  roof: 'corrugated' | 'thatch'
  pitch: number
  wallH: number
  elaborate: boolean
  /** bearing of the plan's x axis (°), 90 = x runs east */
  orient: number
}

export const DEFAULTS: HouseParams = { plan: 'courtyard', family: 7, scale: 1, plinth: 0.15, roof: 'corrugated', pitch: 15, wallH: 2.7, elaborate: false, orient: 90 }

interface Store extends HouseParams {
  set: (p: Partial<HouseParams>) => void
  reset: () => void
}
export const useHouse = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id)!
export const ENCLOSED = (k: RoomKind) => k !== 'yard' && k !== 'veranda'

/** Plan scaled about its origin. */
export function scaled(p: Plan, s: number): Plan {
  return {
    ...p,
    rooms: p.rooms.map((r) => ({ ...r, x: r.x * s, z: r.z * s, w: r.w * s, d: r.d * s })),
    doors: p.doors.map((d) => ({ ...d, x: d.x * s, z: d.z * s })),
    roofs: p.roofs.map((r) => ({ x: r.x * s, z: r.z * s, w: r.w * s, d: r.d * s })),
  }
}

const inside = (r: Room, x: number, z: number) => x > r.x + 1e-6 && x < r.x + r.w - 1e-6 && z > r.z + 1e-6 && z < r.z + r.d - 1e-6

/** Enclosed room containing a plan point, if any. */
export const roomAt = (p: Plan, x: number, z: number) => p.rooms.find((r) => (ENCLOSED(r.kind) || (p.enclosedYard && r.kind === 'yard')) && inside(r, x, z))

/** A door is external when one side is outside every enclosed room (yards and verandas count as outside). */
export function externalDoors(p: Plan) {
  return p.doors.filter((d) => {
    const e = 0.3
    const [a, b] = d.axis === 'x' ? [roomAt(p, d.x, d.z - e), roomAt(p, d.x, d.z + e)] : [roomAt(p, d.x - e, d.z), roomAt(p, d.x + e, d.z)]
    return !a || !b
  }).length
}

export function evaluate(st: HouseParams) {
  const plan = scaled(planById(st.plan), st.scale)
  const beds = plan.rooms.filter((r) => r.kind === 'bedroom' || r.kind === 'multi')
  const occ = allocateOccupants(st.family, beds.length)
  const checks = plan.rooms
    .map((r) => {
      const i = beds.indexOf(r)
      const people = i >= 0 ? occ[i] : 0
      const area = r.w * r.d
      return { room: r, area, people, check: checkRoom(r.kind, area, people, st.elaborate) }
    })
    .filter((c) => c.check)
  const enclosed = plan.rooms.filter((r) => ENCLOSED(r.kind))
  const floor = enclosed.reduce((a, r) => a + r.w * r.d, 0)
  const wallLen = enclosed.reduce((a, r) => a + 2 * (r.w + r.d), 0) / 1
  const minX = Math.min(...plan.rooms.map((r) => r.x))
  const maxX = Math.max(...plan.rooms.map((r) => r.x + r.w))
  const minZ = Math.min(...plan.rooms.map((r) => r.z))
  const maxZ = Math.max(...plan.rooms.map((r) => r.z + r.d))
  const longX = maxX - minX >= maxZ - minZ
  // bearing of the long axis (mod 180); E–W = 90
  const longBearing = (((longX ? st.orient : st.orient + 90) % 180) + 180) % 180
  const ewDev = Math.abs(longBearing - 90)
  const passes = checks.filter((c) => c.check!.ok).length
  const thatchOk = st.roof !== 'thatch' || (Math.abs(st.pitch - ROOMS.thatchSlopeDeg) <= 5 && st.wallH + st.plinth >= ROOMS.thatchEaveMin)
  const plinthOk = st.plinth >= ROOMS.floorRaise.min - 1e-6 && st.plinth <= ROOMS.floorRaise.max + 1e-6
  return {
    plan,
    occ,
    checks,
    passes,
    floor,
    wallArea: wallLen * st.wallH,
    extDoors: externalDoors(plan),
    bbox: { minX, maxX, minZ, maxZ },
    ewDev,
    ewOk: ewDev <= 20,
    thatchOk,
    plinthOk,
  }
}
