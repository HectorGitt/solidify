import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { TRACTOR } from '@/tractor/dims'

export const C = {
  he: (w: string) => SRC.he510(w),
  ma: (w: string) => SRC.ma510(w),
  st: (w: string) => SRC.st510(w),
  tests: (w: string) => SRC.tests502(w),
  beyond: (w: string) => SRC.beyond(w),
}

/* ------------------------------ noise (HE p5–9, p22) ------------------------------ */

/** Reference pressure P₀ = 2 × 10⁻⁵ N/m² (HE eq 5). */
export const P0 = 2e-5

/** Sound pressure level, dB: SPL = 20·log₁₀(P/P₀) (HE eq 5). */
export const spl = (P: number) => 20 * Math.log10(P / P0)
/** RMS pressure for a level, N/m². */
export const pressureFor = (L: number) => P0 * 10 ** (L / 20)
/** Level of several incoherent sources: 10·log₁₀ Σ 10^(L/10) (HE p8–9: two 80 dB sources make 83 dB). */
export const addLevels = (...Ls: number[]) => 10 * Math.log10(Ls.reduce((s, L) => s + 10 ** (L / 10), 0))

/**
 * OSHA permissible exposure time, h: 90 dBA for 8 h down to 115 dBA for ¼ h (HE p6). The notes
 * give the end points; the 5 dB exchange rate between them (T = 8 / 2^((L − 90)/5)) is the OSHA
 * table itself and reproduces both end points exactly.
 */
export const oshaHours = (L: number) => 8 / 2 ** ((L - 90) / 5)
export const OSHA_TABLE: [number, number][] = [90, 92, 95, 97, 100, 102, 105, 110, 115].map((L) => [L, oshaHours(L)])
/** Daily noise dose (1 = the permitted limit) for `hours` at level L. */
export const noiseDose = (L: number, hours: number) => hours / oshaHours(L)

/** Measured operator-ear levels (HE p5, p22): 96 dB(A) without a cab, 88 dB(A) with one, 80 dB(A) target. */
export const NOISE = { open: 96, cab: 88, target: 80 }

export type Station = 'open' | 'rops' | 'cab'
export const STATION_LABEL: Record<Station, string> = { open: 'Open platform', rops: 'Two-post ROPS', cab: 'Cab (with ROPS frame)' }
export const stationLevel = (s: Station) => (s === 'cab' ? NOISE.cab : NOISE.open)

/* ------------------------------ anthropometry (HE Table 10.6) ------------------------------ */

export type Percentile = 5 | 50 | 95
export const ANTHRO: Record<Percentile, { height: number; sitting: number; mass: number }> = {
  5: { height: 1.62, sitting: 0.84, mass: 58 },
  50: { height: 1.73, sitting: 0.91, mass: 75 },
  95: { height: 1.85, sitting: 0.97, mass: 98 },
}
/** Recommended cab height (HE p23) and the instrument panel rules (HE p14–16). */
export const CAB_HEIGHT = 1.85
export const PANEL = { distance: 0.71, maxTilt: 45 }

/** Cab layout in the tractor frame (beyond notes except the 185 cm height). */
export const CAB = { x0: -0.82, x1: 0.62, floor: 0.92, hw: 0.82 }
export const CAB_ROOF = CAB.floor + CAB_HEIGHT
/** Seat surface height (the seat reference point of the shared tractor). */
export const SEAT_Y = TRACTOR.seat.y

/**
 * Segment lengths as fractions of stature (standard Drillis–Contini proportions, beyond the
 * notes, which give only stature, sitting height and mass).
 */
export const SEG = { thigh: 0.245, shank: 0.285, upperArm: 0.186, forearm: 0.146 + 0.054 }

export function headroom(p: Percentile, station: Station) {
  const head = SEAT_Y + ANTHRO[p].sitting
  return { head, clearance: station === 'cab' ? CAB_ROOF - head : Infinity }
}

/* ------------------------------ controls (HE Fig 10.1) ------------------------------ */

