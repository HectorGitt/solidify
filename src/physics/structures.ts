/**
 * Farm structures (farmstead planning, dwellings, machinery storage, greenhouses).
 *
 * The notes give rules and dimensions rather than equations; they are collected here as
 * typed constants and small checks in SI units. Anything not in the notes is marked
 * "beyond the notes" in its doc comment.
 */

export const FT = 0.3048
export const ft = (v: number) => v * FT

/* ------------------------------ farmstead ------------------------------ */

/** Zone widths are 10–30 m per ring. */
export const ZONE_WIDTH = { min: 10, max: 30 } as const

export const ZONES = [
  { n: 1, name: 'Family living', short: 'Dwelling', what: 'Family living and the dwelling, protected from odour, dust, flies and erosion.' },
  { n: 2, name: 'Machinery & workshop', short: 'Machinery', what: 'Implement and machinery storage and the farm workshop (clean, dry, quiet).' },
  { n: 3, name: 'Grain, feed & small animals', short: 'Grain & feed', what: 'Grain and feed storage and small animal units.' },
  { n: 4, name: 'Livestock', short: 'Livestock', what: 'Livestock buildings and large-scale animal production, and beyond.' },
] as const

/** Farmstead should take no more than about 5 % of the production area. */
export const FARMSTEAD_MAX_FRACTION = 0.05

/**
 * Nested zone circles, all tangent to the main road at one point: circle k has radius
 * r_k = r_(k−1) + w_k and its centre lies r_k along the layout axis from the road.
 */
export function zoneRadii(widths: number[]) {
  const r: number[] = []
  let acc = 0
  for (const w of widths) {
    acc += w
    r.push(acc)
  }
  return r
}

export const zoneWidthOk = (w: number) => w >= ZONE_WIDTH.min - 1e-9 && w <= ZONE_WIDTH.max + 1e-9

/**
 * Prevailing wind given as the compass bearing it blows FROM (°, clockwise from north).
 * Returns the angle (°, 0–180) between the direction the wind blows TOWARDS and the layout
 * axis bearing (dwelling → livestock). 0° means livestock dead downwind of the dwelling.
 */
export function windAxisAngle(windFromDeg: number, axisBearingDeg = 0) {
  const toward = windFromDeg + 180
  let d = (((toward - axisBearingDeg) % 360) + 360) % 360
  if (d > 180) d = 360 - d
  return d
}

export type WindVerdict = 'good' | 'crosswind' | 'bad'
/** Livestock downwind of the dwelling (rule); crosswind within 45–90°, bad when odour blows to the house. */
export function windVerdict(angleDeg: number): WindVerdict {
  return angleDeg <= 45 ? 'good' : angleDeg <= 90 + 1e-9 ? 'crosswind' : 'bad'
}

/**
 * Whether a point lies inside an odour plume — a cone of half-angle `halfAngleDeg` and length
 * `length` downwind of the source. Plan coordinates (x east, y north). Beyond the notes (illustration).
 */
export function inPlume(src: [number, number], windFromDeg: number, pt: [number, number], halfAngleDeg = 22, length = 400) {
  const a = ((windFromDeg + 180) * Math.PI) / 180
  const dir = [Math.sin(a), Math.cos(a)]
  const v = [pt[0] - src[0], pt[1] - src[1]]
  const along = v[0] * dir[0] + v[1] * dir[1]
  if (along <= 0 || along > length) return false
  const across = Math.abs(v[0] * dir[1] - v[1] * dir[0])
  return across <= along * Math.tan((halfAngleDeg * Math.PI) / 180)
}

/** Site selection criteria (a–l) for Nigeria. */
export const SITE_CRITERIA = [
  { id: 'a', label: 'Soil quality', hint: 'Soil test for nutrients, pH and texture; avoid saline or poorly drained land.' },
  { id: 'b', label: 'Climate', hint: 'Suits the intended crops and stock.' },
  { id: 'c', label: 'Water availability', hint: 'River, borehole or groundwater; harvest water where rainfall is erratic.' },
  { id: 'd', label: 'Access & infrastructure', hint: 'Roads, ports and markets.' },
  { id: 'e', label: 'Land ownership', hint: 'Verify title under the Land Use Act 1978 and customary rights; obtain permits.' },
  { id: 'f', label: 'Security', hint: 'Theft and farmer–herder conflict; fencing and guards.' },
  { id: 'g', label: 'Labour supply', hint: 'Workers available nearby.' },
  { id: 'h', label: 'Topography & drainage', hint: 'Flat to gently sloping; steep slopes need terracing.' },
  { id: 'i', label: 'Environmental sustainability', hint: 'No deforestation or wetland encroachment.' },
  { id: 'j', label: 'Market demand', hint: 'Demand for, and suitability of, the crops.' },
  { id: 'k', label: 'Utilities', hint: 'Grid or solar power, telecoms.' },
  { id: 'l', label: 'Future expansion', hint: 'Room to grow.' },
] as const

