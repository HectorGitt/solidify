/**
 * Field capacity and machinery costs — AEE501 Machinery Management MODULE 1
 * (Iowa State University PM 710, Nov 2001): Tables 1a/1b (salvage), Table 2 (capital recovery
 * factors), Table 3 (accumulated repairs), fuel, lubrication, labour and field capacity, p1–8.
 *
 * Money in the currency of the inputs; hours h; widths m or ft; speeds km/h or mph.
 */

/* ------------------------------ Table 1a / 1b: remaining salvage value, % of list ------------------------------ */

export type TractorClass = '30-79' | '80-149' | '150+' | 'combine'

/** Table 1a: rows = age 1–20; columns = annual hours (200/400/600; combine 100/300/500). */
export const TABLE_1A: Record<TractorClass, { hours: [number, number, number]; rows: [number, number, number][] }> = {
  '30-79': {
    hours: [200, 400, 600],
    rows: [
      [65, 60, 56], [59, 54, 50], [54, 49, 46], [51, 46, 43], [48, 43, 40], [45, 40, 37], [42, 38, 35], [40, 36, 33], [38, 34, 31], [36, 32, 30],
      [35, 31, 28], [33, 29, 27], [32, 28, 25], [30, 27, 24], [29, 25, 23], [28, 24, 22], [26, 23, 21], [25, 22, 20], [24, 21, 19], [23, 20, 18],
    ],
  },
  '80-149': {
    hours: [200, 400, 600],
    rows: [
      [69, 68, 68], [62, 62, 61], [57, 57, 56], [53, 53, 52], [50, 49, 49], [47, 46, 46], [44, 44, 43], [42, 41, 41], [40, 39, 39], [38, 37, 37],
      [36, 35, 35], [34, 34, 33], [33, 32, 32], [31, 31, 30], [30, 29, 29], [28, 28, 27], [27, 27, 26], [26, 25, 25], [25, 24, 24], [24, 23, 23],
    ],
  },
  '150+': {
    hours: [200, 400, 600],
    rows: [
      [69, 67, 66], [61, 59, 58], [55, 54, 52], [51, 49, 48], [47, 45, 44], [43, 42, 41], [40, 39, 38], [38, 36, 35], [35, 34, 33], [33, 32, 31],
      [31, 30, 29], [29, 28, 27], [27, 26, 25], [25, 24, 24], [24, 23, 22], [22, 21, 21], [21, 20, 19], [20, 19, 18], [19, 18, 17], [17, 17, 16],
    ],
  },
  combine: {
    hours: [100, 300, 500],
    rows: [
      [79, 69, 63], [67, 58, 52], [59, 50, 45], [52, 44, 39], [47, 39, 34], [42, 35, 30], [38, 31, 27], [35, 28, 24], [31, 25, 21], [28, 23, 19],
      [26, 20, 17], [23, 18, 15], [21, 16, 13], [19, 14, 12], [17, 13, 10], [16, 11, 9], [14, 10, 8], [13, 9, 7], [11, 8, 6], [10, 7, 5],
    ],
  },
}

export type ImplementClass = 'plows' | 'otherTillage' | 'planter' | 'mower' | 'baler' | 'swather' | 'vehicle' | 'others'

export const IMPLEMENT_CLASS_LABEL: Record<ImplementClass, string> = {
  plows: 'Plows',
  otherTillage: 'Other tillage',
  planter: 'Planter, drill, sprayer',
  mower: 'Mower, chopper',
  baler: 'Baler',
  swather: 'Swather, rake',
  vehicle: 'Vehicle',
  others: 'Others',
}