export type Limb = 'left foot' | 'right foot' | 'left hand' | 'right hand' | 'both hands' | 'eyes'
export type ControlKind = 'pedal' | 'lever' | 'switch' | 'gauge' | 'wheel' | 'knob'
export interface Control {
  name: string
  limb: Limb
  kind: ControlKind
  at: [number, number, number]
  role: string
}

const S = { x: TRACTOR.seat.x, y: TRACTOR.seat.y }
/**
 * The 21 controls and instruments of a typical tractor station, numbered as in a layout figure.
 * The notes' Fig 10.1 numbers 21 of them but its labels are not in the text; this set is typical
 * (beyond the notes) apart from the clutch on the left foot (HE p2).
 */
export const CONTROLS: Control[] = [
  { name: 'Steering wheel', limb: 'both hands', kind: 'wheel', at: [TRACTOR.steeringWheel.x, TRACTOR.steeringWheel.y, 0], role: 'Steers the front wheels.' },
  { name: 'Clutch pedal', limb: 'left foot', kind: 'pedal', at: [0.42, 1.0, 0.24], role: 'Disengages the drive; worked by the left foot.' },
  { name: 'Brake pedal, left', limb: 'right foot', kind: 'pedal', at: [0.42, 1.0, -0.16], role: 'Brakes the left rear wheel; used alone to tighten turns.' },
  { name: 'Brake pedal, right', limb: 'right foot', kind: 'pedal', at: [0.42, 1.0, -0.26], role: 'Brakes the right rear wheel; latch both together on the road.' },
  { name: 'Foot throttle', limb: 'right foot', kind: 'pedal', at: [0.4, 0.98, -0.38], role: 'Overrides the hand throttle for road work.' },
  { name: 'Hand throttle', limb: 'right hand', kind: 'lever', at: [0.32, 1.55, -0.2], role: 'Sets the governed engine speed for field work.' },
  { name: 'Main gear lever', limb: 'right hand', kind: 'lever', at: [0.12, 1.12, -0.12], role: 'Selects the gear.' },
  { name: 'Range lever', limb: 'right hand', kind: 'lever', at: [0.04, 1.1, -0.2], role: 'High/low range.' },
  { name: 'PTO lever', limb: 'left hand', kind: 'lever', at: [-0.05, 1.12, 0.32], role: 'Engages the PTO.' },
  { name: 'Hydraulic lift lever', limb: 'right hand', kind: 'lever', at: [-0.15, 1.45, -0.42], role: 'Raises and lowers the three-point linkage.' },
  { name: 'Draft / position control', limb: 'right hand', kind: 'lever', at: [-0.08, 1.45, -0.44], role: 'Chooses draft or position control.' },
  { name: 'Remote valve lever', limb: 'right hand', kind: 'lever', at: [-0.25, 1.45, -0.44], role: 'Works external hydraulic cylinders.' },
  { name: 'Differential lock', limb: 'right foot', kind: 'pedal', at: [0.15, 0.96, -0.3], role: 'Locks the differential when one wheel spins.' },
  { name: 'Parking brake', limb: 'left hand', kind: 'lever', at: [0.0, 1.2, 0.38], role: 'Holds the tractor when parked.' },
  { name: 'Ignition / starter key', limb: 'right hand', kind: 'switch', at: [0.4, 1.47, -0.14], role: 'Starts and stops the engine.' },
  { name: 'Lights switch', limb: 'left hand', kind: 'knob', at: [0.4, 1.47, 0.14], role: 'Head and work lights.' },
  { name: 'Horn', limb: 'right hand', kind: 'switch', at: [0.4, 1.47, -0.05], role: 'Warning horn.' },
  { name: 'Tachometer / hour meter', limb: 'eyes', kind: 'gauge', at: [0.43, 1.52, 0.0], role: 'Engine and PTO speed; hours for the service intervals.' },
  { name: 'Oil-pressure gauge', limb: 'eyes', kind: 'gauge', at: [0.43, 1.5, 0.1], role: 'Warns of low engine-oil pressure.' },
  { name: 'Coolant temperature gauge', limb: 'eyes', kind: 'gauge', at: [0.43, 1.5, -0.1], role: 'Warns of overheating.' },
  { name: 'Fuel gauge / ammeter', limb: 'eyes', kind: 'gauge', at: [0.43, 1.46, 0.2], role: 'Fuel level and battery charging.' },
]
export const SEAT_REF = S

