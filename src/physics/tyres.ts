/**
 * Tyres and tracks — AEE510 "Tires and Tracks" (TT), Zoz & Grisso Lecture 27 (L27) and the
 * Bell text (TTS p14). SI units unless a name says otherwise.
 */

export const INCH = 0.0254

export type Construction = 'bias' | 'radial'

export interface TyreSize {
  code: string
  construction: Construction
  /** section width, mm and inches */
  widthMm: number
  widthIn: number
  /** old-style width in a dual size such as 12.4/11-28 (inches) */
  oldWidthIn?: number
  /** aspect ratio h/b as a fraction */
  aspect: number
  /** true when the code carries no aspect ratio and a typical value was assumed */
  aspectAssumed: boolean
  rimIn: number
  rimMm: number
  sectionHeightMm: number
  overallDiaMm: number
  /** 'inch' (e.g. 16.9-34) or 'metric' (e.g. 520/70R38) */
  system: 'inch' | 'metric'
}

/**
 * Typical aspect ratio of a conventional inch-sized farm tyre (section height ≈ 0.85 × width).
 * The notes give no value; this is from standard tyre data and is flagged in the output.
 */
export const CONVENTIONAL_ASPECT = 0.85

/**
 * Decode a tractor tyre size code.
 * - Inch codes (TT p5, Fig 7): "24.5-32" = 24.5 in section width on a 32 in rim; "-" = bias,
 *   "R" = radial; "12.4/11-28" gives the new and old width.
 * - Metric codes (L27 examples, e.g. 710/70R38): width mm / aspect % R rim in.
 */
export function decodeTyreSize(raw: string): TyreSize | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '')
  const metric = /^(\d{3})\/(\d{2})(R|-|B)(\d{2}(?:\.\d)?)$/.exec(code)
  if (metric) {
    const widthMm = parseFloat(metric[1])
    const aspect = parseFloat(metric[2]) / 100
    const rimIn = parseFloat(metric[4])
    return finish(code, metric[3] === 'R' ? 'radial' : 'bias', widthMm, aspect, false, rimIn, 'metric')
  }
  const inch = /^(\d{1,2}(?:\.\d{1,2})?)(?:\/(\d{1,2}(?:\.\d{1,2})?))?(R|-)(\d{2}(?:\.\d)?)$/.exec(code)
  if (inch) {
    const widthIn = parseFloat(inch[1])
    const rimIn = parseFloat(inch[4])
    if (widthIn <= 0 || rimIn <= 0) return null
    const t = finish(code, inch[3] === 'R' ? 'radial' : 'bias', widthIn * 25.4, CONVENTIONAL_ASPECT, true, rimIn, 'inch')
    if (inch[2]) t.oldWidthIn = parseFloat(inch[2])
    return t
  }
  return null
}

function finish(code: string, construction: Construction, widthMm: number, aspect: number, aspectAssumed: boolean, rimIn: number, system: 'inch' | 'metric'): TyreSize {
  const rimMm = rimIn * 25.4
  const sectionHeightMm = widthMm * aspect
  return {
    code,
    construction,
    widthMm,
    widthIn: widthMm / 25.4,
    aspect,
    aspectAssumed,
    rimIn,
    rimMm,
    sectionHeightMm,
    overallDiaMm: rimMm + 2 * sectionHeightMm,
    system,
  }
}

/** Unloaded rolling circumference π·d (m) — the distance per revolution with no slip. */
export function circumference(overallDiaM: number) {
  return Math.PI * overallDiaM
}

/** Rolling radius ≈ 1.06 × static loaded radius (L27 p6). */
export function rollingRadiusFromStatic(slrM: number) {
  return 1.06 * slrM
}

/**
 * Ground contact area of a pneumatic tyre: the mean ground pressure is roughly the inflation
 * pressure (L27 p39), so A ≈ W/p.
 */
export function tyreContactArea(loadN: number, inflationPa: number) {
  return loadN / inflationPa
}