/* ------------------------------ drives and parking ------------------------------ */

export const DRIVES = {
  twoWay: { min: ft(16), max: ft(20) },
  oneWay: ft(12),
  stall: { w: ft(12), l: ft(60) },
  turningRadius: { min: ft(40), max: ft(50) },
} as const

export type DriveVerdict = 'too narrow' | 'one-way' | 'two-way' | 'wide'
export function driveVerdict(width: number): DriveVerdict {
  if (width < DRIVES.oneWay - 1e-6) return 'too narrow'
  if (width < DRIVES.twoWay.min - 1e-6) return 'one-way'
  if (width <= DRIVES.twoWay.max + 1e-6) return 'two-way'
  return 'wide'
}

/** n large-vehicle stalls side by side: total width and depth (m). */
export const parkingBlock = (n: number) => ({ w: n * DRIVES.stall.w, l: DRIVES.stall.l, area: n * DRIVES.stall.w * DRIVES.stall.l })

/** Cleared turning pad diameter for a turning radius (m). */
export const turningPad = (radius: number) => 2 * radius

/* ------------------------------ dwelling ------------------------------ */

export const ROOMS = {
  bedroomMin: 9,
  bedroomPerPerson: 3,
  living: { min: 12, max: 15 },
  livingElaborate: { min: 25, max: 30 },
  office: 9,
  washSlabMin: 3,
  floorRaise: { min: 0.1, max: 0.15 },
  thatchSlopeDeg: 45,
  thatchEaveMin: 2,
} as const

/** Minimum bedroom area: at least 9 m² and at least 3 m² per occupant. */
export const bedroomMinArea = (occupants: number) => Math.max(ROOMS.bedroomMin, ROOMS.bedroomPerPerson * occupants)

export type RoomKind = 'bedroom' | 'living' | 'kitchen' | 'store' | 'office' | 'wash' | 'animals' | 'corridor' | 'veranda' | 'yard' | 'multi'

export interface RoomCheck {
  ok: boolean
  need: string
}

/** Check one room against the area rules. `multi` rooms are slept in, so they follow the bedroom rule. */
export function checkRoom(kind: RoomKind, area: number, occupants = 0, elaborate = false): RoomCheck | null {
  switch (kind) {
    case 'bedroom':
    case 'multi': {
      const m = bedroomMinArea(occupants)
      return { ok: area >= m - 1e-6, need: `≥ ${m} m²` }
    }
    case 'living': {
      const r = elaborate ? ROOMS.livingElaborate : ROOMS.living
      return { ok: area >= r.min - 1e-6, need: `${r.min}–${r.max} m²` }
    }
    case 'office':
      return { ok: area >= ROOMS.office * 0.85, need: `≈ ${ROOMS.office} m²` }
    case 'wash':
      return { ok: area >= ROOMS.washSlabMin - 1e-6, need: `≥ ${ROOMS.washSlabMin} m²` }
    default:
      return null
  }
}

/** Split a family among bedrooms: two adults in the first, the rest round-robin. */
export function allocateOccupants(family: number, bedrooms: number): number[] {
  if (bedrooms <= 0) return []
  const out = Array.from({ length: bedrooms }, () => 0)
  if (bedrooms === 1) {
    out[0] = family
    return out
  }
  out[0] = Math.min(2, family)
  let rest = family - out[0]
  let i = 1
  while (rest > 0) {
    out[i]++
    rest--
    i = i + 1 >= bedrooms ? 1 : i + 1
  }
  return out
}

/* ------------------------------ workshop & machinery storage ------------------------------ */

export const WORKSHOP = {
  bench: { h: 1.0, dMax: 0.8, lMin: 3.0 },
  /** a timber lifting beam will do up to this span; otherwise a truss or portable hoist */
  timberBeamMaxSpan: 3.0,
  sandBuckets: [2, 3],
} as const

export const liftingGear = (span: number) => (span <= WORKSHOP.timberBeamMaxSpan + 1e-9 ? 'timber beam' : 'truss or portable hoist')

export function benchOk(h: number, d: number, l: number) {
  return Math.abs(h - WORKSHOP.bench.h) <= 0.05 && d <= WORKSHOP.bench.dMax + 1e-9 && l >= WORKSHOP.bench.lMin - 1e-9
}

/** Machine envelopes (L × W × H, m). Typical sizes; the tractor is the shared Farmland tractor with its ROPS frame. */
export const MACHINES = {
  tractor: { name: 'Tractor', l: 3.4, w: 1.85, h: 2.45 },
  plough: { name: '3-furrow mouldboard plough', l: 2.2, w: 1.3, h: 1.3 },
  harrow: { name: 'Disc harrow', l: 2.4, w: 2.4, h: 1.0 },
  trailer: { name: 'Farm trailer', l: 4.2, w: 2.0, h: 1.5 },
} as const
export type MachineKey = keyof typeof MACHINES