/* ------------------------------ maintenance (Tractor Maintenance p1–2) ------------------------------ */

export type Interval = 0 | 10 | 50 | 250 | 600
export interface ServicePoint {
  interval: Exclude<Interval, 0>
  item: string
  at: [number, number, number]
}
export const SERVICE: ServicePoint[] = [
  { interval: 10, item: 'Engine oil level', at: [1.25, 1.15, 0.38] },
  { interval: 10, item: 'Radiator coolant', at: [1.95, 1.45, 0.1] },
  { interval: 10, item: 'Grease steering linkage', at: [1.75, 0.55, 0.55] },
  { interval: 10, item: 'Air cleaner', at: [1.5, 1.85, 0.25] },
  { interval: 50, item: 'Service air cleaner', at: [1.5, 1.85, -0.25] },
  { interval: 50, item: 'Gearbox oil level', at: [0.4, 0.85, 0.38] },
  { interval: 50, item: 'Front wheel bearings', at: [1.88, 0.39, 0.82] },
  { interval: 50, item: 'Levelling box', at: [-0.55, 0.8, 0.42] },
  { interval: 50, item: 'Tyre pressures', at: [0, 1.2, 0.95] },
  { interval: 50, item: 'Battery', at: [0.85, 1.25, -0.4] },
  { interval: 50, item: 'Steering fluid', at: [0.9, 1.35, 0.3] },
  { interval: 250, item: 'Engine oil and filter', at: [1.2, 0.75, -0.38] },
  { interval: 250, item: 'Crankcase breather', at: [1.3, 1.6, 0.3] },
  { interval: 250, item: 'Steering box', at: [0.7, 1.2, 0.2] },
  { interval: 250, item: 'Clutch free play', at: [0.42, 0.95, 0.38] },
  { interval: 250, item: 'Brakes', at: [0, 0.65, -0.55] },
  { interval: 250, item: 'Fuel water trap', at: [1.0, 0.95, -0.38] },
  { interval: 250, item: 'Fan belt', at: [1.85, 1.1, 0.32] },
  { interval: 250, item: 'Radiator core', at: [2.02, 1.0, -0.2] },
  { interval: 600, item: 'Fuel filter; bleed the system', at: [1.05, 1.15, -0.4] },
  { interval: 600, item: 'Injectors', at: [1.35, 1.5, -0.3] },
  { interval: 600, item: 'Transmission oil', at: [0.1, 0.55, 0.3] },
  { interval: 600, item: 'Flush the cooling system', at: [1.95, 0.8, 0.25] },
]
export const INTERVAL_COLOR: Record<Exclude<Interval, 0>, string> = { 10: '#9bd17a', 50: '#6fb3e0', 250: '#f5b942', 600: '#e8794f' }

/** Items due at a service of the given hours: that interval's list plus every shorter one that divides it. */
export function dueAt(hours: Exclude<Interval, 0>) {
  return SERVICE.filter((s) => hours % s.interval === 0)
}

/* ------------------------------ parameters ------------------------------ */

export interface CabParams {
  station: Station
  percentile: Percentile
  /** hours on the tractor per day */
  hours: number
  /** a second noise source (e.g. a PTO machine), dB(A); 0 = none */
  second: number
  interval: Interval
  numbers: boolean
  waves: boolean
}

export const DEFAULTS: CabParams = { station: 'cab', percentile: 50, hours: 8, second: 0, interval: 0, numbers: true, waves: true }

interface Store extends CabParams {
  set: (p: Partial<CabParams>) => void
  reset: () => void
}

export const useCab = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS }) }))

export function noiseAtEar(p: Pick<CabParams, 'station' | 'second' | 'hours'>) {
  const base = stationLevel(p.station)
  const L = p.second > 0 ? addLevels(base, p.second - (p.station === 'cab' ? NOISE.open - NOISE.cab : 0)) : base
  return { base, L, allowed: oshaHours(L), dose: noiseDose(L, p.hours), overTarget: L - NOISE.target }
}
