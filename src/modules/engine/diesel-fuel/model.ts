import { create } from 'zustand'
import {
  DENSITY,
  deliveryPerStroke,
  heatingValue,
  helixEffectiveStroke,
  injectorSpringForce,
  kgcm2ToPa,
  plungerArea,
  plungerState,
  pumpFuelRate,
  type HelixElement,
} from '@/physics/fuel'

/**
 * Diesel fuel system laid out along X (left → right): tank, sediment bowl, four-element in-line
 * injection pump with end-mounted feed (lift) pump, primary and secondary filters, and one
 * injector in a cylinder-head stub. Everything sits on the z = 0 plane so the half section shows
 * every passage. Metres, Y up.
 */
export const LAYOUT = {
  tank: { x0: -0.86, x1: -0.5, y0: 0.4, y1: 0.64, z: 0.13 },
  bowl: { x: -0.38, headY: 0.33 },
  pump: { x0: -0.105, x1: 0.105, y0: 0, y1: 0.15, z: 0.036 },
  camY: 0.03,
  feed: { x: 0.165, y: 0.03 },
  primary: { x: 0.32, y: 0.25 },
  secondary: { x: 0.45, y: 0.25 },
  injector: { x: 0.68, y: 0.2 },
}

/** Injector origin (nozzle tip) height in world space. */
export const INJ_Y = 0.2 + 0.0005

/** Element centre-lines. Element 0 (nearest the filters) feeds the injector shown — cylinder 1. */
export const ELEMENT_X = [0.0675, 0.0225, -0.0225, -0.0675]

/** Firing order 1-3-4-2 → pump-cam phase (cam turns at half crank speed: 90° between firings). */
export const FIRING_ORDER = [1, 3, 4, 2]
export const ELEMENT_PHASE = [0, 1, 2, 3].map((i) => (FIRING_ORDER.indexOf(i + 1) * Math.PI) / 2)

/** Pump element geometry (typical tractor values — the notes give none). */
export const ELEMENT: HelixElement = {
  plungerD: 0.008,
  sleeveR: 0.009,
  helixLead: 0.0113,
  maxRotation: 1.111,
  preStroke: 0.002,
  camLift: 0.008,
}

export const DIM = {
  camBase: 0.013,
  tappetR: 0.0095,
  tappetH: 0.016,
  /** spill/inlet port centre height in pump coordinates (plunger top at lift 0 + pre-stroke − port radius) */
  portY: 0.1201,
  portR: 0.0009,
  barrelR: 0.0105,
  plungerLen: 0.06,
  /** control sleeve pinion height and the fixed upper spring seat */
  sleeveY: 0.096,
  springTop: 0.092,
  /** rack pitch line (behind the pinions so the half section keeps it) */
  rackPitchZ: -0.009,
  rackZ: -0.0115,
  /** injector: needle and seat diameters for the opening-pressure relation */
  needleD: 0.004,
  seatD: 0.0018,
  /** visual needle lift (real ≈ 0.25 mm — exaggerated so you can see it) */
  needleLiftVis: 0.0008,
}

/** Plunger top height (pump coords) at lift 0: the top edge closes the ports after the pre-stroke. */
export const TAPPET_Y0 = LAYOUT.camY + DIM.camBase
/** plunger foot rests on the tappet top */
export const PLUNGER_Y0 = TAPPET_Y0 + DIM.tappetH
export const PLUNGER_TOP0 = PLUNGER_Y0 + DIM.plungerLen

/** Rack position (x of its centre) at the stop position; it slides +X towards maximum fuel. */
export const RACK_X0 = -0.045
const RACK_LEN = 0.3

/**
 * Static phase of each control-sleeve pinion so a tooth space meets a rack tooth (the pinion is
 * clamped to its sleeve; turning it on the sleeve is how elements are calibrated to deliver equally).
 */
