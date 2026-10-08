import { create } from 'zustand'
import { DriveGraph, brake, coupling, gearMesh } from '@/core/drive'

/**
 * Schematic tractor driveline for comparing PTO drives (AEE510 Power Transmission p2–3;
 * Bell, Tractor Transmission System p10; Culpin, Transmission of Power p6–8).
 *
 * Frame: +X forward, Y up, origin on the ground below the rear axle (as the shared tractor).
 * Engine → flywheel → clutch(es) → gearbox (input shaft, hollow layshaft, output shaft) →
 * bevel pinion and crown wheel → rear wheel. The PTO stub leaves the rear of the centre
 * housing on the lower shaft.
 *
 * The gears are a simplified constant-mesh/sliding layout (one forward and one reverse ratio)
 * with a two-speed PTO train; tooth numbers are chosen so 540 rpm comes at ≈ 2000 engine rpm.
 */

export type PtoType = 'transmission' | 'live' | 'independent' | 'ground'
export type Pedal = 'up' | 'half' | 'down'
export type GearSel = 'F' | 'N' | 'R'
export type PtoStd = '540' | '1000' | '1000L'

/** gear module and face width */
export const M = 0.004
export const FACE = 0.022

/** shaft axes (y, z) */
export const AX = {
  top: { y: 0.35, z: 0 },
  lay: { y: 0.23, z: 0 },
  pto: { y: 0.11, z: 0 },
  idler: { y: 0.26333, z: 0.04989 },
}

export const AXLE_X = -0.52
export const HOUSING = { x0: -0.62, x1: 0.28, y0: 0.02, y1: 0.48, z: 0.15 }

export interface GearDef {
  id: string
  body: string
  teeth: number
  axis: keyof typeof AX
  /** axial position (may depend on state for sliding gears) */
  x: number
  bore: number
}

/** Tooth numbers: every pair on the same centre distance (0.12 m, m = 4 mm) sums to 60. */
export const Z = {
  input: [20, 40] as const, // G1 (input shaft) : G2 (layshaft) constant mesh
  ptoIn: [20, 40] as const, // H1 (hollow PTO shaft) : H2 (PTO drive shaft)
  first: [25, 35] as const, // G3 (layshaft) : G4 (sliding gear on output shaft)
  reverse: [15, 15, 35] as const, // G5 (layshaft) : idler : G4
  ground: [30, 30] as const, // GS (output shaft) : GU (PTO countershaft)
  pto540: [21, 39] as const, // U5 : L5
  pto1000: [29, 31] as const, // U1 : L1
  bevel: [9, 37] as const, // pinion : crown wheel
}

/** Hub final reduction (typical, not drawn) used for the travel-speed readout. */
export const FINAL = 5.7
/** Rolling radius of the Farmland tractor's 14.9-28 rear tyre (Macmillan App. II). */
export const ROLLING_R = 0.635

/** Spline standards for the stub (TTS p10 gives 540: 6 × 35 mm; 1000: 21 splines, 44 mm). */
export const STUBS: Record<PtoStd, { rpm: number; splines: number; od: number; root: number; label: string; note: string; beyond?: boolean }> = {
  '540': { rpm: 540, splines: 6, od: 0.035, root: 0.0295, label: '540 · 6-spline Ø35', note: '1⅜ in (35 mm), 6 splines — ISO 500 type 1.' },
  '1000': {
    rpm: 1000,
    splines: 21,
    od: 0.035,
    root: 0.0315,
    label: '1000 · 21-spline Ø35',
    note: 'ISO 500 / ASABE S203 type 2: 1⅜ in (35 mm), 21 splines. The 1¾ in, 1000 rpm shaft has 20 splines (type 3).',
  },
  '1000L': {
    rpm: 1000,
    splines: 20,
    od: 0.045,
    root: 0.041,
    label: '1000 · 20-spline Ø45',
    note: 'ISO 500 type 3: 1¾ in (45 mm), 20 splines, for large tractors.',
    beyond: true,
  },
}

export interface PtoParams {
  type: PtoType
  pedal: Pedal
  gear: GearSel
  /** PTO engagement lever (dog clutch, or the independent PTO's hydraulic clutch) */
  lever: boolean
  std: PtoStd
  /** engine speed, rpm */
  rpm: number
  flows: boolean
}

export const DEFAULTS: PtoParams = { type: 'live', pedal: 'up', gear: 'F', lever: true, std: '540', rpm: 2000, flows: true }

interface Store extends PtoParams {
  set: (p: Partial<PtoParams>) => void
  reset: () => void
}

export const usePto = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/* ------------------------------ clutch logic ------------------------------ */

/** Main (transmission) clutch: any pedal travel releases it; the live PTO's first stage. */
export const mainEngaged = (p: Pick<PtoParams, 'pedal'>) => p.pedal === 'up'
/** Live (two-stage) PTO clutch: released only at full pedal travel. */
export const liveEngaged = (p: Pick<PtoParams, 'pedal'>) => p.pedal !== 'down'

/* ------------------------------ driveline ------------------------------ */

export const BODIES = ['engine', 'trans', 'lay', 'idler', 'out', 'crown', 'hollow', 'ptoDrive', 'ptoUp', 'pto'] as const
export type BodyId = (typeof BODIES)[number]