/** Table 1b: age 1–20 (no hour dependence). */
export const TABLE_1B: Record<ImplementClass, number[]> = {
  plows: [47, 44, 42, 40, 39, 38, 36, 35, 34, 33, 32, 32, 31, 30, 29, 29, 28, 27, 27, 26],
  otherTillage: [61, 54, 49, 45, 42, 39, 36, 34, 31, 30, 28, 26, 24, 23, 22, 20, 19, 18, 17, 16],
  planter: [65, 60, 56, 53, 50, 48, 46, 44, 42, 40, 39, 38, 36, 35, 34, 33, 32, 30, 29, 29],
  mower: [47, 44, 41, 39, 37, 35, 33, 32, 31, 30, 28, 27, 26, 26, 25, 24, 23, 22, 22, 21],
  baler: [56, 50, 46, 42, 39, 37, 34, 32, 30, 28, 27, 25, 24, 22, 21, 20, 19, 18, 17, 16],
  swather: [49, 44, 40, 37, 35, 32, 30, 28, 27, 25, 24, 23, 21, 20, 19, 18, 17, 16, 16, 15],
  vehicle: [42, 39, 36, 34, 33, 31, 30, 29, 27, 26, 25, 24, 24, 23, 22, 21, 20, 20, 19, 19],
  others: [69, 62, 56, 52, 48, 45, 42, 40, 37, 35, 33, 31, 29, 28, 26, 25, 24, 22, 21, 20],
}

const clampAge = (age: number) => Math.min(20, Math.max(1, Math.round(age)))

/** Table 1a remaining value (%), linear between the annual-hour columns (clamped at the ends). */
export function tractorSalvagePct(cls: TractorClass, age: number, annualHours: number) {
  const t = TABLE_1A[cls]
  const row = t.rows[clampAge(age) - 1]
  const [h0, h1, h2] = t.hours
  if (annualHours <= h0) return row[0]
  if (annualHours >= h2) return row[2]
  if (annualHours <= h1) return row[0] + ((row[1] - row[0]) * (annualHours - h0)) / (h1 - h0)
  return row[1] + ((row[2] - row[1]) * (annualHours - h1)) / (h2 - h1)
}

export function implementSalvagePct(cls: ImplementClass, age: number) {
  return TABLE_1B[cls][clampAge(age) - 1]
}

/* ------------------------------ Table 2: capital recovery ------------------------------ */

/** CRF = i(1 + i)ⁿ / ((1 + i)ⁿ − 1). Table 2 prints it to 3 decimals; `table` reproduces that rounding. */
export function crf(i: number, years: number, table = true) {
  const v = i === 0 ? 1 / years : (i * (1 + i) ** years) / ((1 + i) ** years - 1)
  return table ? Math.round(v * 1000) / 1000 : v
}

/** Real interest = nominal − inflation (p3: 8 % − 3 % = 5 %). */
export const realRate = (nominal: number, inflation: number) => nominal - inflation

/** Capital recovery = (purchase − salvage) × CRF + salvage × i. */
export function capitalRecovery(purchase: number, salvage: number, crfValue: number, i: number) {
  return (purchase - salvage) * crfValue + salvage * i
}

/** Taxes, insurance and housing: 1 % of purchase price per year (the 2015 revision uses the average value). */
export const tih = (purchase: number, rate = 0.01) => rate * purchase

/* ------------------------------ Table 3: accumulated repairs ------------------------------ */

export interface RepairRow {
  label: string
  hours: number[]
  pct: number[]
}

const H1 = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]
const H2 = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000]
const H3 = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
const H4 = [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000]

