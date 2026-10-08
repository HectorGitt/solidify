/**
 * Harvesting, root-crop lifting and land-clearing relations (AEE501 / AEE502).
 *
 * Units: SI unless the name says otherwise. Capacities follow the AEE501 exam definitions:
 *   area capacity            ha/h of land worked
 *   commodity throughput     t/h of the wanted product (grain) handled
 *   total throughput         t/h of all material (grain + stalk + leaves) handled
 * Field capacity C = W·S·FE/10 (ha/h, W in m, S in km/h) is from MGMT p7–8.
 */
import { fieldCapacity } from './implements'

/* ------------------------------ Capacity (AEE501 2019/20 Q, SANDEL combine) ------------------------------ */

/** Hours actually worked in a season: annual hours × fraction of time working. */
export const hoursWorked = (annualHours: number, workingFraction: number) => annualHours * workingFraction

/** Commodity throughput capacity, t/h: mass of the wanted product ÷ hours worked. */
export const commodityThroughput = (totalMass: number, productFraction: number, hours: number) => (totalMass * productFraction) / hours

/** Total throughput capacity, t/h: all material handled ÷ hours worked. */
export const totalThroughput = (totalMass: number, hours: number) => totalMass / hours

/** Area harvested, ha, from the product mass and the product yield per hectare. */
export const areaFromYield = (productMass: number, yieldPerHa: number) => productMass / yieldPerHa

export interface CombineCapacityInput {
  /** total crop material handled in the season, t */
  totalMass: number
  /** fraction of that mass that is the product (grain) */
  productFraction: number
  annualHours: number
  /** fraction of the annual hours the machine actually worked */
  workingFraction: number
  /** product yield, t/ha */
  yieldPerHa: number
  /** header (cutter-bar) width, m */
  headerWidth: number
  /** width actually used, m */
  effectiveWidth: number
}

export interface CombineCapacity {
  hours: number
  productMass: number
  commodity: number
  total: number
  area: number
  /** effective area capacity, ha/h (area actually harvested per hour worked) */
  effectiveArea: number
  /** theoretical area capacity, ha/h (the full header width at the same speed) */
  theoreticalArea: number
  /** width efficiency We/W */
  widthEfficiency: number
  /** forward speed implied, km/h: S = 10·Ce/We */
  speedKmh: number
  /** total material per hectare, t/ha */
  totalPerHa: number
}

/**
 * The AEE501 2019/20 combine question worked end to end. Theoretical capacity uses the full
 * header width, effective capacity the width actually used, at the same forward speed.
 */
export function combineCapacity(p: CombineCapacityInput): CombineCapacity {
  const hours = hoursWorked(p.annualHours, p.workingFraction)
  const productMass = p.totalMass * p.productFraction
  const area = areaFromYield(productMass, p.yieldPerHa)
  const effectiveArea = area / hours
  const speedKmh = (10 * effectiveArea) / p.effectiveWidth
  const theoreticalArea = fieldCapacity(p.headerWidth, speedKmh)
  return {
    hours,
    productMass,
    commodity: commodityThroughput(p.totalMass, p.productFraction, hours),
    total: totalThroughput(p.totalMass, hours),
    area,
    effectiveArea,
    theoreticalArea,
    widthEfficiency: p.effectiveWidth / p.headerWidth,
    speedKmh,
    totalPerHa: p.yieldPerHa / p.productFraction,
  }
}

/** The SANDEL data (AEE501 2019/20 questions; part 5 exam). */
export const SANDEL: CombineCapacityInput = {
  totalMass: 10000,
  productFraction: 0.75,
  annualHours: 600,
  workingFraction: 0.85,
  yieldPerHa: 15,
  headerWidth: 6,
  effectiveWidth: 5.85,
}

