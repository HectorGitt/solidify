/**
 * Tillage and planting relations: plough draft and work, field capacity, seed-drill and planter
 * calibration, disc and rotavator geometry, and the virtual-hitch-point test.
 *
 * Sources: AEE502 AGRICULTURAL MACHINERIES.docx §12–13 and the 2018/19 marking guide; AEE501
 * Machinery Management MODULE 1 (ISU PM 710) p7–8; Macmillan Ch 6 Fig 6.5 (virtual hitch point).
 * Pure functions, SI units unless a name says otherwise (the notes work in cm², km/h, kg/ha).
 *
 * Builds on src/physics/implements.ts (draft, disc geometry, drill calibration), re-exported here
 * so the tillage scenes import from one place.
 */
import { METRIC_HP, drawbarPower, fieldCapacity, furrowAreaCm2, kmhToMs, ploughDraft } from './implements'

export {
  METRIC_HP,
  UNIT_DRAFT,
  biteLength,
  calibrationLength,
  discCutWidth,
  discHalfChord,
  discNormal,
  drawbarPower,
  drillCalibration,
  drillWidth,
  fieldCapacity,
  furrowAreaCm2,
  kmhToMs,
  plateSeedSpacing,
  ploughDraft,
  seedPerTube,
  tipSpeedRatio,
  wheelRevs,
} from './implements'

const { PI, sin, cos, hypot } = Math
const deg = PI / 180

/* ------------------------------ units ------------------------------ */

export const FT = 0.3048
export const MILE_KM = 1.609344
export const ACRE_HA = 0.40468564224

/** Power in metric horsepower (75 kgf·m/s). */
export const metricHp = (watts: number) => watts / METRIC_HP

/* ------------------------------ plough draft, power and work ------------------------------ */

/** Everything the notes ask for a plough: area, draft, power at speed (km/h) and metric hp. */
export function ploughPerformance(unitDraft: number, width: number, depth: number, bottoms: number, speedKmh: number) {
  const A = furrowAreaCm2(width, depth, bottoms)
  const D = ploughDraft(unitDraft, width, depth, bottoms)
  const v = kmhToMs(speedKmh)
  const P = drawbarPower(D, v)
  return { A, D, v, P, hp: metricHp(P) }
}

/** Distance (m) a machine of working width W (m) travels to cover A hectares: 10 000·A/W. */
export const travelForArea = (W: number, areaHa = 1) => (10000 * areaHa) / W

/** Work (J) to plough A hectares: draft × distance travelled, with the plough's full width of cut W. */
export const ploughWork = (draft: number, W: number, areaHa = 1) => draft * travelForArea(W, areaHa)

/* ------------------------------ centre of draft ------------------------------ */

/**
 * Centre of draft of a mouldboard plough: about 5 cm in from the landside at the top of the share
 * for each bottom (AEE502 §12.3). With several bottoms it is the mean of the bottoms' centres —
 * under the beam for one bottom, halfway between the beams for two, at the centre for three.
 * `landsides` are the landside z of each bottom; the share cuts towards −z.
 */
export function centreOfDraftZ(landsides: number[], inset = 0.05) {
  return landsides.reduce((s, z) => s + (z - inset), 0) / landsides.length
}

/** Mouldboard suction (vertical and horizontal clearance), cm, from the notes (§12.2.1). */
export const SUCTION_CM = { min: 0.48, max: 1.25 } as const

export function suctionStatus(cm: number): 'low' | 'ok' | 'high' {
  return cm < SUCTION_CM.min ? 'low' : cm > SUCTION_CM.max ? 'high' : 'ok'
}

/** Disc plough angle ranges in the notes (§12.2.2), degrees. */
export const DISC_ANGLES = { tilt: [15, 25], disc: [42, 45] } as const

/* ------------------------------ virtual hitch point ------------------------------ */

export type P2 = { x: number; y: number }

/**
 * Perpendicular height of a line of soil force above the virtual hitch point V (Macmillan Fig 6.5).
 * The line passes through P with direction `dir` (the direction the soil force acts on the
 * implement: rearward, x < 0). Positive = the line passes ABOVE V, so the soil force has a moment
 * about V that pulls the implement INTO the ground; zero = the free-link condition; negative = the
 * soil force lifts the implement out.
 */
export function draftLineAboveV(V: P2, P: P2, dir: P2) {
  const L = hypot(dir.x, dir.y)
  const ux = dir.x / L
  const uy = dir.y / L
  // signed distance of V from the line, measured along the line's left normal (−uy, ux) …
  const d = (V.x - P.x) * -uy + (V.y - P.y) * ux
  // … the left normal of a rearward-pointing line points down, so V below the line gives d > 0
  return ux <= 0 ? d : -d
}

export type HitchStage = 'penetrating' | 'free-link' | 'restrained' | 'lifting'

/**
 * Fig 6.5 stage: (a) V below ground and the draft line above it → pulled in; (b) the line through
 * V → free-link equilibrium; (c) at working depth with the line still above V → restrained (the
 * linkage holds the depth and the downward soil force goes onto the rear wheels).
 */
export function hitchStage(aboveV: number, atDepth: boolean, tol = 0.01): HitchStage {
  if (Math.abs(aboveV) <= tol) return 'free-link'
  if (aboveV < 0) return 'lifting'
  return atDepth ? 'restrained' : 'penetrating'
}

/* ------------------------------ field capacity ------------------------------ */