export const TABLE_3 = {
  tractor2wd: { label: 'Two-wheel drive tractor', hours: H1, pct: [1, 3, 6, 11, 18, 25, 34, 45, 57, 70] },
  tractor4wd: { label: 'Four-wheel drive tractor', hours: H1, pct: [0, 1, 3, 5, 8, 11, 15, 19, 24, 30] },
  moldboardPlow: { label: 'Moldboard plow', hours: H2, pct: [2, 6, 12, 19, 29, 40, 53, 68, 84, 101] },
  heavyDisk: { label: 'Heavy-duty disk', hours: H2, pct: [1, 4, 8, 12, 18, 25, 32, 40, 49, 58] },
  tandemDisk: { label: 'Tandem disk', hours: H2, pct: [1, 4, 8, 12, 18, 25, 32, 40, 49, 58] },
  chiselPlow: { label: 'Chisel plow', hours: H2, pct: [3, 8, 14, 20, 28, 36, 45, 54, 64, 74] },
  fieldCultivator: { label: 'Field cultivator', hours: H2, pct: [3, 7, 13, 20, 27, 35, 43, 52, 61, 71] },
  harrow: { label: 'Harrow', hours: H2, pct: [3, 7, 13, 20, 27, 35, 43, 52, 61, 71] },
  rowCropPlanter: { label: 'Row crop planter', hours: H3, pct: [0, 1, 3, 5, 7, 11, 15, 20, 26, 32] },
  grainDrill: { label: 'Grain drill', hours: H3, pct: [0, 1, 3, 5, 7, 11, 15, 20, 26, 32] },
  rotaryTiller: { label: 'Rotary tiller', hours: H3, pct: [0, 1, 3, 6, 9, 13, 18, 23, 29, 36] },
  mowerSickle: { label: 'Mower (sickle)', hours: H3, pct: [1, 3, 6, 10, 14, 19, 25, 31, 38, 46] },
  boomSprayer: { label: 'Boom-type sprayer', hours: H2, pct: [5, 12, 21, 31, 41, 52, 63, 76, 88, 101] },
  combineSP: { label: 'Combine (SP)', hours: H4, pct: [0, 1, 3, 6, 9, 14, 19, 25, 32, 40] },
} satisfies Record<string, RepairRow>

export type RepairKey = keyof typeof TABLE_3

/** Accumulated repairs (% of list) at accumulated hours h — linear in the table, from 0 % at 0 h. */
export function repairPct(key: RepairKey, h: number) {
  const r: RepairRow = TABLE_3[key]
  const hs = [0, ...r.hours]
  const ps = [0, ...r.pct]
  if (h <= 0) return 0
  for (let i = 1; i < hs.length; i++) {
    if (h <= hs[i]) return ps[i - 1] + ((ps[i] - ps[i - 1]) * (h - hs[i - 1])) / (hs[i] - hs[i - 1])
  }
  // beyond the table: extend the last slope
  const n = hs.length - 1
  return ps[n] + ((ps[n] - ps[n - 1]) * (h - hs[n])) / (hs[n] - hs[n - 1])
}

/** Repair cost per hour between accumulated hours h0 and h1 (used machines start at h0 > 0). */
export function repairPerHour(key: RepairKey, list: number, h0: number, h1: number) {
  return (((repairPct(key, h1) - repairPct(key, h0)) / 100) * list) / (h1 - h0)
}

/* ------------------------------ operating costs ------------------------------ */

/** Average fuel use, gal/h: 0.044 × max PTO hp (diesel), 0.060 × (gasoline). */
export const fuelGalPerHour = (ptoHp: number, fuel: 'diesel' | 'gasoline' = 'diesel') => (fuel === 'diesel' ? 0.044 : 0.06) * ptoHp
/** Lubrication ≈ 15 % of fuel cost. */
export const lubrication = (fuelCost: number) => 0.15 * fuelCost
/** Labour = wage × 1.1–1.2 (travel, servicing). */
export const labour = (wage: number, factor = 1.1) => wage * factor

/* ------------------------------ whole-machine estimate ------------------------------ */

export interface MachineInput {
  list: number
  purchase: number
  /** years the machine will be kept */
  years: number
  hoursPerYear: number
  /** remaining value at the end, as a fraction of list (from Table 1a/1b) */
  salvagePct: number
  /** real interest rate (fraction) */
  i: number
  repair: RepairKey
  /** accumulated hours when bought (0 for new) */
  hoursAtPurchase?: number
  tihRate?: number
  /** power unit only: fuel/lube/labour */
  ptoHp?: number
  fuelPrice?: number
  wage?: number
  labourFactor?: number
  /** use Table 2 rounding (3 decimals) for the CRF */
  tableCrf?: boolean
}