/** Wheel slip from a chalk-mark test (TT p10): s = (R₂ − R₁)/R₂, R₁ unloaded and R₂ loaded revolutions over the same distance. */
export function slipFromRevs(unloadedRevs: number, loadedRevs: number) {
  return (loadedRevs - unloadedRevs) / loadedRevs
}

/* ------------------------------ Tracks ------------------------------ */

/**
 * Mean ground pressure under a crawler (standard text; the notes give no formula):
 * p = W / (2·b·L), b = shoe width, L = track length on the ground (≈ sprocket–idler centres).
 */
export function trackGroundPressure(weightN: number, shoeWidthM: number, groundLengthM: number) {
  const area = 2 * shoeWidthM * groundLengthM
  return { area, pressurePa: weightN / area }
}

/**
 * Sag δ of the upper strand between carrier roller and front idler when the chain has
 * `slackM` more length than the straight span s (parabolic cable: ΔL ≈ 8δ²/3s).
 */
export function sagFromSlack(spanM: number, slackM: number) {
  return slackM <= 0 ? 0 : Math.sqrt((3 * spanM * slackM) / 8)
}

/** Extra chain length taken up by a sag δ over span s: ΔL ≈ 8δ²/(3s). */
export function slackFromSag(spanM: number, sagM: number) {
  return (8 * sagM * sagM) / (3 * spanM)
}

/**
 * Static tension in the sagging strand (parabolic cable, standard statics): T = w·s²/(8δ),
 * w = track weight per metre (N/m). Infinite when the strand is pulled straight.
 */
export function strandTension(weightPerMetreN: number, spanM: number, sagM: number) {
  return sagM <= 0 ? Infinity : (weightPerMetreN * spanM * spanM) / (8 * sagM)
}

/** Recommended sag: about 1 in midway between carrier roller and front idler (TT p30–31). */
export const RECOMMENDED_SAG = 1 * INCH

export type TensionState = 'too tight' | 'correct' | 'too loose'

/** Classify a measured sag against the ~1 in guide (±40 % band). */
export function tensionState(sagM: number): TensionState {
  if (sagM < 0.6 * RECOMMENDED_SAG) return 'too tight'
  if (sagM > 1.6 * RECOMMENDED_SAG) return 'too loose'
  return 'correct'
}

/* ------------------------------ Inflation ------------------------------ */

export const PSI_PER_BAR = 14.5038

/** General-guide tyre pressures, bar (Bell, TTS p14). */
export const RECOMMENDED_PRESSURE_BAR = {
  front: { field: 1.7, road: 2.1, loader: 2.7 },
  rear: { field: 0.8, road: 1.0 },
} as const

export type InflationState = 'under' | 'correct' | 'over'

/**
 * Classify an inflation pressure against the recommended value. The notes describe the three
 * states (TT p6, Fig 9) but give no band; ±20 % is used here (beyond the notes).
 */
export function inflationState(pressure: number, recommended: number): InflationState {
  if (pressure < 0.8 * recommended) return 'under'
  if (pressure > 1.2 * recommended) return 'over'
  return 'correct'
}

/**
 * Contact patch from "ground pressure ≈ inflation pressure" (L27 p39): A = W/p. The patch is
 * taken as 0.8 × length × width, the width being 0.6 b over-inflated (only the crown touches,
 * TT Fig 9), 0.95 b under-inflated and 0.85 b correct — shape factors beyond the notes.
 * Deflection from the chord of the loaded circle, δ = l²/(8R), capped at 40 % of the section height.
 */
export function contactPatch(loadN: number, pressurePa: number, size: TyreSize, state: InflationState = 'correct') {
  const R = size.overallDiaMm / 2000
  const b = size.widthMm / 1000
  const area = tyreContactArea(loadN, pressurePa)
  const width = b * (state === 'over' ? 0.6 : state === 'under' ? 0.95 : 0.85)
  const length = area / (0.8 * width)
  const deflection = Math.min((length * length) / (8 * R), 0.4 * (size.sectionHeightMm / 1000))
  return { area, width, length, deflection }
}