export const PINION_PHASE = ELEMENT_X.map((xe) => {
  const p = Math.PI * 0.001
  const u = (xe - RACK_X0 + RACK_LEN / 2) / p - 0.5
  return ((u - Math.round(u)) * p) / ELEMENT.sleeveR
})

/** Rack travel range, m. 0 = stop; 10 mm = maximum (excess fuel for starting). */
export const RACK_MAX = 0.01

/* ------------------------------ Parameters ------------------------------ */

export interface FuelParams {
  /** control-rack position, m */
  rack: number
  rpm: number
  /** injector opening (nozzle) pressure, kg/cm² */
  pOpen: number
  /** brake thermal efficiency used for the power estimate */
  eta: number
  flows: boolean
  /** air in the lines (e.g. after running the tank dry): the injector gets no fuel */
  air: boolean
  /** priming / bleeding in progress */
  bleeding: boolean
}

export const DEFAULTS: FuelParams = { rack: 0.0065, rpm: 1500, pOpen: 140, eta: 0.33, flows: true, air: false, bleeding: false }

interface FuelStore extends FuelParams {
  set: (p: Partial<FuelParams>) => void
  reset: () => void
}

export const useFuel = create<FuelStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const CYLINDERS = 4
export const HV_HSD = heatingValue('hsd')

/** Everything the panel computes from the parameters. */
export function pumpOutput(p: Pick<FuelParams, 'rack' | 'rpm' | 'eta' | 'pOpen'>) {
  const theta = Math.min(ELEMENT.maxRotation, p.rack / ELEMENT.sleeveR)
  const eff = helixEffectiveStroke(p.rack, ELEMENT)
  const vol = deliveryPerStroke(p.rack, ELEMENT)
  const mass = vol * DENSITY.diesel
  const mf = pumpFuelRate(vol, p.rpm, CYLINDERS)
  const power = p.eta * HV_HSD * mf
  const sfcKgKWh = power > 0 ? (mf * 3600) / (power / 1000) : NaN
  const spring = injectorSpringForce(kgcm2ToPa(p.pOpen), DIM.needleD, DIM.seatD)
  return { theta, eff, vol, mass, mf, power, sfc: sfcKgKWh, area: plungerArea(ELEMENT), spring }
}

export type PlungerPhase = 'filling' | 'delivering' | 'spill' | 'returning'

/** filling: ports open · delivering: ports covered, fuel pushed to the injector · spill: helix has uncovered the spill port. */
export function phaseOf(camAngle: number, rack: number): PlungerPhase {
  const s = plungerState(camAngle, rack, ELEMENT)
  if (!s.rising) return s.lift < ELEMENT.preStroke ? 'filling' : 'returning'
  if (s.lift < ELEMENT.preStroke) return 'filling'
  return s.delivering ? 'delivering' : 'spill'
}

/* ------------------------------ Live values ------------------------------ */

export interface LiveFuel {
  /** pump-camshaft angle of element 1, rad 0…2π */
  cam: number
  lift: number
  phase: PlungerPhase
  /** 0…1, held briefly after each delivery so the flow and needle are visible */
  pulse: number
  /** HP-line pressure, kg/cm² (illustrative) */
  pLine: number
  needleOpen: boolean
  /** bleeding progress 0…1 */
  bleed: number
}

export const live: LiveFuel = { cam: 0, lift: 0, phase: 'filling', pulse: 0, pLine: 0, needleOpen: false, bleed: 0 }

export const PHASE_LABEL: Record<PlungerPhase, string> = { filling: 'Filling', delivering: 'Delivering', spill: 'Spill (helix open)', returning: 'Return stroke' }

/** Illustrative HP-line pressure for element 1 (residual pressure held by the delivery valve). */
export function linePressure(phase: PlungerPhase, pOpen: number, pulse: number) {
  if (phase === 'delivering') return pOpen * 1.25
  return 25 + (pOpen - 25) * 0.6 * pulse
}