/** Field capacity in the ISU (PM 710) units: ac/h = W(ft) × S(mph) × FE / 8.25. */
export const fieldCapacityAcres = (Wft: number, Smph: number, FE = 1) => (Wft * Smph * FE) / 8.25

/** Theoretical and effective field capacity (ha/h) for width W (m), speed S (km/h) and field efficiency FE. */
export function fieldCapacities(W: number, Skmh: number, FE: number) {
  const Ct = fieldCapacity(W, Skmh, 1)
  const Ce = fieldCapacity(W, Skmh, FE)
  return { Ct, Ce, hoursPerHa: 1 / Ce, theoreticalHoursPerHa: 1 / Ct }
}

/** Field efficiency = theoretical time ÷ actual time. */
export const fieldEfficiency = (theoreticalH: number, actualH: number) => theoreticalH / actualH

/** Material throughput capacity, t/h (AEE501: commodity throughput uses the grain only, total throughput all the material). */
export const throughputCapacity = (tonnes: number, hours: number) => tonnes / hours

/* ------------------------------ seed drill ------------------------------ */

/** Seed each opener must deliver, kg/ha: the set rate shared equally (§13.5: 40 kg/ha over 5 openers = 8 kg each). */
export const perOpenerRate = (rateKgHa: number, openers: number) => rateKgHa / openers

/** Seed rate (kg/ha) from a calibration catch over a test area (for 0.1 ha this is "× 10"). */
export const rateFromCatch = (collectedKg: number, areaHa = 0.1) => collectedKg / areaHa

/**
 * Fluted-roller metering (beyond notes: standard drill theory). Each roller revolution delivers
 * the seed held in the exposed flutes: V = flutes × flute cross-section × exposed length × fill.
 * Returns kg per roller revolution for bulk density ρ (kg/m³).
 */
export function flutedRollerMass(flutes: number, fluteArea: number, exposedLength: number, bulkDensity: number, fill = 1) {
  return flutes * fluteArea * exposedLength * fill * bulkDensity
}

/**
 * Seed rate (kg/ha) of a fluted-roller drill: each opener covers πD × row spacing per wheel
 * revolution, and the roller turns `i` times per wheel revolution.
 */
export function flutedRollerRate(massPerRev: number, i: number, wheelD: number, rowSpacing: number) {
  return (massPerRev * i * 10000) / (PI * wheelD * rowSpacing)
}

/** New exposure (or any setting the rate is proportional to) that corrects a measured rate to the target. */
export const correctedSetting = (setting: number, measured: number, target: number) => (setting * target) / measured

/* ------------------------------ planter ------------------------------ */

/**
 * Seed-plate speed ratio for a sprocket drive (Fig 13.8b) plus a bevel pair: plate revolutions per
 * wheel revolution = (driver teeth / driven teeth) × bevel ratio.
 */
export const plateRatio = (driveTeeth: number, drivenTeeth: number, bevel = 1) => (driveTeeth / drivenTeeth) * bevel

/** Seed spacing along the row (m): one wheel revolution travels πD and drops cells × plate revolutions seeds. */
export const plateSpacing = (wheelD: number, platePerWheel: number, cells: number) => (PI * wheelD) / (platePerWheel * cells)

/** Cells needed on the plate for a target spacing (rounded to a whole number by the caller). */
export const cellsForSpacing = (wheelD: number, platePerWheel: number, spacing: number) => (PI * wheelD) / (platePerWheel * spacing)

/** Plant population per hectare for a row spacing and in-row spacing (m), `perHill` seeds per cell. */
export const plantPopulation = (rowSpacing: number, seedSpacing: number, perHill = 1) => (10000 / (rowSpacing * seedSpacing)) * perHill

/* ------------------------------ discs ------------------------------ */

/**
 * Lateral spacing (across travel) of discs spaced s along a gang axle set at gang angle γ to the
 * line square to travel; the gang's width of cut is n of these (beyond notes).
 */
export const gangCutWidth = (n: number, spacing: number, gangAngle: number) => n * spacing * cos(gangAngle)

/** Rolling speed of a disc (rad/s) whose face makes angle α with travel: the in-plane ground speed v·cos α over R (beyond notes). */
export const discSpin = (v: number, R: number, discAngle: number) => (v * cos(discAngle)) / R

/* ------------------------------ rotavator ------------------------------ */

/** Rotor speed from the PTO through the gearbox and side drive, rpm. */
export const rotorRpm = (ptoRpm: number, reduction: number) => ptoRpm / reduction

/**
 * Blade-tip path of a rotavator (a trochoid; beyond notes). Rotor turns like the wheels ("down-cut"),
 * so the tip moves rearward at the bottom when λ = ωR/v > 1. φ0 is the blade's angle from the
 * bottom at t = 0. Returns the tip position relative to the rotor axle at t = 0, m.
 */
export function bladeTip(t: number, v: number, R: number, rpm: number, phi0 = 0) {
  const w = (rpm * 2 * PI) / 60
  const p = phi0 + w * t
  return { x: v * t - R * sin(p), y: -R * cos(p) }
}

/** Depth of the furrow-bottom ridges left between successive bites (beyond notes, small-angle). */
export function bladeRidgeHeight(bite: number, R: number) {
  return R - Math.sqrt(Math.max(0, R * R - (bite / 2) ** 2))
}

export const toRad = (d: number) => d * deg