/**
 * Gauge correction with the valve at the TOP of a liquid-ballasted tyre: the liquid head
 * Δp = ρgh, psi per foot. The notes' rule is "about ½ lb per foot of liquid height" (TT p7).
 */
export function liquidHeadPsiPerFt(specificGravity: number) {
  return (specificGravity * 1000 * 9.81 * 0.3048) / 6894.76
}

/* ------------------------------ Slip test ------------------------------ */

/** Chalk-mark slip test over 10 loaded revolutions (TT p9): [no-load revolutions, % slip]. */
export const SLIP_TABLE: [number, number][] = [
  [10, 0],
  [9.5, 5],
  [9, 10],
  [8.5, 15],
  [8, 20],
  [7.5, 25],
  [7, 30],
]

export type BallastAction = 'remove ballast' | 'proper ballast' | 'add ballast'

/** TT p9: fewer than 8½ no-load revolutions → add weight; more than 9 → remove it (10–15 % ideal). */
export function slipVerdict(slip: number): BallastAction {
  if (slip < 0.1 - 1e-9) return 'remove ballast'
  if (slip > 0.15 + 1e-9) return 'add ballast'
  return 'proper ballast'
}

/* ------------------------------ Ballast guides ------------------------------ */

export type Implement = 'integral' | 'semi-integral' | 'towed'
export type SoilSurface = 'firm' | 'tilled'

type Curve = [number, number][]
/**
 * Tractor weight guides: lb rear weight per PTO hp against advertised speed (mph), digitised
 * from TT Figs 16–18 (p10–11). Firm soil lies between `low` and `mid`, tilled soil between
 * `mid` and `high`; each range gives ≈15 % slip.
 */
export const WEIGHT_GUIDE: Record<Implement, { low: Curve; mid: Curve; high: Curve; fig: string }> = {
  integral: {
    fig: 'Fig 16',
    low: [[2.1, 169], [3, 128], [4, 91], [5, 72], [6, 60], [7, 52.7]],
    mid: [[2.2, 200], [3, 156.6], [4, 119], [5, 91], [6, 74], [7, 62.5]],
    high: [[2.35, 218.5], [3, 180], [4, 134], [5, 103], [6, 85], [7, 75]],
  },
  'semi-integral': {
    fig: 'Fig 17',
    low: [[2.1, 207], [3, 153], [4, 113], [5, 88], [6, 72], [7, 61]],
    mid: [[2.2, 225], [3, 180], [4, 141], [5, 107], [6, 86], [7, 69]],
    high: [[2.3, 239], [3, 199], [4, 160], [5, 118], [6, 92], [7, 78]],
  },
  towed: {
    fig: 'Fig 18',
    low: [[2.4, 223], [3, 192.6], [4, 137.7], [5, 112.6], [6, 94], [7, 81]],
    mid: [[2.4, 239], [3, 205.6], [4, 153.5], [5, 122.8], [6, 101.4], [7, 88.4]],
    high: [[2.6, 252], [3, 229.8], [4, 171], [5, 135.8], [6, 114.4], [7, 98.6]],
  },
}