/** Live machine feed: area capacity (ha/h) and material feed rates (t/h) at a forward speed. */
export function machineFeed(widthUsed: number, speedKmh: number, productYield: number, productFraction: number, FE = 1) {
  const area = fieldCapacity(widthUsed, speedKmh, FE)
  const instArea = fieldCapacity(widthUsed, speedKmh)
  const totalPerHa = productYield / productFraction
  return {
    area,
    /** while actually cutting (FE = 1) */
    grainRate: instArea * productYield,
    totalRate: instArea * totalPerHa,
    /** material other than grain (straw, chaff, leaves), t/h */
    mogRate: instArea * (totalPerHa - productYield),
  }
}

/* ------------------------------ Threshing and losses (beyond the notes' numbers) ------------------------------ */

/** Peripheral (rasp-bar tip) speed of a threshing cylinder, m/s: v = πDN/60. */
export const cylinderPeripheralSpeed = (diameter: number, rpm: number) => (Math.PI * diameter * rpm) / 60

export interface ThreshSetting {
  /** cylinder peripheral speed, m/s */
  speed: number
  /** cylinder–concave clearance at the front, mm */
  clearance: number
  /** fan speed as a fraction of its correct setting (1 = correct) */
  fan: number
  /** total feed rate ÷ the machine's rated feed (1 = rated) */
  load: number
}

export interface ThreshResult {
  /** % of grain cracked */
  cracked: number
  /** % of grain left in unthreshed heads (carried out with the straw) */
  unthreshed: number
  /** % of free grain carried over the straw walkers */
  walker: number
  /** % of grain blown out over the sieves with the chaff */
  shoe: number
  /** % of chaff and trash left in the clean grain (dockage) */
  dockage: number
  /** total grain loss % at the machine (unthreshed + walker + shoe) */
  totalLoss: number
}

const sig = (x: number) => 1 / (1 + Math.exp(-x))

/** Reference setting of the teaching model: 28 m/s rasp-bar speed at 12 mm clearance. */
export const THRESH_REF = { speed: 28, clearance: 12 }

/** Threshing severity (1 = the reference setting): rises with speed, falls with clearance. */
export const threshSeverity = (speed: number, clearance: number) => (speed / THRESH_REF.speed) * Math.sqrt(THRESH_REF.clearance / Math.max(2, clearance))

/**
 * Teaching model of a rasp-bar threshing unit and cleaning shoe. The notes give only the
 * directions (Table 19.1 and §18.5): faster cylinder or smaller clearance → more cracked grain,
 * the reverse → unthreshed heads; too little air → unclean grain and choked sieves, too much
 * → grain blown out with the chaff; overloading the walkers carries grain out with the straw.
 * The shapes and magnitudes are typical values for small grain (beyond the notes).
 */
export function threshing(s: ThreshSetting): ThreshResult {
  const sev = threshSeverity(s.speed, s.clearance)
  const unthreshed = 0.1 + 7 * sig(-8 * (sev - 0.6))
  const cracked = 0.2 + 8 * sig(8 * (sev - 1.35))
  // free grain carried over the walkers grows steeply with the straw load
  const L = Math.max(0.1, s.load)
  const walker = 0.15 + 0.6 * Math.pow(L, 3)
  const f = Math.max(0.2, s.fan)
  const shoe = 0.15 + 6 * sig(9 * (f - 1.3)) + 0.4 * Math.max(0, L - 1)
  const dockage = 0.3 + 8 * sig(9 * (0.75 - f))
  const totalLoss = unthreshed + walker + shoe
  return { cracked, unthreshed, walker, shoe, dockage, totalLoss }
}

export interface LossInput {
  /** losses in kg/ha */
  preHarvest: number
  header: number
  machine: number
  /** crop yield, kg/ha */
  yield: number
}

/** Loss percentages of the total crop available (yield + all losses). Beyond the notes. */
export function lossPercent(p: LossInput) {
  const available = p.yield + p.preHarvest + p.header + p.machine
  const pc = (x: number) => (100 * x) / available
  return { available, preHarvest: pc(p.preHarvest), header: pc(p.header), machine: pc(p.machine), total: pc(p.preHarvest + p.header + p.machine) }
}