/**
 * The drive graph. Constraints read the current parameters through `get` every solve, so
 * pedal, gear, lever and PTO type can change while it runs. Undetermined members coast
 * down (drag), as an implement's inertia keeps a PTO turning briefly after declutching.
 */
export function createDriveline(get: () => PtoParams, drag = 40) {
  const g = new DriveGraph()
  for (const id of BODIES) g.body(id, id === 'crown' || id === 'out' ? drag / 3 : drag)
  const t = () => get().type
  const p = () => get()
  g.add(coupling('main-clutch', 'engine', 'trans', () => mainEngaged(p())))
  g.add(gearMesh('constant-mesh', 'trans', Z.input[0], 'lay', Z.input[1]))
  g.add(gearMesh('first', 'lay', Z.first[0], 'out', Z.first[1], { active: () => p().gear === 'F' }))
  g.add(gearMesh('rev-idler', 'lay', Z.reverse[0], 'idler', Z.reverse[1]))
  g.add(gearMesh('reverse', 'idler', Z.reverse[1], 'out', Z.reverse[2], { active: () => p().gear === 'R' }))
  g.add(gearMesh('bevel', 'out', Z.bevel[0], 'crown', Z.bevel[1]))

  // PTO input: hollow shaft round the input shaft (live: second clutch; independent: direct)
  g.add(coupling('pto-clutch', 'engine', 'hollow', () => (t() === 'live' ? liveEngaged(p()) : t() === 'independent')))
  g.add(gearMesh('pto-input', 'hollow', Z.ptoIn[0], 'ptoDrive', Z.ptoIn[1]))
  g.add(brake('pto-input-idle', 'hollow', () => t() === 'transmission' || t() === 'ground'))

  // PTO countershaft: engaged by the lever from the layshaft, the PTO drive shaft, or the output shaft
  g.add(coupling('dog-transmission', 'lay', 'ptoUp', () => t() === 'transmission' && p().lever))
  g.add(coupling('dog-live', 'ptoDrive', 'ptoUp', () => (t() === 'live' || t() === 'independent') && p().lever))
  g.add(gearMesh('ground-pair', 'out', Z.ground[0], 'ptoUp', Z.ground[1], { active: () => t() === 'ground' && p().lever }))
  // independent PTO: the shaft is braked automatically when its clutch is released
  g.add(brake('ipto-brake', 'ptoUp', () => t() === 'independent' && !p().lever))

  // two-speed PTO train to the stub shaft
  g.add(gearMesh('pto-540', 'ptoUp', Z.pto540[0], 'pto', Z.pto540[1], { active: () => p().std === '540' }))
  g.add(gearMesh('pto-1000', 'ptoUp', Z.pto1000[0], 'pto', Z.pto1000[1], { active: () => p().std !== '540' }))
  return g
}

/** Steady engine-to-PTO speed ratio for the selected stub (forward, all clutches in). */
export function ptoRatio(std: PtoStd) {
  const [a, b] = std === '540' ? Z.pto540 : Z.pto1000
  return (Z.input[0] / Z.input[1]) * (a / b)
}

/** Engine speed at which the PTO reaches its standard speed. */
export const ratedEngineRpm = (std: PtoStd) => STUBS[std].rpm / ptoRatio(std)

/** Steady-state speeds (rpm, signed) for the current settings — used by the panel and tests. */
export function steadySpeeds(p: PtoParams, settle = 400) {
  const g = createDriveline(() => p)
  g.drive('engine', p.rpm)
  // start with everything turning so released members visibly coast down to their steady state
  for (let i = 0; i < settle; i++) g.step(0.01)
  const s = (id: BodyId) => g.get(id).omega
  return { engine: s('engine'), trans: s('trans'), out: s('out'), crown: s('crown'), pto: s('pto'), coasting: [...g.coasting] }
}

/* ------------------------------ live values ------------------------------ */

export interface LivePto {
  engine: number
  trans: number
  out: number
  wheel: number
  /** km/h, signed (forward +) */
  travel: number
  pto: number
  /** PTO revolutions per metre of travel (ground-speed PTO) */
  perMetre: number
}

export const live: LivePto = { engine: 0, trans: 0, out: 0, wheel: 0, travel: 0, pto: 0, perMetre: 0 }

/** Which members stop for each PTO type when the clutch pedal is pressed (half / fully). */
export const TYPE_INFO: Record<PtoType, { label: string; short: string; stops: string }> = {
  transmission: {
    label: 'Transmission',
    short: 'Driven from the gearbox layshaft behind the one clutch.',
    stops: 'Stops whenever the clutch is pressed — and the implement stops with the tractor. Runs in neutral with the clutch in.',
  },
  live: {
    label: 'Live (continuous)',
    short: 'Two-stage clutch on one pedal; hollow PTO shaft round the input shaft.',
    stops: 'Half pedal stops the wheels but the PTO keeps running; full pedal stops the PTO too.',
  },
  independent: {
    label: 'Independent',
    short: 'Own hydraulic wet clutch and control; driven straight from the flywheel.',
    stops: 'The pedal never stops it. Its own lever engages or stops it, even on the move; released, it is braked.',
  },
  ground: {
    label: 'Ground-speed',
    short: 'Driven from the gearbox output, after the speed gears.',
    stops: 'Speed is proportional to travel: it stops when the tractor stops (clutch or neutral) and reverses in reverse gear.',
  },
}