function interp(c: Curve, x: number) {
  let i = 0
  while (i < c.length - 2 && x > c[i + 1][0]) i++
  const [x0, y0] = c[i]
  const [x1, y1] = c[i + 1]
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

/** lb of rear weight per PTO hp (lo…hi) at a speed of 2–7 mph (TT Figs 16–18). */
export function weightPerHp(implement: Implement, soil: SoilSurface, mph: number) {
  const g = WEIGHT_GUIDE[implement]
  const v = Math.max(2, Math.min(7, mph))
  return soil === 'firm' ? { lo: interp(g.low, v), hi: interp(g.mid, v) } : { lo: interp(g.mid, v), hi: interp(g.high, v) }
}

/** Rear weight (lb) = PTO hp × load fraction × lb/hp ("¾ load needs ¾ the rear weight", TT p8, p11). */
export function rearWeightRange(ptoHp: number, lbPerHp: { lo: number; hi: number }, loadFraction = 1) {
  return { lo: ptoHp * loadFraction * lbPerHp.lo, hi: ptoHp * loadFraction * lbPerHp.hi }
}

/** 2WD front ballast is for stability, not traction: ½ rear for integral/semi-integral, ⅓ for towed (TT p10). */
export function frontWeightFraction(implement: Implement) {
  return implement === 'towed' ? 1 / 3 : 1 / 2
}

/** Recommended front/rear split, % (BAL p2; the extracted table is garbled — best reading). */
export const BAL_SPLIT = {
  '2WD': { light: [25, 75], heavy: [35, 65] },
  '4WD': { light: [35, 65], heavy: [40, 60] },
} as const

/** Cast-iron weights (TTS p15): rear discs ≈ 40 kg, 2–3 per wheel; front 30–40 kg; tray ≈ 200 kg on a 45 kW tractor. */
export const CAST_WEIGHTS = { rearDiscKg: 40, frontKg: 35, trayKg45kW: 200 } as const

/* ------------------------------ Liquid ballast ------------------------------ */

export const US_GAL_L = 3.785411784
export const LB_KG = 0.45359237
/** TT p13: water + 3½ lb CaCl₂ per gallon → 8.34 + 3.5 = 11.84 lb per gallon. */
export const WATER_LB_PER_GAL = 8.34
export const TT_CACL2_LB_PER_GAL = 3.5
/** CaCl₂ dose, kg per litre of water: TT 3.5 lb per US gal (−12 °F); Bell 1 kg per 5 L (TTS p15). */
export const CACL2_TT = (TT_CACL2_LB_PER_GAL * LB_KG) / US_GAL_L
export const CACL2_BELL = 0.2

/** Liquid ballast chart (TT p13). Capacity is for TWO tyres; gallons and pounds at 75 % (valve-level) fill. */
export const LIQUID_BALLAST_CHART: { size: string; ply: number; capacityLb: number; gal: number; lb: number }[] = [
  { size: '13.6-28', ply: 4, capacityLb: 4860, gal: 74, lb: 878 },
  { size: '13.6-38', ply: 6, capacityLb: 6940, gal: 98, lb: 1162 },
  { size: '14.9-28', ply: 6, capacityLb: 6640, gal: 92, lb: 1090 },
  { size: '15.5-38', ply: 6, capacityLb: 7320, gal: 112, lb: 1326 },
  { size: '15.5-38', ply: 8, capacityLb: 8660, gal: 112, lb: 1326 },
  { size: '16.9-34', ply: 6, capacityLb: 8340, gal: 140, lb: 1658 },
  { size: '16.9-34', ply: 8, capacityLb: 10040, gal: 140, lb: 1658 },
  { size: '16.9-38', ply: 8, capacityLb: 10640, gal: 154, lb: 1824 },
  { size: '18.4-34', ply: 6, capacityLb: 9880, gal: 170, lb: 2014 },
  { size: '18.4-34', ply: 8, capacityLb: 11300, gal: 170, lb: 2014 },
  { size: '18.4-38', ply: 8, capacityLb: 11940, gal: 188, lb: 2226 },
  { size: '18.4-38', ply: 10, capacityLb: 13900, gal: 188, lb: 2226 },
  { size: '20.8-38', ply: 10, capacityLb: 15300, gal: 240, lb: 2842 },
  { size: '24.5-32', ply: 10, capacityLb: 17800, gal: 292, lb: 3458 },
]

/** Pounds of TT ballast solution for a volume in US gallons (11.84 lb/gal). */
export function ballastLb(gal: number) {
  return gal * (WATER_LB_PER_GAL + TT_CACL2_LB_PER_GAL)
}

/**
 * Air cavity of one tyre: section modelled as an ellipse 0.9b wide and 0.85h high, centred
 * 0.45h above the rim and truncated by it (a geometric model, beyond the notes; it reproduces the
 * TT p13 chart volumes to about ±10 % when the chart is read as two tyres).
 */
export function cavityModel(size: TyreSize) {
  const r0 = size.rimMm / 2000
  const h = size.sectionHeightMm / 1000
  const b = size.widthMm / 1000
  const rm = r0 + 0.45 * h
  const ar = 0.425 * h
  const ay = 0.45 * b
  const width = (r: number) => {
    const u = (r - rm) / ar
    return Math.abs(u) >= 1 ? 0 : 2 * ay * Math.sqrt(1 - u * u)
  }
  return { r0, rTop: rm + ar, width }
}

/** Fraction of a circle of radius r lying below the height y (measured up from the axle). */
function belowFraction(r: number, y: number) {
  if (y >= r) return 1
  if (y <= -r) return 0
  return 1 - Math.acos(y / r) / Math.PI
}

/** Cavity volume (m³) below a horizontal liquid level `levelY` above the axle centre. */
export function cavityVolumeBelow(size: TyreSize, levelY: number, steps = 300) {
  const { r0, rTop, width } = cavityModel(size)
  const dr = (rTop - r0) / steps
  let v = 0
  for (let i = 0; i < steps; i++) {
    const r = r0 + (i + 0.5) * dr
    v += width(r) * 2 * Math.PI * r * belowFraction(r, levelY) * dr
  }
  return v
}

export function cavityVolume(size: TyreSize) {
  return cavityVolumeBelow(size, 1e3)
}

/** Fill left when a full tyre drains down to its valve (on the rim) at a clock position, 12 = top. */
export function fillAtValveClock(size: TyreSize, clockHour: number) {
  const ang = ((12 - clockHour) * Math.PI) / 6
  return cavityVolumeBelow(size, (size.rimMm / 2000) * Math.cos(ang)) / cavityVolume(size)
}

/** Liquid level (height above the axle) that gives a fill fraction (bisection). */
export function levelForFill(size: TyreSize, fill: number) {
  const { rTop } = cavityModel(size)
  const V = cavityVolume(size)
  let lo = -rTop
  let hi = rTop
  for (let k = 0; k < 36; k++) {
    const mid = (lo + hi) / 2
    if (cavityVolumeBelow(size, mid, 120) / V < fill) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Liquid ballast in ONE tyre: water = fill × cavity; CaCl₂ added at `cacl2` kg per litre of water. */
export function liquidBallast(size: TyreSize, fill: number, cacl2 = CACL2_TT) {
  const cavityL = cavityVolume(size) * 1000
  const waterL = fill * cavityL
  const saltKg = waterL * cacl2
  return { cavityL, waterL, saltKg, massKg: waterL + saltKg, gal: waterL / US_GAL_L }
}

/* ------------------------------ Crawler sprocket ------------------------------ */

/** Undercarriage share of a crawler's costs (TT p47). */
export const UNDERCARRIAGE_COST = { purchase: 0.2, service: 0.5 } as const

/**
 * "Hunting tooth" sprocket (TT p50): an odd number of teeth at half the chain pitch, so every
 * other tooth carries a bushing; adjacent bushings subtend 2·(2π/z), R = p / (2 sin(2π/z)).
 */
export function huntingSprocketRadius(teeth: number, chainPitch: number) {
  return chainPitch / (2 * Math.sin((2 * Math.PI) / teeth))
}

/** Is tooth i driving a bushing on revolution k? With z odd the pattern swaps every revolution. */
export function toothEngaged(teeth: number, tooth: number, revolution: number) {
  return (tooth + revolution * teeth) % 2 === 0
}