/* ------------------------------ Root crops (AGRICULTURAL MACHINERIES §20) ------------------------------ */

/** Mechanical advantage of the tong-and-lever cassava lifter: about 400 N in → 1500 N lift. */
export const leverAdvantage = (output: number, input: number) => output / input

/** Volume of soil lifted by a digging blade, m³/h: width × depth × forward speed (beyond notes). */
export const soilLifted = (width: number, depth: number, speedKmh: number) => width * depth * speedKmh * 1000

/** Elevator-to-forward speed ratio. The notes require it to exceed 1 so soil is stripped off the tubers. */
export const elevatorRatio = (elevatorSpeed: number, forwardSpeed: number) => elevatorSpeed / forwardSpeed

/** Roots recovered per hectare, t/ha, for a recovery fraction (digger-elevator ≈ 0.85, manual ≈ 0.90). */
export const recovered = (yieldPerHa: number, fraction: number) => yieldPerHa * fraction

/* ------------------------------ Land clearing ------------------------------ */

/** Tree count strip of AGRICULTURAL MACHINERIES §11.2.2: 100 m line, 5 m each side = 1000 m² = 0.1 ha. */
export const STRIP = { length: 100, halfWidth: 5 }
export const stripAreaHa = (length = STRIP.length, halfWidth = STRIP.halfWidth) => (length * 2 * halfWidth) / 10000

/** Stems per hectare from a strip count. */
export const stemsPerHa = (count: number, length = STRIP.length, halfWidth = STRIP.halfWidth) => count / stripAreaHa(length, halfWidth)

/** Chaining limits (§11.3.5): trees ≤ 45 cm diameter and ≤ 2500 stems/ha. */
export const CHAIN_LIMIT = { diameterCm: 45, stemsPerHa: 2500 }

export function chainingSuitable(maxDiameterCm: number, density: number) {
  const sizeOk = maxDiameterCm <= CHAIN_LIMIT.diameterCm
  const densityOk = density <= CHAIN_LIMIT.stemsPerHa
  return { ok: sizeOk && densityOk, sizeOk, densityOk }
}

export const HA_PER_ACRE = 0.40468564
export const acresFromHa = (ha: number) => ha / HA_PER_ACRE

export interface ClearingOption {
  /** cost per acre (manual) — or 0 when hired by the day */
  perAcre?: number
  /** acres cleared per day */
  acresPerDay: number
  /** hire cost per day (machines) */
  perDay?: number
}

/** Cost and duration of clearing `acres` with one option (2018/19 marking guide, Q2c). */
export function clearingCost(acres: number, o: ClearingOption) {
  const days = acres / o.acresPerDay
  const cost = (o.perAcre ?? 0) * acres + (o.perDay ?? 0) * days
  return { days, daysWhole: Math.ceil(days - 1e-9), cost }
}

/**
 * The 2018/19 options: manual (slash ₦10,000 + stump ₦5,000 per acre; "4 people will clear 1 acre
 * in a day"), dozer (15 acres/day at ₦150,000/day) and bale loader (5 acres/day at ₦50,000/day).
 * Manual rate here is the crew of four clearing 1 acre/day together; the guide's 25 days assumes
 * 4 acres/day (each person clearing 1 acre) — see MANUAL_GUIDE.
 */
export const CLEARING_1819 = {
  manual: { perAcre: 15000, acresPerDay: 1 } as ClearingOption,
  dozer: { acresPerDay: 15, perDay: 150000 } as ClearingOption,
  baleLoader: { acresPerDay: 5, perDay: 50000 } as ClearingOption,
}

/** The marking guide's manual rate (100/4 = 25 days): four people each clearing 1 acre a day. */
export const MANUAL_GUIDE: ClearingOption = { perAcre: 15000, acresPerDay: 4 }