/**
 * Clear opening for a machine: its width/height plus a clearance each side / overhead.
 * The notes require "wide and high enough"; the clearance values are typical (beyond the notes).
 */
export function doorFor(m: { w: number; h: number }, sideClear: number, headClear: number) {
  return { w: m.w + 2 * sideClear, h: m.h + headClear }
}

/**
 * Open-fronted shed with one bay per machine, nose-in, so no machine has to be shifted to get
 * another out. Bay width = machine width + 2 × clearance; depth = longest machine + clearance;
 * eave height = tallest machine + head clearance.
 */
export function shedSize(keys: MachineKey[], sideClear: number, headClear: number, endClear = 0.6) {
  const bays = keys.map((k) => MACHINES[k].w + 2 * sideClear)
  const depth = Math.max(...keys.map((k) => MACHINES[k].l)) + endClear
  const height = Math.max(...keys.map((k) => MACHINES[k].h)) + headClear
  const width = bays.reduce((a, b) => a + b, 0)
  return { bays, width, depth, height, area: width * depth }
}

/* ------------------------------ hazardous stores ------------------------------ */

/** Above these volumes (L) a material needs a separate building at least 15 m from any other. */
export const HAZARD_LIMITS = { thinner: 3, petrol: 10, kerosene: 20, diesel: 50 } as const
export type HazardKey = keyof typeof HAZARD_LIMITS
export const HAZARD_SEPARATION = 15

export function needsSeparateStore(v: Partial<Record<HazardKey, number>>) {
  const over = (Object.keys(HAZARD_LIMITS) as HazardKey[]).filter((k) => (v[k] ?? 0) > HAZARD_LIMITS[k])
  return { required: over.length > 0, over }
}

/* ------------------------------ greenhouse ------------------------------ */

export type Cladding = 'glass' | 'polythene'

export const GREENHOUSE = {
  bay: 3.2,
  lengthPerSpan: { min: 4, max: 5 },
  gutter: { min: 2.8, max: 3.0 },
  eaveMinSingle: 2.0,
  /** ventilation per m² floor (m³/s per m²) to keep the temperature rise below 4 °C */
  vent: { glass: { min: 0.04, max: 0.05 }, polythene: { min: 0.03, max: 0.04 } } as Record<Cladding, { min: number; max: number }>,
  maxRise: 4,
  doorFraction: { min: 0.03, max: 0.07 },
  transmission: { glass: 0.9, polythene: 0.9, frp: 0.85 },
  glassPane: { widths: [0.61, 0.73], thickness: 0.004, printedMass: 2.8 },
} as const

export const ventRateMid = (c: Cladding) => (GREENHOUSE.vent[c].min + GREENHOUSE.vent[c].max) / 2

/** Required airflow Q = rate × floor area (m³/s). */
export const ventFlow = (rate: number, floorArea: number) => rate * floorArea

export const fansNeeded = (Q: number, fanCapacity: number) => Math.ceil(Q / fanCapacity - 1e-9)

/** Natural ventilation: end-door area 3–7 % of the floor. */
export const doorAreaRange = (floorArea: number) => ({ min: GREENHOUSE.doorFraction.min * floorArea, max: GREENHOUSE.doorFraction.max * floorArea })

/** Cost-optimal length range for a span (4–5 × span). */
export const lengthRange = (span: number) => ({ min: GREENHOUSE.lengthPerSpan.min * span, max: GREENHOUSE.lengthPerSpan.max * span })

export const AIR = { rho: 1.2, cp: 1006 } as const

/** Sensible heat carried out by ventilation q = ρ·c_p·Q·ΔT (W). Beyond the notes. */
export const ventHeat = (Q: number, dT: number) => AIR.rho * AIR.cp * Q * dT

/** Temperature rise for a sensible heat load q (W) at airflow Q (m³/s): ΔT = q/(ρ·c_p·Q). Beyond the notes. */
export const riseFor = (q: number, Q: number) => (Q > 0 ? q / (AIR.rho * AIR.cp * Q) : Infinity)

/**
 * Sensible solar load on the floor (W/m²): irradiance × transmission × (1 − shading) × fraction
 * that ends up heating the air. Beyond the notes; the default fraction (0.3 glass) is chosen so the
 * notes' 0.045 m³/s·m² keeps the rise at ≈ 4 °C under 800 W/m². Polythene passes long-wave
 * radiation back out, modelled as a lower fraction (0.23).
 */
export const SOLAR = { irradiance: 800, gain: { glass: 0.3, polythene: 0.23 } as Record<Cladding, number> } as const
export function solarLoad(irr: number, cladding: Cladding, shading = 0) {
  return irr * GREENHOUSE.transmission[cladding] * (1 - shading) * SOLAR.gain[cladding]
}

/** Glazing areal mass (kg/m²) = density × thickness. 4 mm glass ≈ 10 kg/m² (the notes print 2.8). */
export const DENSITY = { glass: 2500, polythene: 920 } as const
export const arealMass = (density: number, thickness: number) => density * thickness