export interface MachineCosts {
  salvage: number
  depreciation: number
  crf: number
  capitalRecovery: number
  tih: number
  ownershipYear: number
  ownershipHour: number
  hoursEnd: number
  repairHour: number
  fuelGal: number
  fuelHour: number
  lubeHour: number
  labourHour: number
  operatingHour: number
  totalHour: number
}

/** ISU PM 710 worksheet for one machine. */
export function machineCosts(m: MachineInput): MachineCosts {
  const salvage = (m.salvagePct / 100) * m.list
  const depreciation = m.purchase - salvage
  const f = crf(m.i, m.years, m.tableCrf ?? true)
  const cr = capitalRecovery(m.purchase, salvage, f, m.i)
  const t = tih(m.purchase, m.tihRate)
  const ownershipYear = cr + t
  const ownershipHour = ownershipYear / m.hoursPerYear
  const h0 = m.hoursAtPurchase ?? 0
  const hoursEnd = h0 + m.hoursPerYear * m.years
  const repairHour = repairPerHour(m.repair, m.list, h0, hoursEnd)
  const fuelGal = m.ptoHp ? fuelGalPerHour(m.ptoHp) : 0
  const fuelHour = fuelGal * (m.fuelPrice ?? 0)
  const lubeHour = lubrication(fuelHour)
  const labourHour = m.wage ? labour(m.wage, m.labourFactor) : 0
  const operatingHour = repairHour + fuelHour + lubeHour + labourHour
  return {
    salvage,
    depreciation,
    crf: f,
    capitalRecovery: cr,
    tih: t,
    ownershipYear,
    ownershipHour,
    hoursEnd,
    repairHour,
    fuelGal,
    fuelHour,
    lubeHour,
    labourHour,
    operatingHour,
    totalHour: ownershipHour + operatingHour,
  }
}

/* ------------------------------ field capacity ------------------------------ */

/** Effective field capacity, ac/h = W(ft) × S(mph) × FE / 8.25. */
export const capacityAcres = (Wft: number, Smph: number, FE: number) => (Wft * Smph * FE) / 8.25
/** Effective field capacity, ha/h = W(m) × S(km/h) × FE / 10. */
export const capacityHa = (Wm: number, Skmh: number, FE: number) => (Wm * Skmh * FE) / 10

export const FT = 0.3048
export const MILE_KM = 1.609344
export const ACRE_HA = 0.40468564

/**
 * Field-efficiency model of one plot worked in lands (straight passes joined by headland turns).
 * Theoretical time = area / (W·S); actual time adds turning, overlap (narrower effective width)
 * and other delays (adjustments, filling/emptying) as a fraction of working time.
 */
export interface PlotInput {
  /** implement width, m */
  W: number
  /** km/h */
  S: number
  /** overlap fraction of W */
  overlap: number
  /** pass length, m */
  L: number
  passes: number
  /** time per headland turn, s (including lift/lower) */
  turnTimes: number[]
  /** other delays as a fraction of the time spent working */
  otherFrac: number
}

export function plotEfficiency(p: PlotInput) {
  const v = p.S / 3.6
  const wEff = p.W * (1 - p.overlap)
  const area = p.L * wEff * p.passes // m² actually covered once
  const work = (p.passes * p.L) / v
  const turns = p.turnTimes.reduce((s, t) => s + t, 0)
  const other = work * p.otherFrac
  const actual = work + turns + other
  const theoretical = area / (p.W * v)
  const FE = theoretical / actual
  return { area, work, turns, other, actual, theoretical, FE, Ce: area / 1e4 / (actual / 3600), Ct: (p.W * p.S) / 10 }
}
