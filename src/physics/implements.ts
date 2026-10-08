/**
 * Field-implement relations (AEE502 AGRICULTURAL MACHINERIES §12–15; AEE501 MGMT p7–8).
 * Pure functions in SI units unless a name says otherwise (the notes work in cm², km/h, L/ha).
 */

const { PI, sqrt, sin, cos, max, min } = Math

/** one metric horsepower, W (75 kgf·m/s) */
export const METRIC_HP = 75 * 9.80665

/* ------------------------------ plough draft ------------------------------ */

/** Unit draft of soil, N/cm² of furrow cross-section (AEE502 §12: sand ≈ 1, clay ≈ 2). */
export const UNIT_DRAFT = { sand: 1, clay: 2 } as const

/** Furrow cross-section of `bottoms` bodies each cutting width w (m) at depth d (m), cm². */
export function furrowAreaCm2(width: number, depth: number, bottoms = 1) {
  return width * 100 * depth * 100 * bottoms
}

/** Plough draft, N = unit draft (N/cm²) × furrow area (cm²). */
export function ploughDraft(unitDraft: number, width: number, depth: number, bottoms = 1) {
  return unitDraft * furrowAreaCm2(width, depth, bottoms)
}

/** Drawbar power to pull a draft (N) at v (m/s), W. */
export const drawbarPower = (draft: number, v: number) => draft * v

export const kmhToMs = (kmh: number) => kmh / 3.6

/* ------------------------------ disc geometry ------------------------------ */

/**
 * Half-length of the chord a disc of radius R cuts at vertical depth d when its face is tilted
 * β from vertical: the depth measured in the disc plane is d/cos β. Beyond notes (geometry).
 */
export function discHalfChord(R: number, depth: number, tilt: number) {
  const s = min(2 * R, depth / max(1e-6, cos(tilt)))
  return sqrt(max(0, R * R - (R - s) * (R - s)))
}

/**
 * Lateral reach of the disc's soil-engaging chord across the line of travel, m: the chord lies
 * along the horizontal line of the disc face, which makes the disc angle α with the travel
 * direction, plus the sideways lean of the tilted disc over the depth. Beyond notes (geometry).
 */
export function discCutWidth(R: number, depth: number, discAngle: number, tilt: number) {
  return 2 * discHalfChord(R, depth, tilt) * sin(discAngle) + depth * Math.tan(tilt)
}

/** Unit normal of the concave face for disc angle α (to travel, +x) and tilt β (to vertical); +z is left, soil thrown right. */
export function discNormal(discAngle: number, tilt: number): [number, number, number] {
  return [sin(discAngle) * cos(tilt), -sin(tilt), -cos(discAngle) * cos(tilt)]
}

/* ------------------------------ rotary cultivator ------------------------------ */

/**
 * Bite length of a rotavator, m: the forward advance between successive blades on one flange,
 * l = v / (n·Z) with v in m/s, n in rev/s and Z blades per flange. Beyond notes (standard result).
 */
export function biteLength(v: number, rotorRpm: number, bladesPerFlange: number) {
  return (v * 60) / (rotorRpm * bladesPerFlange)
}

/** Ratio of blade-tip speed to forward speed λ = ωR/v (must exceed 1 for the blades to cut backwards). Beyond notes. */
export function tipSpeedRatio(v: number, rotorRpm: number, R: number) {
  return ((rotorRpm * 2 * PI) / 60) * R / v
}

/* ------------------------------ seed drill ------------------------------ */

/** Drill width W = number of openers × row spacing, m (size stated as e.g. 5 × 150 mm). */
export const drillWidth = (rows: number, spacing: number) => rows * spacing

/** Distance to travel to cover A hectares with width W (m): L = 10000·A/W, m. */
export const calibrationLength = (areaHa: number, width: number) => (10000 * areaHa) / width

/** Ground-wheel revolutions over L metres for wheel diameter D: N = L/(πD). */
export const wheelRevs = (L: number, D: number) => L / (PI * D)

/** Seed to collect from each tube for area A (ha) at rate R (kg/ha), kg. */
export const seedPerTube = (rateKgHa: number, areaHa: number, rows: number) => (rateKgHa * areaHa) / rows

/** Seed-drill calibration in one go (AEE502 §13 worked example). */
export function drillCalibration(rows: number, spacing: number, rateKgHa: number, D: number, areaHa = 0.1) {
  const W = drillWidth(rows, spacing)
  const L = calibrationLength(areaHa, W)
  const N = wheelRevs(L, D)
  return { W, L, N, perTube: seedPerTube(rateKgHa, areaHa, rows), total: rateKgHa * areaHa }
}

/** Planter seed spacing along the row, m: one plate revolution per `ratio` wheel revolutions drops `cells` seeds. Beyond notes. */
export function plateSeedSpacing(wheelD: number, ratio: number, cells: number) {
  return (PI * wheelD * ratio) / cells
}

/* ------------------------------ sprayer ------------------------------ */

/** Nozzle flow scales with √pressure: q2 = q1·√(p2/p1). */
export const nozzleFlow = (q1: number, p1: number, p2: number) => q1 * sqrt(p2 / p1)

/** Pressure needed for flow q2 from a nozzle giving q1 at p1: p2 = p1·(q2/q1)². */
export const pressureForFlow = (q1: number, p1: number, q2: number) => p1 * (q2 / q1) ** 2

/**
 * Application rate, L/ha, for total boom flow Q (L/min), swath W (m) and speed S (km/h):
 * rate = 600·Q/(W·S). Beyond notes as a formula; the notes state that doubling the speed halves it.
 */
export const applicationRate = (Qlmin: number, W: number, Skmh: number) => (600 * Qlmin) / (W * Skmh)

/** Boom calibration run for 0.1 ha (1000 m²): L = 1000/W, m. */
export const boomCalibLength = (W: number, areaHa = 0.1) => ((1000 / W) * areaHa) / 0.1

/* ------------------------------ ULV / CDA ------------------------------ */

/** Work rate of a walked ULV sprayer, ha/h = v (m/s) × swath (m) × 3600 / 10000. */
export const ulvCapacity = (v: number, swath: number) => (v * swath * 3600) / 10000

/** Droplets per cm² when Vlha litres per hectare are applied as droplets of diameter d (m). */
export function dropletsPerCm2(Vlha: number, d: number) {
  const vDrop = (PI / 6) * d ** 3
  return (Vlha * 1e-3) / vDrop / 1e8
}

/* ------------------------------ field capacity ------------------------------ */

/** Effective field capacity, ha/h: C = W(m)·S(km/h)·FE/10 (AEE501 MGMT p8). */
export const fieldCapacity = (W: number, Skmh: number, FE = 1) => (W * Skmh * FE) / 10
